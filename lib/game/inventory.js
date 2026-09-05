import { rollRoot } from "../data/roots.js";
import { makeRng } from "./rng.js";
import { itemOf, AFFIXES } from "../data/items.js";
import { gongfaOf, artOf, GONGFA, ARTS } from "../data/skills.js";
import { HOUR } from "./time.js";
import { TOX_MAX, STAMINA_PILL_DAILY } from "./stats.js";
import { pathOf } from "../data/paths.js";
import { xpNeed } from "./char.js";

export const STACK_CAP = 60;
export const ART_CAP = 30;
const STACKABLE = new Set(["mat", "pill", "tal", "egg", "misc", "book"]);

export function countOf(c, id) {
  return c.inv.stack[id] ?? 0;
}
export function hasItems(c, list) {
  return (list ?? []).every(([id, n]) => n <= 0 || countOf(c, id) >= n);
}
export function removeItems(c, list) {
  for (const [id, n] of list ?? []) {
    if (n <= 0) continue;
    const left = (c.inv.stack[id] ?? 0) - n;
    if (left > 0) c.inv.stack[id] = left;
    else delete c.inv.stack[id];
  }
}
// 种子与典籍不占格（玩家原话：种子多到种不完、行囊 60/60 装不下）；其余每一种占一格。
export const bagFree = (def) => !!def && (def.k === "book" || !!def.fx?.seed);
export const bagUsed = (c) => Object.keys(c.inv.stack).filter((id) => !bagFree(itemOf(id))).length;
// Returns false if the bag is full (item discarded).
export function addStack(c, id, n) {
  const def = itemOf(id);
  if (!def || !STACKABLE.has(def.k) || n <= 0) return false;
  if (!(id in c.inv.stack) && !bagFree(def) && bagUsed(c) >= STACK_CAP) return false;
  c.inv.stack[id] = (c.inv.stack[id] ?? 0) + n;
  return true;
}

// Roll one affix for an artifact definition, avoiding stats already present.
export function rollAffix(def, t, rng, excludeSts = []) {
  const main = Math.max(...Object.values(def.st ?? { atk: 1 }), 1);
  const pool = AFFIXES.filter((a) => !excludeSts.includes(a.st));
  const a = rng.pick(pool.length ? pool : AFFIXES);
  let v;
  if (a.st === "crit" || a.st === "rate") v = +(a.base * (1 + t * 0.5) * (0.8 + rng.next() * 0.6)).toFixed(3);
  else v = Math.max(1, Math.round(main * a.base * (1 + t) * (0.8 + rng.next() * 0.6)));
  return { st: a.st, v, n: a.name };
}
export const AFFIX_MAX = [1, 2, 2, 3, 3, 3];

export function rollArtifact(c, id, rng, opts = {}) {
  const def = itemOf(id);
  if (!def || def.k !== "art") return null;
  if (c.inv.arts.length >= ART_CAP) return null;
  const t = def.t;
  const forgeBonus = opts.forge ? (pathOf(c.path)?.mods?.forge ?? 0) : 0;
  const nAf = Math.min(AFFIX_MAX[t] ?? 3, ([0, 1, 1, 2, 2, 2][t] ?? 2) + (rng.chance(0.3 + forgeBonus) ? 1 : 0));
  const q = Math.min(5, 1 + rng.weighted([[0, 40], [1, 30], [2, 18], [3, 9], [4, 3]]) + (opts.forge && rng.chance(forgeBonus) ? 1 : 0));
  const af = [];
  for (let i = 0; i < nAf; i++) af.push(rollAffix(def, t, rng, af.map((x) => x.st)));
  c.ic = (c.ic ?? 0) + 1;
  const it = { iid: c.ic, id, q, af };
  c.inv.arts.push(it);
  return it;
}

export function artifactOf(c, iid) {
  return c.inv.arts.find((a) => a.iid === iid) ?? null;
}
export function equip(c, iid) {
  const it = artifactOf(c, iid);
  if (!it) return { ok: false, msg: "没有这件法宝" };
  const def = itemOf(it.id);
  if (def.t > c.r + 1) return { ok: false, msg: "境界不足，无法驾驭此宝" };
  c.eq[def.slot] = iid;
  return { ok: true, msg: `已祭炼 ${def.name}` };
}
export function unequip(c, slot) {
  if (!["w", "a", "r"].includes(slot)) return { ok: false, msg: "无此部位" };
  c.eq[slot] = null;
  return { ok: true, msg: "已卸下" };
}

