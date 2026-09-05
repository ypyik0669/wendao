// 悬赏榜 + 成就。
// 悬赏：每日三张，随「档位」（境界段）与当日日期定，同档同日全服一致。
//   进度用当日快照差值算（kind:"s" 走 c.stats，kind:"d" 走 c.daily 的当日计数器），
//   所以不用为每张悬赏单独埋计数点：任何已有的统计都能直接当悬赏源。
// 成就：账号级，记在 legacy.ach[id]=达成时刻，转世保留；称号从已达成的成就里挑。
import { ITEMS } from "../data/items.js";
import { TIER_OF_REALM } from "../data/monsters.js";
import { ACH, achOf } from "../data/achievements.js";
import { makeRng } from "./rng.js";
import { dayKey } from "./time.js";
import { addStack } from "./inventory.js";
import { vipTitle } from "./vip.js";

export const BN_TOTAL = 3;

// kind "s" = 终身统计（c.stats[src] - 当日快照），"d" = 当日计数（c.daily[src]）。
// n = [低档, 中档, 高档] 要求；min/maxR 限境界；sect 只发给有宗门的人。
export const BN_POOL = [
  { id: "kill", name: "斩妖", src: "kills", kind: "s", n: [5, 8, 10], text: "山下妖气重了，去清一清。" },
  { id: "roam", name: "踏遍山河", src: "explores", kind: "s", n: [5, 8, 10], text: "脚下的路，自己不会走完。" },
  { id: "breath", name: "吐纳", src: "breath", kind: "d", n: [5, 10, 15], text: "一呼一吸，皆是修行。" },
  { id: "craft", name: "开炉", src: "crafts", kind: "s", n: [1, 3, 5], text: "炉火不熄，方有丹器出世。" },
  { id: "aw", name: "论道", src: "aw", kind: "s", n: [1, 2, 3], min: 1, text: "以战证道，胜者得意。" },
  { id: "boss", name: "讨伐", src: "bossHits", kind: "s", n: [1, 2, 3], text: "凶兽当道，同道皆可出手。" },
  { id: "don", name: "捐献", src: "dons", kind: "s", n: [1, 1, 1], sect: true, text: "山门修缮，缺的从来是灵石。" },
  { id: "sboss", name: "宗门试炼", src: "sboss", kind: "d", n: [1, 2, 2], sect: true, text: "护山阵外那头东西又来了。" },
  { id: "sell", name: "坊市", src: "sells", kind: "s", n: [2, 3, 5], text: "囤着不用的，不如换灵石。" },
  { id: "pill", name: "服丹", src: "pills", kind: "s", n: [1, 2, 3], text: "药性入腹，须得压得住。" },
  { id: "win", name: "不败", src: "wins", kind: "s", n: [3, 5, 8], text: "赢下来的才算数。" },
  { id: "fight", name: "出手", src: "fights", kind: "s", n: [5, 8, 12], text: "手别生了。" },
  { id: "bt", name: "精进", src: "bt", kind: "s", n: [1, 1, 1], maxR: 2, text: "境界卡着，就往前顶一顶。" },
  { id: "arena", name: "切磋", src: "arena", kind: "d", n: [2, 3, 5], min: 1, text: "论道台上，点到为止。" },
  // v6 的新玩法也得进池子，不然新内容和每日动线是断开的
  { id: "dg", name: "探秘", src: "dg", kind: "s", n: [1, 1, 2], text: "秘境的门又开了，进去走一趟。" },
  { id: "farm", name: "农事", src: "harvests", kind: "s", n: [1, 2, 3], text: "药圃里的东西，熟了就得收。" },
  { id: "wx", name: "落子", src: "wx", kind: "d", n: [1, 1, 1], text: "五行棋盘一日一局，别忘了。" },
  { id: "refine", name: "淬炼", src: "refines", kind: "s", n: [1, 2, 3], min: 1, text: "炉火再旺些，法宝还能更利。" },
];

// 每日快照会把 c.stats 整个拷一份；池子用到的键要先补 0，否则老角色的差值会算成 NaN。
const BN_KNOWN = BN_POOL.filter((t) => t.kind === "s").map((t) => t.src);

