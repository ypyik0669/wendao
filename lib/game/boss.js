import { MONSTERS, monsterOf, TIER_OF_REALM } from "../data/monsters.js";
import { makeRng } from "./rng.js";
import { deriveStats, buildUnit } from "./stats.js";
import { battle } from "./battle.js";
import { monsterUnit } from "./explore.js";
import { byPrefix, setShared, setSharedSoft, delShared } from "./shared.js";
import { addStack } from "./inventory.js";
import { xpNeed } from "./char.js";
import { ATK_KEEP } from "./arena.js";
import { bumpSc } from "./sect.js";
import { dayKey, weekKey } from "./time.js";
import { vipMod } from "./vipmod.js";
import { ITEMS } from "../data/items.js";

export const BOSS_DAILY = 3;
export const bossDaily = (c) => BOSS_DAILY + vipMod(c).boss;
export const SECT_BOSS_DAILY = 2;
const WEATHERS = [["晴", "forest"], ["雨", "water"], ["雷暴", "storm"], ["大雾", "water"], ["烈日", "forest"], ["星夜", "void"]];

export function worldFor(day) {
  const rng = makeRng(`world:${day}`);
  // the old (t <= 4) pool is drawn first, and the weather right after it, so every day that
  // predates 上界 keeps exactly the boss and weather it always had
  const bosses = MONSTERS.filter((m) => m.boss && m.t <= 4);
  let m = rng.pick(bosses);
  const [weather, env] = rng.pick(WEATHERS);
  const beyond = MONSTERS.filter((x) => x.boss && x.t >= 5);
  if (beyond.length && rng.chance(0.3)) m = rng.pick(beyond); // 三成的日子，上界的东西自己走了下来
  return { day, boss: { id: m.id, name: m.name, icon: m.icon, elem: m.elem, t: m.t, desc: m.desc }, weather, env };
}

// realm -> content tier, clamped to the table's bounds
export const tierOfRealm = (r) => TIER_OF_REALM[Math.max(0, Math.min(8, r | 0))];

// 每头 BOSS 的血量 / 输出 / 防御倍率原本差得很远（出手威胁 0.9 的百年树妖 ↔ 7.7 的堕仙），
// 而世界 BOSS 与宗门试炼是一天/一周只换一头、所有人共打的玩法：抽到哪头决定了当天能不能打得动，
// 一个写死的威能目标更是直接被 BOSS 抽签决定。这里把三项各自朝基准压一压，
// 留住各自的性格（clamp 之内），但不让极端值统治体验。调完请跑 tools/sim-boss.mjs 看离散度。
const BOSS_HP_REF = 2.2, BOSS_HP_CLAMP = [0.7, 1.4];
// 威胁 = 攻击倍率 × 最强神通倍率（用最强的，因为 chooseArt 灵力够时就往大的挑）
const BOSS_THREAT_REF = 2.5, BOSS_THREAT_CLAMP = [0.35, 1.8];
const BOSS_DEF_REF = 1.3, BOSS_DEF_CLAMP = [0.7, 1.3];
const clamp = (v, [lo, hi]) => Math.max(lo, Math.min(hi, v));
function bossUnit(bossId, tierOverride, rng, scale) {
  const m = monsterOf(bossId);
  const u = monsterUnit(bossId, rng, tierOverride);
  const hpM = m?.m?.hp || 1, atkM = m?.m?.atk || 1, defM = m?.m?.def || 1;
  const artM = u.arts.reduce((s, a) => Math.max(s, a?.mult ?? 1), 0.5);
  u.hp = Math.round(u.hp * scale * clamp(BOSS_HP_REF / hpM, BOSS_HP_CLAMP)); u.maxHp = u.hp;
  u.atk = Math.round(u.atk * clamp(BOSS_THREAT_REF / Math.max(0.3, atkM * artM), BOSS_THREAT_CLAMP));
  u.def = Math.round(u.def * 0.8 * clamp(BOSS_DEF_REF / defM, BOSS_DEF_CLAMP));
  return u;
}

function damageDealt(log) {
  let d = 0;
  for (const e of log) if (e.w === "A" && e.d) d += e.d;
  return d;
}