export function sellValue(id, n = 1, q = 1) {
  const def = itemOf(id);
  if (!def) return 0;
  return Math.floor(def.v * 0.5 * n * (1 + (q - 1) * 0.15));
}
export function sell(c, id, n) {
  const def = itemOf(id);
  if (!def) return { ok: false, msg: "无此物品" };
  if (def.k === "book") return { ok: false, msg: "典籍坊市不收，去拍卖行上拍" };
  n = Math.max(1, Math.floor(Number(n) || 1));
  if (countOf(c, id) < n) return { ok: false, msg: "数量不足" };
  removeItems(c, [[id, n]]);
  const v = sellValue(id, n);
  c.ls += v;
  c.stats.sells = (c.stats.sells ?? 0) + 1;
  return { ok: true, msg: `卖出 ${def.name}×${n}，得 ${v} 灵石`, ls: v };
}
export function sellArtifact(c, iid) {
  const it = artifactOf(c, iid);
  if (!it) return { ok: false, msg: "无此法宝" };
  for (const s of ["w", "a", "r"]) if (c.eq[s] === iid) c.eq[s] = null;
  c.inv.arts = c.inv.arts.filter((a) => a.iid !== iid);
  const v = sellValue(it.id, 1, it.q);
  c.ls += v;
  c.stats.sells = (c.stats.sells ?? 0) + 1;
  return { ok: true, msg: `卖出 ${itemOf(it.id).name}，得 ${v} 灵石`, ls: v };
}