export function bnBracket(r) {
  return r <= 1 ? 0 : r <= 4 ? 1 : 2;
}
function bnTpl(id) {
  for (const t of BN_POOL) if (t.id === id) return t;
  return null;
}
// 不存在的计数键（例如别的模块还没上线）自动跳过，池子少一条也照样出三张。
function bnPoolFor(c) {
  return BN_POOL.filter((t) => {
    if (t.sect && !c.sect) return false;
    if (t.min !== undefined && c.r < t.min) return false;
    if (t.maxR !== undefined && c.r > t.maxR) return false;
    if (t.kind === "s" && (c.stats?.[t.src] === undefined)) return false;
    return true;
  });
}

// housekeeping：settle 之后跑。当日第一次进来时冻结统计快照并抽三张悬赏。
export function ensureBountyDay(c, now) {
  if (!c || !c.daily) return;
  if (!c.stats) c.stats = {};
  for (const k of BN_KNOWN) c.stats[k] ??= 0;
  c.daily.bs ??= { ...c.stats };
  // 档位和三张悬赏一起冻结：bnBracket 的分界线正好压在筑基→金丹、化神→炼虚两次渡劫上，
  // 读实时境界的话，当天渡个劫就会把已经打勾的悬赏退回未完成，连击也跟着断。
  c.daily.br ??= bnBracket(c.r);
  c.daily.bo ??= makeRng(`bounty:${dayKey(now)}:${c.daily.br}`).shuffle(bnPoolFor(c).map((t) => t.id)).slice(0, BN_TOTAL + ((c.vip | 0) >= 1 ? 1 : 0));
}

export function bnProgress(c, t) {
  if (!t) return 0;
  if (t.kind === "d") return Math.max(0, Number(c.daily?.[t.src]) || 0);
  return Math.max(0, (Number(c.stats?.[t.src]) || 0) - (Number(c.daily?.bs?.[t.src]) || 0));
}
function bnNeed(c, t) {
  return t.n[Math.min(t.n.length - 1, c.daily?.br ?? bnBracket(c.r))];
}
function bnList(c) {
  const ids = Array.isArray(c.daily?.bo) ? c.daily.bo : [];
  const out = [];
  for (let i = 0; i < ids.length; i++) {
    const t = bnTpl(ids[i]);
    if (!t) continue;
    const cur = bnProgress(c, t), need = bnNeed(c, t);
    out.push({ i, id: t.id, name: t.name, text: t.text, cur: Math.min(cur, need), need, done: cur >= need, claimed: !!c.daily.claim?.["b" + i], ls: 40 + 40 * c.r });
  }
  return out;
}
// 当前境界该掉哪一档材料；那一档没有材料就往下找。
function bnMat(c, rng) {
  const top = TIER_OF_REALM[Math.max(0, Math.min(8, c.r | 0))] ?? 0;
  for (let t = top; t >= 0; t--) {
    const pool = ITEMS.filter((x) => x.k === "mat" && x.t === t);
    if (pool.length) return rng ? rng.pick(pool) : pool[0];
  }
  return null;
}

export function bountyView(c) {
  const list = bnList(c);
  const streak = c.bountyStreak ?? 0;
  return {
    list, doneN: list.filter((x) => x.done).length, total: list.length,
    allClaimed: !!c.daily.claim?.all, streak,
    allReward: { wu: 1, chestIn: 7 - (streak % 7) },
  };
}
export function bountyHome(c) {
  const list = bnList(c);
  return { done: list.filter((x) => x.done).length, total: list.length || BN_TOTAL, claimable: list.some((x) => x.done && !x.claimed) };
}