// World boss: everyone fights the same boss scaled to their own tier; damage is what counts.
export function attackWorldBoss(c, shared, now, effects) {
  if (c.daily.boss >= bossDaily(c)) return { ok: false, msg: "今日讨伐次数已尽" };
  if (c.trib || c.ev) return { ok: false, msg: "眼前的事还没了结" };
  const day = dayKey(now);
  const w = worldFor(day);
  const st = deriveStats(c);
  const me = buildUnit(c, st, { hpFrac: 1, mpFrac: 1 }); // 讨伐以满状态出手
  const rng = makeRng(`boss:${c.sk ?? ""}:${day}:${c.uid}:${c.ac}`);
  c.ac++;
  const tier = tierOfRealm(c.r);
  const foe = bossUnit(w.boss.id, tier, rng, 6); // the boss manifests at the challenger's own tier; the board compares normalised damage
  const res = battle(me, foe, rng, w.env);
  c.daily.boss++;
  c.stats.fights++;
  c.stats.bossHits = (c.stats.bossHits ?? 0) + 1;
  c.hpP = Math.max(0.3, res.a.hp / res.a.maxHp);
  c.mpP = Math.max(0.1, res.a.mp / res.a.maxMp);
  // normalise damage by the player's own realm power so every realm competes on the same board
  const dealt = damageDealt(res.log);
  const norm = Math.round((dealt / foe.maxHp) * 10000 * (1 + c.r * 0.15));
  const key = `bd:${day}:${c.uid}`;
  const prev = bossMine(shared, day, c.uid) ?? { uid: c.uid, n: c.name, d: 0, k: 0 };
  const rec = { uid: c.uid, n: c.name, d: (prev.d ?? 0) + norm, k: (prev.k ?? 0) + 1, t: now };
  setSharedSoft(effects, shared, key, rec); // 共享区快满时今天上不了讨伐榜，但奖励照发
  const ls = 30 + c.r * 40 + (res.win ? 50 : 0);
  c.ls += ls;
  const xp = Math.round(xpNeed(c) * 0.03);
  c.xp = Math.min(xpNeed(c) * 1.5, c.xp + xp);
  return {
    ok: true, msg: `你对${w.boss.name}造成了 ${norm} 点威能${res.win ? "，并将其击退！" : "。"} 灵石 +${ls}`, dealt: norm, total: rec.d, ls, xp,
    battle: { foe: { id: w.boss.id, name: w.boss.name, icon: w.boss.icon, elem: w.boss.elem, hp: foe.maxHp }, me: { name: c.name, r: c.r, hp: me.maxHp }, win: res.win, turns: res.turns, log: res.log },
  };
}

// bd 散键会被 bot 折叠进 bdx:<day>（配额一共 100 键）；散键总是 ≥ 折叠值（写入时拿折叠当底），
// 所以合并规则是「散键优先，折叠兜底」。
export function bossFold(shared, day) {
  return shared.get(`bdx:${day}`)?.d ?? {};
}
export function bossMine(shared, day, uid) {
  return shared.get(`bd:${day}:${uid}`) ?? bossFold(shared, day)[String(uid)] ?? null;
}
export function bossBoard(shared, day) {
  const m = { ...bossFold(shared, day) };
  for (const e of byPrefix(shared, `bd:${day}:`)) if (e.value) m[String(e.value.uid)] = e.value;
  return Object.values(m).filter(Boolean).sort((a, b) => b.d - a.d).slice(0, 50);
}

// Claim yesterday's ranking reward (derived deterministically from the damage keys).
export function claimBossReward(c, shared, now) {
  const y = dayKey(now) - 1;
  if ((c.bossClaim ?? 0) >= y) return null;
  const board = bossBoard(shared, y);
  const idx = board.findIndex((b) => String(b.uid) === String(c.uid));
  c.bossClaim = y;
  if (idx < 0) return null;
  const w = worldFor(y);
  const rank = idx + 1;
  const mult = rank === 1 ? 4 : rank <= 3 ? 3 : rank <= 10 ? 2 : 1;
  const ls = (100 + c.r * 100) * mult;
  c.ls += ls;
  const drops = [];
  const mats = ITEMS.filter((i) => i.k === "mat" && i.t === Math.min(5, tierOfRealm(c.r)));
  const rng = makeRng(`bossreward:${y}:${c.uid}`);
  for (let i = 0; i < mult; i++) { const m = rng.pick(mats); if (addStack(c, m.id, 2)) drops.push({ id: m.id, n: 2, name: m.name }); }
  if (rank === 1) c.title = `${w.boss.name}克星`;
  return { rank, ls, drops, boss: w.boss.name };
}

