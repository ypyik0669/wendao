import { deriveStats, buildSnapshot } from "./stats.js";
import { profiles, profileOf, setSharedSoft } from "./shared.js";
import { realmName } from "../data/realms.js";
import { sectList } from "./sect.js";
import { DAY, weekKey } from "./time.js";

export function makeProfile(c, now) {
  const st = deriveStats(c);
  return {
    uid: c.uid, n: c.name, r: c.r, s: c.s, pw: st.power, pa: c.path ?? null, sub: c.sub ?? null, sect: c.sect ?? null,
    ar: c.season.ar ?? 1000, ss: c.season.ss ?? 0, sn: c.season.n ?? 0, ls: Math.round(c.ls), lives: c.lives ?? 1,
    title: c.title ?? null, asc: c.ascended ? 1 : 0, dead: c.dead ? 1 : 0, b: buildSnapshot(c, st), t: now,
    dgw: c.dgBest ? [c.dgBest.wk, c.dgBest.d, c.dgBest.t] : undefined,
    m: c.mentor ? c.mentor.uid : undefined, mr: c.mentor ? c.mentor.r0 : undefined, vp: c.vip ? c.vip : undefined, vt: c.vip && c.vt ? c.vt : undefined,
  };
}

// Write the profile if anything visible changed, or it is older than a day (keeps `t` fresh for pruning).
export function syncProfile(c, shared, now, effects) {
  const next = makeProfile(c, now);
  const prev = profileOf(shared, c.uid); // 散键被折进桶后：没变化就不必重建散键，t 也以桶里那份为准
  const strip = (p) => { const { t, ...rest } = p ?? {}; return JSON.stringify(rest); };
  if (!prev || strip(prev) !== strip(next) || now - (prev.t ?? 0) > DAY) {
    // 共享区快满时宁可这次不上榜，也别让整批 effects（连同存档）被顶回去 ——
    // 新玩家「定下道号」写的第一个共享键就是这个，配额满时他们看到的是「仙府典籍已满，玩不了」。
    if (setSharedSoft(effects, shared, `p:${c.uid}`, next, 2)) shared.set(`p:${c.uid}`, next);
  }
}

const ROW = (p) => ({ uid: p.uid, n: p.n, realm: realmName(p.r, p.s), r: p.r, s: p.s, pw: p.pw, pa: p.pa, sect: p.sect, title: p.title, asc: p.asc, lives: p.lives, vip: p.vp ?? 0 });

export function leaderboards(c, shared, type, now = 0) {
  const all = profiles(shared).filter((p) => !p.dead);
  let rows;
  switch (type) {
    case "power": rows = all.sort((a, b) => (b.pw ?? 0) - (a.pw ?? 0)).map((p) => ({ ...ROW(p), v: p.pw })); break;
    case "arena": rows = all.filter((p) => p.b).sort((a, b) => (b.ar ?? 0) - (a.ar ?? 0)).map((p) => ({ ...ROW(p), v: p.ar })); break;
    case "season": rows = all.sort((a, b) => (b.ss ?? 0) - (a.ss ?? 0)).map((p) => ({ ...ROW(p), v: p.ss })); break;
    case "wealth": rows = all.sort((a, b) => (b.ls ?? 0) - (a.ls ?? 0)).map((p) => ({ ...ROW(p), v: p.ls })); break;
    case "sect": return { type, rows: sectList(shared).slice(0, 50).map((s, i) => ({ rank: i + 1, n: s.name, v: s.total, sub: `${s.leaderName} · ${s.members} 人 · ${s.level} 级` })), me: null };
    case "dg": rows = all.filter((p) => Array.isArray(p.dgw) && p.dgw[0] === weekKey(now)).sort((a, b) => (b.dgw[1] - a.dgw[1]) || (a.dgw[2] - b.dgw[2])).map((p) => ({ ...ROW(p), v: `第 ${p.dgw[1]} 层` })); break;
    case "xian": rows = profiles(shared).filter((p) => p.asc).sort((a, b) => (b.pw ?? 0) - (a.pw ?? 0)).map((p) => ({ ...ROW(p), v: p.pw })); break;
    default: rows = all.sort((a, b) => (b.r - a.r) || (b.s - a.s) || ((b.pw ?? 0) - (a.pw ?? 0))).map((p) => ({ ...ROW(p), v: realmName(p.r, p.s) }));
  }
  const meIdx = rows.findIndex((r) => String(r.uid) === String(c?.uid));
  return { type, rows: rows.slice(0, 50).map((r, i) => ({ rank: i + 1, ...r })), me: meIdx >= 0 ? { rank: meIdx + 1, ...rows[meIdx] } : null, total: rows.length };
}
