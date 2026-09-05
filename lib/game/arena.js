import { profiles, profileOf, atkOf, atkAll, setShared, setSharedSoft } from "./shared.js";
import { makeRng } from "./rng.js";
import { deriveStats, buildUnit, unitFromSnapshot } from "./stats.js";
import { battle } from "./battle.js";
import { xpNeed } from "./char.js";
import { bumpSc } from "./sect.js";
import { dayKey, DAY } from "./time.js";
import { vipMod } from "./vipmod.js";

export const ARENA_DAILY = 5;
export const arenaDaily = (c) => ARENA_DAILY + vipMod(c).arena;
// A defender can be away this long and still pay for the losses; the bot prunes on the same period.
export const ATK_KEEP = 14 * DAY;
const K = 32;

// The opponents are fixed per (day, uid, refresh): the uids are stored on the character the first
// time the list is built and dropped by 换一批 or the daily reset. Sorting by |their ar - my ar|
// only happens then, so a rating change between render and click (syncDefense moves `season.ar` on
// any load) can no longer invalidate the list the page is showing.
export function candidates(c, shared, now) {
  const pool = profiles(shared).filter((p) => p.uid !== c.uid && p.b && !p.dead);
  const byUid = new Map(pool.map((p) => [String(p.uid), p]));
  let picks = (c.daily.arenaPool ?? []).map((u) => byUid.get(String(u))).filter(Boolean);
  if (!picks.length) {
    const me = c.season.ar ?? 1000;
    const nearby = pool.slice().sort((a, b) => Math.abs((a.ar ?? 1000) - me) - Math.abs((b.ar ?? 1000) - me)).slice(0, 20);
    const rng = makeRng(`arena:${dayKey(now)}:${c.uid}:${c.daily.arenaRefresh ?? 0}`);
    picks = rng.shuffle(nearby).slice(0, 5);
    c.daily.arenaPool = picks.map((p) => String(p.uid));
  }
  return picks.map((p) => ({ uid: p.uid, n: p.n, r: p.r, s: p.s, pw: p.pw, ar: p.ar ?? 1000, pa: p.pa ?? null, sect: p.sect ?? null, xie: p.pa === "xie", title: p.title ?? null }));
}

export function refresh(c) {
  if ((c.daily.arenaRefresh ?? 0) >= 3) return { ok: false, msg: "今日已换过三次对手" };
  c.daily.arenaRefresh = (c.daily.arenaRefresh ?? 0) + 1;
  c.daily.arenaPool = null; // rebuilt by the next candidates() call, with the new refresh seed
  return { ok: true, msg: "对手已更换" };
}

function expected(a, b) {
  return 1 / (1 + Math.pow(10, (b - a) / 400));
}

export function fight(c, shared, now, targetUid, effects) {
  if (c.daily.arena >= arenaDaily(c)) return { ok: false, msg: "今日论道次数已尽" };
  if (c.trib || c.ev) return { ok: false, msg: "眼前的事还没了结" };
  const list = candidates(c, shared, now);
  const target = list.find((p) => String(p.uid) === String(targetUid));
  if (!target) return { ok: false, msg: "此人不在今日对手之列" };
  const p = profileOf(shared, target.uid); // 散键可能已被折进 px: 桶
  if (!p) return { ok: false, msg: "对方已不在榜" };
  const st = deriveStats(c);
  // 论道是切磋：双方都以满状态上台（守方快照本就是满状态），不带伤入场
  const me = buildUnit(c, st, { hpFrac: 1, mpFrac: 1 });
  const foe = unitFromSnapshot(p);
  const rng = makeRng(`arena:${c.sk ?? ""}:${now}:${c.uid}:${target.uid}:${c.ac}`);
  c.ac++;
  const res = battle(me, foe, rng, "arena");
  c.daily.arena++;
  c.stats.fights++;
  const myAr = c.season.ar ?? 1000, theirAr = p.ar ?? 1000;
  const exp = expected(myAr, theirAr);
  const delta = Math.round(K * ((res.win ? 1 : 0) - exp));
  c.season.ar = Math.max(100, myAr + delta);
  let ss = res.win ? 10 + Math.max(0, Math.round((theirAr - myAr) / 20)) : 2;
  if (res.win && p.pa === "xie" && c.path !== "xie") ss += 5; // 除魔卫道
  if (res.win && c.path === "xie") ss += 3; // 邪修以战养战
  c.season.ss = (c.season.ss ?? 0) + ss;
  if (res.win) {
    c.season.w++; c.stats.wins++;
    c.stats.aw = (c.stats.aw ?? 0) + 1; // 终身论道胜场：悬赏与成就都读它
    if (c.sect) bumpSc(c, shared, effects, now, { wkKey: "aw", wkVal: 1 });
  } else c.season.l++;
  const ls = res.win ? 20 + c.r * 30 : 5 + c.r * 5;
  c.ls += ls;
  const xp = Math.round(xpNeed(c) * (res.win ? 0.02 : 0.005));
  c.xp = Math.min(xpNeed(c) * 1.5, c.xp + xp);
  // record for the defender to pick up
  const rec = atkOf(shared, c.uid) ?? { uid: c.uid, list: [] }; // 从桶接种：散键被清后旧账不丢
  const list2 = (rec.list ?? []).filter((x) => now - x.t < ATK_KEEP).slice(-9); // 每日至多 5 次论道，留 10 条够守方隔天来结；再多纯属占共享区
  list2.push({ t: now, d: target.uid, n: c.name, w: res.win, dr: delta });
  setSharedSoft(effects, shared, `atk:${c.uid}`, { uid: c.uid, list: list2 }); // 快满 100 键时宁可不记，也别把整场论道顶回去
  return {
    ok: true, win: res.win, delta, ss, ls, xp,
    msg: res.win ? `你胜了${target.n}。论道值 ${delta >= 0 ? "+" : ""}${delta}，赛季积分 +${ss}` : `败于${target.n}。论道值 ${delta}，赛季积分 +${ss}`,
    battle: { foe: { name: target.n, r: p.r ?? 0, hp: foe.maxHp, elem: foe.elem, pa: p.pa ?? null }, me: { name: c.name, r: c.r, hp: me.maxHp }, win: res.win, turns: res.turns, log: res.log },
  };
}

// Apply attacks made against me since last sync. Returns notifications.
export function syncDefense(c, shared, now) {
  const since = c.season.sync ?? 0;
  const seen = new Set(c.defSeen ?? []);
  const notes = [];
  const applied = [];
  let delta = 0;
  for (const rec of atkAll(shared)) {
    for (const x of rec.list ?? []) {
      if (String(x.d) !== String(c.uid) || x.t < since) continue;
      const key = `${rec.uid}:${x.t}:${x.d}`;
      if (seen.has(key)) continue;
      const d = x.w ? -Math.abs(x.dr) : Math.abs(x.dr);
      delta += d;
      notes.push({ t: x.t, n: x.n, w: !x.w, dr: d });
      applied.push({ key, t: x.t });
    }
  }
  if (notes.length) {
    c.season.ar = Math.max(100, (c.season.ar ?? 1000) + delta);
    notes.sort((a, b) => b.t - a.t);
    c.defLog = notes.slice(0, 10).concat(c.defLog ?? []).slice(0, 10);
  }
  // remember entries stamped at the new boundary so an attack in the same millisecond is never applied twice
  c.defSeen = applied.filter((a) => a.t >= now).map((a) => a.key).slice(-50);
  c.season.sync = now;
  return notes;
}