// Use a consumable. `now` for buffs. Returns {ok,msg}.
export function useItem(c, id, now, st, opts = {}) {
  const def = itemOf(id);
  if (!def || countOf(c, id) < 1) return { ok: false, msg: "没有这件物品" };
  if (def.fx?.learn) {
    // 典籍：道途不合的不让学（学了也装备不上），留着上拍
    const sid = def.fx.learn, isG = sid.startsWith("g_");
    const sk = isG ? gongfaOf(sid) : artOf(sid);
    if (sk.path && sk.path !== c.path) return { ok: false, msg: `此书是${pathOf(sk.path)?.name ?? ""}专修，与你道途不合——不如去坊市上拍，卖给用得上的道友` };
    if (isG && sk.demon && c.path !== "xie" && c.r >= 1) return { ok: false, msg: "此乃魔功，非邪修不可修——不如去坊市上拍，卖给邪修道友" };
    if ((isG ? c.gfs : c.arts).includes(sid)) return { ok: false, msg: "已习得，留着可上拍" };
    const r = isG ? learnGongfa(c, sid) : learnArt(c, sid);
    if (!r.ok) return r;
    removeItems(c, [[id, 1]]);
    return { ok: true, msg: r.msg };
  }
  if (def.fx?.reroot) {
    // 洗髓丹：不占三次改命额度，踏上仙路之后也可用
    removeItems(c, [[id, 1]]);
    c.tox = Math.min(TOX_MAX, (c.tox ?? 0) + (def.fx.tox ?? 0));
    c.root = rollRoot(opts.rng ?? makeRng(`${c.uid}:${c.sk}:${now}:${c.ac = (c.ac ?? 0) + 1}`));
    return { ok: true, msg: `洗髓已毕，灵根重定：${c.root.e.join("")}`, reroot: true };
  }
  if (def.k === "pill") {
    const fx = def.fx;
    const pillMult = st?.pathMods?.pill ?? 1;
    const toxMult = st?.pathMods?.toxin ?? 1;
    const tox = (fx.tox ?? 0) * toxMult;
    if (fx.bt !== undefined) {
      if (fx.realm !== c.r) return { ok: false, msg: `此丹只对${["炼气", "筑基", "金丹", "元婴", "化神", "炼虚", "合体", "大乘", "渡劫"][fx.realm]}期有效` };
      if (c.pillBt) return { ok: false, msg: "已服用过突破丹药，药力尚在" };
    }
    if (c.tox + tox > TOX_MAX && !fx.detox) return { ok: false, msg: "丹毒已深，再服必走火入魔" };
    if (fx.tribHeal && !c.trib) return { ok: false, msg: "此丹需在渡劫时服用（渡劫界面的定心丹按钮）" };
    if (fx.st) {
      if ((c.daily.stp ?? 0) >= STAMINA_PILL_DAILY) return { ok: false, msg: `辟谷之丹一日至多 ${STAMINA_PILL_DAILY} 颗，再服无益` };
      if (c.st >= (st?.staminaMax ?? c.st)) return { ok: false, msg: "体力正满，留着路上用" };
    }
    if (fx.xp && !fx.heal && !fx.mp && !fx.detox && c.xp >= xpNeed(c) * 1.5) return { ok: false, msg: "修为已至此境上限，先突破再服" };
    removeItems(c, [[id, 1]]);
    c.tox = Math.min(TOX_MAX, c.tox + tox);
    c.stats.pills++;
    const parts = [];
    if (fx.xp) {
      // settle() truncates anything past need*1.5, so clamp here and report what was actually gained
      const gain = Math.min(fx.xp * pillMult, xpNeed(c) * 1.5 - c.xp);
      if (gain > 0) { c.xp += gain; parts.push(`修为 +${Math.round(gain)}`); }
      else parts.push("修为已至此境上限");
    }
    if (fx.heal) { c.hpP = Math.min(1, c.hpP + fx.heal * pillMult); parts.push("气血回复"); }
    if (fx.mp) { c.mpP = Math.min(1, c.mpP + fx.mp * pillMult); parts.push("灵力回复"); }
    if (fx.st) {
      const cap = st?.staminaMax ?? c.st + fx.st;
      const got = Math.min(fx.st, Math.max(0, cap - c.st));
      c.st += got;
      c.daily.stp = (c.daily.stp ?? 0) + 1;
      parts.push(`体力 +${got}`);
    }
    if (fx.rate) { c.buffs.push({ k: "rate", m: 1 + (fx.rate.mult - 1) * pillMult, from: now, until: now + fx.rate.hours * HOUR, n: def.name }); parts.push(`修炼加速 ${fx.rate.hours} 小时`); }
    if (fx.bt !== undefined) { c.pillBt = fx.bt * pillMult; parts.push(`下次突破成功率 +${Math.round(c.pillBt * 100)}%`); }
    if (fx.life) { c.lifeBonus = (c.lifeBonus ?? 0) + Math.round(fx.life * pillMult); parts.push(`寿元 +${Math.round(fx.life * pillMult)} 年`); }
    if (fx.cure) { c.dbf = {}; parts.push("伤势与心魔尽去"); }
    if (fx.detox) { c.tox = Math.max(0, c.tox - fx.detox); parts.push(`丹毒 -${fx.detox}`); }
    return { ok: true, msg: `服下${def.name}：${parts.join("，")}${tox ? `（丹毒 +${Math.round(tox)}）` : ""}` };
  }
  if (def.k === "egg") {
    if (c.pet && !opts.confirm) return { ok: false, confirm: true, msg: `已有灵兽「${c.pet.name}」，再孵化会让它离去` };
    removeItems(c, [[id, 1]]);
    c.pet = { id, name: def.pet.name, elem: def.pet.elem, atk: def.pet.atk, hp: def.pet.hp, lv: 0, xp: 0, hpP: 1, ev: 0, trip: null };
    return { ok: true, msg: `${def.pet.name}破壳而出，与你结下契约。` };
  }
  if (def.k === "misc" && def.fx?.array) {
    if ((c.array ?? 0) >= def.fx.array) return { ok: false, msg: "洞府已有同等或更好的阵法" };
    removeItems(c, [[id, 1]]);
    c.array = def.fx.array;
    return { ok: true, msg: "聚灵阵已布下，洞府灵气渐浓。" };
  }
  if (def.fx?.biguan) {
    removeItems(c, [[id, 1]]);
    c.biguan = Math.max(c.biguan ?? 0, now) + def.fx.biguan * HOUR;
    return { ok: true, msg: `闭关符已贴，${def.fx.biguan} 小时内离线修炼上限 +12 小时。` };
  }
  if (def.fx?.ripen) {
    const plots = (c.farm?.plots ?? []).filter((p) => p && p.ready > now && !p.withered);
    if (!plots.length) return { ok: false, msg: "灵田里没有正在生长的作物" };
    plots.sort((a, b) => a.ready - b.ready)[0].ready = now;
    removeItems(c, [[id, 1]]);
    return { ok: true, msg: "符光一闪，一块灵田的作物熟了。" };
  }
  if (def.k === "misc" && def.fx?.rate) {
    removeItems(c, [[id, 1]]);
    c.buffs = (c.buffs ?? []).filter((b) => b.k !== "rate" || (b.until ?? 0) > now);
    c.buffs.push({ k: "rate", m: def.fx.rate.mult, from: now, until: now + def.fx.rate.hours * HOUR, n: def.name });
    return { ok: true, msg: `${def.name}已燃起，${def.fx.rate.hours} 小时内修炼 +${Math.round((def.fx.rate.mult - 1) * 100)}%。` };
  }
  if (def.k === "misc" && def.fx?.legacy) {
    removeItems(c, [[id, 1]]);
    c.legacyBonus = (c.legacyBonus ?? 0) + def.fx.legacy;
    return { ok: true, msg: `传承玉简已炼化，轮回时额外保留 ${def.fx.legacy} 点道统。` };
  }
  return { ok: false, msg: "此物无法直接使用" };
}