export function claimBounty(c, now, i, rng) {
  ensureBountyDay(c, now);
  const list = bnList(c);
  const idx = Math.floor(Number(i));
  const b = list.find((x) => x.i === idx);
  if (!b) return { ok: false, msg: "无此悬赏" };
  if (b.claimed) return { ok: false, msg: "此赏已领" };
  if (!b.done) return { ok: false, msg: `尚未完成（${b.cur}/${b.need}）` };
  c.daily.claim ??= {};
  c.daily.claim["b" + idx] = 1;
  c.ls += b.ls;
  const drops = [];
  const m = bnMat(c, rng);
  if (m && addStack(c, m.id, 1)) drops.push({ id: m.id, name: m.name, n: 1, t: m.t });
  const out = { ok: true, msg: `悬赏「${b.name}」结清，灵石 +${b.ls}` + (drops.length ? `，${drops[0].name}×1` : ""), ls: b.ls, drops, all: null };
  const after = bnList(c);
  if (after.length && after.every((x) => x.claimed) && !c.daily.claim.all) {
    c.daily.claim.all = 1;
    const day = dayKey(now);
    // 转世会换掉整个 c（daily.claim 归零），但 bountyLast/bountyStreak 是随身带过去的：
    // 同一天再把三张做完一次，既不该再发一次悟性，也不该把连击打回 1。
    const again = c.bountyLast === day;
    if (!again) c.wu = (c.wu ?? 0) + 1;
    c.bountyStreak = again ? (c.bountyStreak ?? 1) : c.bountyLast === day - 1 ? (c.bountyStreak ?? 0) + 1 : 1;
    c.bountyLast = day;
    const all = { wu: again ? 0 : 1, streak: c.bountyStreak, chest: null };
    if (!again && c.bountyStreak % 7 === 0) {
      const cls = 500 + 200 * c.r;
      c.ls += cls;
      const cd = [];
      for (let k = 0; k < 2; k++) { const mm = bnMat(c, rng); if (mm && addStack(c, mm.id, 1)) cd.push({ id: mm.id, name: mm.name, n: 1, t: mm.t }); }
      all.chest = { ls: cls, drops: cd };
      for (const d of cd) drops.push(d);
      out.msg += `。三赏皆结，悟性 +1；连续 ${c.bountyStreak} 日，天降宝匣：灵石 +${cls}`;
    } else {
      out.msg += again ? `。三赏皆结（今日已领过，连续 ${c.bountyStreak} 日）` : `。三赏皆结，悟性 +1（已连续 ${c.bountyStreak} 日）`;
    }
    out.all = all;
  }
  return out;
}

// housekeeping 末尾跑：首次达成即记账发奖，legacy._dirty 交给 core 落盘。
export function checkAchievements(c, legacy, shared, notes, now) {
  if (!legacy) return 0;
  legacy.ach ??= {};
  let n = 0;
  for (const a of ACH) {
    if (legacy.ach[a.id]) continue;
    let ok = false;
    try { ok = !!a.cond(c, legacy, shared); } catch { ok = false; }
    if (!ok) continue;
    legacy.ach[a.id] = now;
    if (a.ls) c.ls += a.ls;
    if (a.wu) c.wu = (c.wu ?? 0) + a.wu;
    n++;
    if (notes && n <= 5) notes.push({ k: "ach", v: `成就 · ${a.name}` + (a.ls ? `，灵石 +${a.ls}` : "") + (a.wu ? `，悟性 +${a.wu}` : "") + (a.title ? `，得称号「${a.title}」` : "") });
  }
  if (n) legacy._dirty = true;
  return n;
}

export function achView(c, legacy) {
  const got = legacy?.ach ?? {};
  const list = ACH.map((a) => ({ id: a.id, name: a.name, desc: a.desc, ls: a.ls ?? 0, wu: a.wu ?? 0, title: a.title ?? null, done: !!got[a.id] }));
  const titles = list.filter((a) => a.done && a.title).map((a) => ({ id: a.id, title: a.title }));
  if ((c.vip | 0) >= 2) titles.unshift({ id: "vip", title: vipTitle(c.vip | 0) });
  return { list, done: list.filter((a) => a.done).length, total: ACH.length, titles, cur: c.title ?? null };
}
export function setAchTitle(c, legacy, id) {
  if (id === null || id === undefined || id === "" || id === "null") { c.title = null; return { ok: true, msg: "已摘下称号" }; }
  if (String(id) === "vip") { if ((c.vip | 0) < 2) return { ok: false, msg: "VIP2 起方可佩戴" }; c.title = vipTitle(c.vip | 0); return { ok: true, msg: `已佩戴「${c.title}」` }; }
  const a = achOf(String(id));
  if (!a || !a.title) return { ok: false, msg: "无此称号" };
  if (!(legacy?.ach ?? {})[a.id]) return { ok: false, msg: "尚未达成此成就" };
  c.title = a.title;
  return { ok: true, msg: `称号已改为「${a.title}」` };
}
