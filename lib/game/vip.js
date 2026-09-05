import { ITEMS, itemOf } from "../data/items.js";
import { makeRng } from "./rng.js";
import { TIER_OF_REALM } from "../data/monsters.js";
import { addStack, rollArtifact } from "./inventory.js";
import { VIP_MOD, VIP_EN, vipMod } from "./vipmod.js";
export { VIP_MOD, VIP_EN, vipMod };

// 会员等级 VIP0–VIP9：按**累计供奉能量**（legacy.en，跨转世永久，只升不降）。平台不提供论坛会员等级
// （ctx.user 只有 id/username/avatar），所以只认游戏内供奉；v47 之前的供奉按 3 点/次估算补记（main.js enMig）。
export const VIP = VIP_EN.map((en, i) => [en, `VIP${i}`]);
// 每级新解锁的「阈值类」权益（数值类都在 VIP_MOD 里）
export const VIP_PERKS = [
  [],
  ["珍宝阁开放", "坊市补货 +1 次/日", "每日多一张悬赏"],
  ["拍卖手续费减半", "可佩戴会员称号"],
  ["聚灵香珍宝阁独家", "榜单徽记"],
  ["顶栏金名", "改名玉牒独家", "珍宝阁法宝保底三星"],
  ["闭关符独家", "周末会员礼 ×2"],
  ["洗髓丹独家", "论道每日 +2 次"],
  ["传承玉简独家", "世界 BOSS 每日 +1 次", "珍宝阁每日两件法宝"],
  ["上拍名额 +2", "称号「VIP8 真君」", "珍宝阁法宝保底四星"],
  ["名字流光、灵兽光环", "称号「VIP9 至尊」", "洞府喜报置顶"],
];
const discS = (d) => (d >= 1 ? "—" : d === 0.95 ? "九五折" : d === 0.9 ? "九折" : d === 0.85 ? "八五折" : d === 0.8 ? "八折" : d === 0.75 ? "七五折" : "七折");
// 对比表：一级一行，客户端只管画
export const VIP_COLS = ["等级", "能量", "修炼", "离线", "游历", "掉落", "供奉", "兑换", "折扣", "日礼"];
export const VIP_TABLE = () => VIP_MOD.slice(1).map((m, i) => [`VIP${i + 1}`, String(VIP_EN[i + 1]), `×${m.rate}`, `+${m.off}h`, String(m.exp), `×${m.drop}`, String(m.en), m.enRate > 1 ? `×${m.enRate}` : "—", discS(m.disc), `${m.gift}×`]);
let tableCache = null;
export function vipLevel(en) {
  let lv = 0;
  for (let i = 0; i < VIP.length; i++) if ((en | 0) >= VIP[i][0]) lv = i;
  return lv;
}
// 请求开头把等级挂在 c.vip 上（每次重算，存档里带着也无妨），各处权益只看这一个数
export const vipOf = (c) => Math.max(0, Math.min(VIP.length - 1, c?.vip | 0));
export function vipView(c, legacy) {
  const en = legacy?.en | 0, lv = vipLevel(en);
  const next = lv + 1 < VIP.length ? VIP[lv + 1] : null;
  return { lv, name: VIP[lv][1], en, next: next ? next[1] : null, need: next ? next[0] : null, perks: VIP_PERKS.slice(1, lv + 1).flat(), now: VIP_MOD[lv], cols: VIP_COLS, table: (tableCache ??= VIP_TABLE()), extras: VIP_PERKS.slice(1).map((p, i) => `VIP${i + 1}：${p.join("、")}`) };
}
export const vipTitle = (lv) => (lv >= 9 ? "VIP9 至尊" : lv >= 8 ? "VIP8 真君" : lv >= 2 ? `VIP${lv} 道友` : null);