// Sect boss (weekly). Same mechanics, keyed by sect and week.
export function attackSectBoss(c, shared, now, effects, sectLevel) {
  if (!c.sect) return { ok: false, msg: "你没有宗门" };
  if ((c.daily.sboss ?? 0) >= SECT_BOSS_DAILY) return { ok: false, msg: "今日宗门试炼次数已尽" };
  if (c.trib || c.ev) return { ok: false, msg: "眼前的事还没了结" };
  if (c.hpP < 0.3) return { ok: false, msg: "气血不足三成" };
  const wk = weekKey(now);
  const rng0 = makeRng(`sectboss:${c.sect}:${wk}`);
  const m = rng0.pick(MONSTERS.filter((x) => x.boss));
  const st = deriveStats(c);
  const me = buildUnit(c, st);
  const rng = makeRng(`sboss:${c.sk ?? ""}:${wk}:${c.uid}:${c.ac}`);
  c.ac++;
  // 试炼之兽按挑战者自身境界显化（同世界 BOSS），宗门内各境界同榜比威能
  const foe = bossUnit(m.id, tierOfRealm(c.r), rng, 4 + (sectLevel ?? 0) * 0.5);
  const res = battle(me, foe, rng, "arena");
  c.daily.sboss = (c.daily.sboss ?? 0) + 1;
  c.hpP = Math.max(0.3, res.a.hp / res.a.maxHp);
  const dealt = damageDealt(res.log);
  const hs = c.sectB?.hs ?? 0; // 护山大阵：本宗试炼伤害 +5%/级
  const norm = Math.round((dealt / foe.maxHp) * 10000 * (1 + c.r * 0.15) * (1 + hs * 0.05));
  const key = `sbd:${c.sect}:${wk}:${c.uid}`;
  const prev = shared.get(key) ?? { d: 0, k: 0 };
  setSharedSoft(effects, shared, key, { uid: c.uid, n: c.name, d: (prev.d ?? 0) + norm, k: (prev.k ?? 0) + 1, t: now });
  const pts = Math.max(1, Math.round(norm / 200));
  // sect boss damage also counts as contribution, and as this week's 宗务 progress
  bumpSc(c, shared, effects, now, { pts, wkKey: "sb", wkVal: 1 });
  const ls = 50 + c.r * 50;
  c.ls += ls;
  return {
    ok: true, msg: `宗门试炼：对${m.name}造成 ${norm} 威能，贡献 +${pts}，灵石 +${ls}`,
    battle: { foe: { id: m.id, name: m.name, icon: m.icon, elem: m.elem, hp: foe.maxHp }, me: { name: c.name, r: c.r, hp: me.maxHp }, win: res.win, turns: res.turns, log: res.log },
  };
}
export function sectBossBoard(shared, sid, wk) {
  const rng0 = makeRng(`sectboss:${sid}:${wk}`);
  const m = rng0.pick(MONSTERS.filter((x) => x.boss));
  return { boss: { name: m.name, icon: m.icon, elem: m.elem }, board: byPrefix(shared, `sbd:${sid}:${wk}:`).map((e) => e.value).filter(Boolean).sort((a, b) => b.d - a.d).slice(0, 30) };
}

// Bot: prune old damage keys.
export function botPruneBoss(shared, now, effects) {
  const day = dayKey(now), wk = weekKey(now);
  for (const e of byPrefix(shared, "bd:")) { const d = Number(e.key.split(":")[1]); if (d < day - 2) delShared(effects, e.key); }
  for (const e of byPrefix(shared, "sbd:")) { const w = Number(e.key.split(":")[2]); if (w < wk) delShared(effects, e.key); } // 试炼榜只看本周，上周的键没人读
  // only entries older than ATK_KEEP count as gone: a defender away for a week still owes the rating
  for (const e of byPrefix(shared, "atk:")) { const list = (e.value?.list ?? []).filter((x) => now - x.t < ATK_KEEP); if (!list.length) delShared(effects, e.key); }
}
