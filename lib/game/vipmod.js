// 会员数值表（v52）：VIP0–VIP9，按累计供奉能量升，只升不降。各处权益只读这一张表。
// 独立成文件是为了让 stats.js 也能引用而不与 inventory.js 成环。
// 前四档门槛与 v51 的白银/黄金/钻石/王者一致，改版时没人掉级。
export const VIP_EN = [0, 5, 20, 50, 100, 180, 300, 500, 800, 1200];
// rate 修炼 · off 离线上限(+h) · exp 每日游历 · drop 掉落 · bt 突破 · trib 渡劫减伤 · en 每日供奉上限 · enRate 兑换率 · disc 坊市折扣
// dg 秘境 · farm 灵田 · pet 灵兽历练 · vs 珍宝阁格数 · q 珍宝阁法宝保底星 · gift 每日礼(×(境界+1)) · wk 周末礼倍数
// arena 论道 +n · boss 世界 BOSS +n · auc 上拍名额 +n · arts 珍宝阁每日法宝件数 · shine 名字流光/灵兽光环
export const VIP_MOD = [
  { rate: 1, off: 0, exp: 20, drop: 1, bt: 0, trib: 0, en: 5, enRate: 1, disc: 1, dg: 0, farm: 0, pet: 1, vs: 0, q: 1, gift: 0, wk: 1, arena: 0, boss: 0, auc: 0, arts: 1, shine: 0 },
  { rate: 1.05, off: 2, exp: 25, drop: 1.05, bt: 0, trib: 0, en: 5, enRate: 1, disc: 1, dg: 0, farm: 0, pet: 1, vs: 4, q: 2, gift: 300, wk: 1, arena: 0, boss: 0, auc: 0, arts: 1, shine: 0 },
  { rate: 1.1, off: 6, exp: 30, drop: 1.1, bt: 0.03, trib: 0, en: 6, enRate: 1.1, disc: 0.95, dg: 1, farm: 0, pet: 1.5, vs: 4, q: 2, gift: 1000, wk: 1, arena: 0, boss: 0, auc: 0, arts: 1, shine: 0 },
  { rate: 1.2, off: 12, exp: 40, drop: 1.25, bt: 0.05, trib: 0.1, en: 8, enRate: 1.25, disc: 0.9, dg: 1, farm: 1, pet: 1.5, vs: 6, q: 2, gift: 3000, wk: 1, arena: 0, boss: 0, auc: 0, arts: 1, shine: 0 },
  { rate: 1.35, off: 24, exp: 50, drop: 1.5, bt: 0.08, trib: 0.2, en: 10, enRate: 1.5, disc: 0.85, dg: 2, farm: 2, pet: 2, vs: 8, q: 3, gift: 8000, wk: 1, arena: 0, boss: 0, auc: 0, arts: 1, shine: 0 },
  { rate: 1.45, off: 30, exp: 60, drop: 1.6, bt: 0.09, trib: 0.22, en: 12, enRate: 1.6, disc: 0.8, dg: 2, farm: 2, pet: 2, vs: 8, q: 3, gift: 10000, wk: 2, arena: 0, boss: 0, auc: 0, arts: 1, shine: 0 },
  { rate: 1.5, off: 36, exp: 70, drop: 1.7, bt: 0.1, trib: 0.25, en: 15, enRate: 1.7, disc: 0.8, dg: 2, farm: 2, pet: 2.5, vs: 8, q: 3, gift: 12000, wk: 2, arena: 2, boss: 0, auc: 0, arts: 1, shine: 0 },
  { rate: 1.55, off: 42, exp: 80, drop: 1.8, bt: 0.11, trib: 0.28, en: 18, enRate: 1.8, disc: 0.75, dg: 3, farm: 2, pet: 2.5, vs: 10, q: 3, gift: 15000, wk: 2, arena: 2, boss: 1, auc: 0, arts: 2, shine: 0 },
  { rate: 1.6, off: 48, exp: 90, drop: 1.9, bt: 0.12, trib: 0.3, en: 22, enRate: 1.9, disc: 0.75, dg: 3, farm: 2, pet: 3, vs: 10, q: 4, gift: 18000, wk: 2, arena: 2, boss: 1, auc: 2, arts: 2, shine: 0 },
  { rate: 1.7, off: 72, exp: 100, drop: 2, bt: 0.15, trib: 0.35, en: 25, enRate: 2, disc: 0.7, dg: 4, farm: 2, pet: 3, vs: 12, q: 4, gift: 25000, wk: 2, arena: 2, boss: 1, auc: 2, arts: 2, shine: 1 },
];
export const vipMod = (c) => VIP_MOD[Math.max(0, Math.min(VIP_MOD.length - 1, c?.vip | 0))];