export function learnGongfa(c, id) {
  const g = gongfaOf(id);
  if (!GONGFA.some((x) => x.id === id)) return { ok: false, msg: "无此功法" };
  if (c.gfs.includes(id)) return { ok: false, msg: "已习得" };
  c.gfs.push(id);
  return { ok: true, msg: `习得功法《${g.name}》` };
}
export function learnArt(c, id) {
  const a = artOf(id);
  if (!ARTS.some((x) => x.id === id)) return { ok: false, msg: "无此神通" };
  if (c.arts.includes(id)) return { ok: false, msg: "已习得" };
  c.arts.push(id);
  return { ok: true, msg: `习得神通「${a.name}」` };
}
// 封存：把已学的功法/神通抄成一册秘籍（自己就不会了），拿去上拍。剑修手里的血魔功就靠这个变现。
export const BOOK_BASIC = new Set(["g_tuna", "a_slash", "a_fire"]);
export function sealBook(c, sid) {
  sid = String(sid ?? "");
  const isG = sid.startsWith("g_");
  if (BOOK_BASIC.has(sid) || !itemOf("b_" + sid)) return { ok: false, msg: "此技不可封存" };
  if (!(isG ? c.gfs : c.arts).includes(sid)) return { ok: false, msg: "尚未习得" };
  if (isG ? c.gf === sid : c.eqArts.includes(sid)) return { ok: false, msg: "正在修炼或出战中，先换下再封存" };
  if (!addStack(c, "b_" + sid, 1)) return { ok: false, msg: "行囊已满" };
  if (isG) c.gfs = c.gfs.filter((x) => x !== sid); else c.arts = c.arts.filter((x) => x !== sid);
  return { ok: true, msg: `《${isG ? gongfaOf(sid).name : artOf(sid).name}》已封存成册，可去坊市上拍` };
}
export function setGongfa(c, id) {
  if (!c.gfs.includes(id)) return { ok: false, msg: "尚未习得此功法" };
  const g = gongfaOf(id);
  if (g.path && g.path !== c.path) return { ok: false, msg: `此功法只有${pathOf(g.path)?.name ?? ""}可修` };
  if (g.demon && c.path !== "xie" && c.r >= 1) return { ok: false, msg: "此乃魔功，非邪修不可修" };
  c.gf = id;
  return { ok: true, msg: `改修《${g.name}》` };
}
export function setArts(c, ids) {
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > 3) return { ok: false, msg: "神通需装备 1-3 个" };
  const uniq = [...new Set(ids.map(String))];
  for (const id of uniq) {
    if (!c.arts.includes(id)) return { ok: false, msg: "尚未习得此神通" };
    const a = artOf(id);
    if (a.path && a.path !== c.path) return { ok: false, msg: `「${a.name}」只有${pathOf(a.path)?.name ?? ""}可用` };
  }
  c.eqArts = uniq;
  return { ok: true, msg: "神通已调整" };
}

export function inventoryView(c) {
  const stack = Object.entries(c.inv.stack).map(([id, n]) => {
    const d = itemOf(id);
    return d ? { id, n, name: d.name, k: d.k, t: d.t, v: d.v, desc: d.desc, fx: d.fx ?? null } : null;
  }).filter(Boolean);
  const arts = c.inv.arts.map((a) => {
    const d = itemOf(a.id);
    // 星级不是摆设：equipStats 会把基础属性 ×(1+(星-1)*0.08)。这里从前直接发词条表里的原值，
    // 于是升完星卡片上的数字纹丝不动，玩家自然以为升星没有加成。发实际生效的数。
    const qm = 1 + ((a.q ?? 1) - 1) * 0.08;
    const st = d?.st ? Object.fromEntries(Object.entries(d.st).map(([k, v]) => [k, v < 1 ? +(v * qm).toFixed(4) : Math.round(v * qm)])) : d?.st;
    return { iid: a.iid, id: a.id, name: d?.name, slot: d?.slot, t: d?.t, v: d?.v ?? 0, q: a.q, qm: +qm.toFixed(2), af: a.af, rn: a.rn ?? [], st, elem: d?.elem ?? null, desc: d?.desc, equipped: Object.values(c.eq).includes(a.iid) };
  });
  return { stack, arts, eq: c.eq, used: bagUsed(c), cap: { stack: STACK_CAP, arts: ART_CAP } };
}