// 珍宝阁：按等级解锁的专属货架，每日 4 格，比坊市贵但保证有货。不占共享键。
export const VS_SLOTS = 4; // 凡人以上最少格数；实际格数看 VIP_MOD.vs
const VS_POOL = [
  [], // VIP0：无
  [["seed+1", 3], ["p_qingdu", 2], ["rune", 1]],
  [["p_xiqi", 3], ["t_dun", 2], ["egg+1", 1]],
  [["m_jinghe", 2], ["r_ji", 1], ["r_tu", 1], ["x_juling", 2]], // 聚灵香独家
  [["art", 1], ["x_gaiming", 1]], // 改名玉牒独家
  [["t_biguan", 3]],
  [["p_xisui", 1]],
  [["x_chuancheng", 1], ["art", 1]], // 第二件法宝
  [],
  [],
];
export const VS_EXCLUSIVE = ["x_juling", "x_gaiming", "t_biguan", "p_xisui", "x_chuancheng"];
const tierOf = (c) => TIER_OF_REALM[Math.max(0, Math.min(8, c.r | 0))] ?? 0;
function resolve(spec, c, rng) {
  const t = tierOf(c);
  if (spec === "seed+1") { const p = ITEMS.filter((i) => i.fx?.seed && i.t === Math.min(5, t + 1)); return p.length ? rng.pick(p).id : null; }
  if (spec === "rune") { const p = ITEMS.filter((i) => i.fx?.rune && i.t <= Math.max(1, t)); return p.length ? rng.pick(p).id : null; }
  if (spec === "egg+1") { const p = ITEMS.filter((i) => i.k === "egg" && i.t <= Math.min(4, t + 1)); return p.length ? rng.pick(p).id : null; }
  if (spec === "art") { const p = ITEMS.filter((i) => i.k === "art" && i.t === Math.min(5, t)); return p.length ? rng.pick(p).id : null; }
  return spec;
}
export function vshopStock(c, day) {
  const lv = vipOf(c);
  const rng = makeRng(`vshop:${day}:${c.uid}:${c.r | 0}`);
  const pool = VS_POOL.slice(1, lv + 1).flat();
  const picks = [];
  const seen = new Set();
  let guard = 0;
  const slots = vipMod(c).vs;
  while (picks.length < slots && pool.length && guard++ < 60) {
    const [spec, n] = rng.pick(pool);
    if (spec === "art" && picks.filter((p) => itemOf(p.id)?.k === "art").length >= vipMod(c).arts) continue; // 每日法宝件数按 VIP_MOD.arts
    const id = resolve(spec, c, rng);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const d = itemOf(id);
    picks.push({ idx: picks.length, id, n, price: Math.round(d.v * 1.6) });
  }
  return picks;
}
export function vshopView(c, day) {
  const lv = vipOf(c);
  const bought = c.daily.vshop ?? {};
  return {
    lv, name: VIP[lv][1], unlockAt: VIP[1][0], excl: VS_EXCLUSIVE,
    stock: vshopStock(c, day).map((s) => { const d = itemOf(s.id); return { ...s, left: Math.max(0, s.n - (bought[s.id] ?? 0)), name: d.name, k: d.k, t: d.t, desc: d.desc }; }),
  };
}
export function vshopBuy(c, idx, day, rng) {
  const s = vshopStock(c, day)[Number(idx)];
  if (!s) return { ok: false, msg: "没有这件珍宝" };
  c.daily.vshop = c.daily.vshop ?? {};
  if ((c.daily.vshop[s.id] ?? 0) >= s.n) return { ok: false, msg: "已售罄" };
  if (c.ls < s.price) return { ok: false, msg: "灵石不足" };
  const d = itemOf(s.id);
  if (d.k === "art") {
    const it = rollArtifact(c, s.id, rng);
    if (!it) return { ok: false, msg: "法宝匣已满" };
    const q = vipMod(c).q; if ((it.q ?? 1) < q) it.q = q; // 珍宝阁的法宝保底星数按 VIP_MOD.q
  } else if (!addStack(c, s.id, 1)) return { ok: false, msg: "行囊已满" };
  c.ls -= s.price;
  c.daily.vshop[s.id] = (c.daily.vshop[s.id] ?? 0) + 1;
  return { ok: true, msg: `珍宝阁购得 ${d.name}，花费 ${s.price} 灵石` };
}
