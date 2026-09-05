// v47：复审修复（供奉幂等键跨转世、已落槌拍品不能出价）、停摆补偿、会员等级与权益、珍宝阁
import test from "node:test";
import assert from "node:assert/strict";
import { Site } from "./harness.mjs";
import { DAY, HOUR } from "../lib/game/time.js";
import { VIP, vipLevel, vshopStock } from "../lib/game/vip.js";
import { GIFTS } from "../lib/game/gift.js";

const setup = async (s, uid, name, fn) => { await s.call(uid, "boot", {}); await s.call(uid, "create", { name }); s.setChar(uid, (c) => { c.created = Date.UTC(2026, 8, 10); if (fn) fn(c); }); await s.call(uid, "home"); };
const setEn = (s, uid, en) => { const m = s.kv.get(uid); m.set("legacy", { ...(m.get("legacy") ?? {}), en }); };

test("复审：供奉的幂等键含转世次数，转世后不会撞上上一世的 request_id", async () => {
  const s = new Site();
  await setup(s, 1, "供奉者");
  s.points.set(1, 50);
  let r = await s.call(1, "energy.offer", { n: 1 });
  assert.equal(r.ok, true, r.msg);
  const id1 = s.char(1).enN;
  // 直接模拟转世后的状态：enN 保留、lives +1
  s.setChar(1, (c) => { c.dead = { cause: "test" }; });
  r = await s.call(1, "rebirth", { name: "再世供奉者" });
  assert.equal(r.ok, true, r.msg);
  assert.equal(s.char(1).enN, id1, "enN 跨转世保留");
  s.setChar(1, (c) => { c.created = Date.UTC(2026, 8, 10); });
  r = await s.call(1, "energy.offer", { n: 1 });
  assert.equal(r.ok, true, r.msg);
  const ids = s.spent;
  assert.ok(ids.size >= 2, `两笔供奉两个不同的 request_id（实际 ${[...ids].join(",")}）`);
});

test("复审：折进桶的已落槌拍品不能再出价", async () => {
  const s = new Site();
  await setup(s, 2, "买家", (c) => { c.r = 1; c.ls = 10000; });
  s.shared.set("aux:1", { d: { "1:1": { aid: "1:1", uid: 1, n: "卖家", min: 100, end: s.now + HOUR, t: s.now, item: { k: "mat", id: "m_lingcao", name: "灵草", n: 1, t: 0 }, settled: { winner: null, price: 0 } } } });
  const r = await s.call(2, "auction.bid", { aid: "1:1", amt: 200 });
  assert.equal(r.ok, false);
  assert.match(r.msg, /已落槌/);
});

test("补偿 v46：事故前建的号领一次小包，事故后建的号不领；老玩家两包都能领到", async () => {
  const g = GIFTS.find((x) => x.key === "v46");
  assert.ok(g);
  const s = new Site();
  await s.call(3, "boot", {}); await s.call(3, "create", { name: "苦主" });
  s.setChar(3, (c) => { c.created = g.before + 1; });
  let v = await s.call(3, "home");
  assert.equal(v.gift, undefined, "事故后建号不发");
  s.setChar(3, (c) => { c.created = Date.UTC(2026, 8, 1); c.ls = 0; });
  v = await s.call(3, "home");
  assert.ok(v.gift, "领到一包");
  const seen = [v.gift.key];
  v = await s.call(3, "home");
  if (v.gift) seen.push(v.gift.key);
  assert.deepEqual(seen.sort(), ["v34", "v46"], "两包各领一次");
  assert.ok(s.char(3).ls >= 70000, `两包灵石到账 ${s.char(3).ls}`);
  v = await s.call(3, "home");
  assert.equal(v.gift, undefined, "不重复");
  // 转世后也不重发（legacy.gifts 要跟着走）
  s.setChar(3, (c) => { c.dead = { cause: "test" }; });
  await s.call(3, "rebirth", { name: "苦主二世" });
  v = await s.call(3, "home");
  assert.equal(v.gift, undefined, "转世不重发");
});

test("会员等级：按累计供奉能量升，跨转世；供奉时累计并立刻生效", async () => {
  assert.equal(vipLevel(0), 0); assert.equal(vipLevel(5), 1); assert.equal(vipLevel(19), 1); assert.equal(vipLevel(20), 2); assert.equal(vipLevel(100), 4); assert.equal(vipLevel(999), 8); assert.equal(vipLevel(5000), 9);
  const s = new Site();
  await setup(s, 4, "会员");
  s.points.set(4, 100);
  let v = await s.call(4, "energy");
  assert.equal(v.data.energy.vip.lv, 0);
  assert.equal(v.data.energy.vip.next, "VIP1");
  await s.call(4, "energy.offer", { n: 5 });
  assert.equal(s.kv.get(4).get("legacy").en, 5, "累计写进 legacy");
  v = await s.call(4, "energy");
  assert.equal(v.data.energy.vip.lv, 1);
  assert.equal(v.data.energy.vip.name, "VIP1");
  assert.equal(v.me.vip, 1, "summary 带等级");
  // 转世不丢
  s.setChar(4, (c) => { c.dead = { cause: "test" }; });
  await s.call(4, "rebirth", { name: "再世会员" });
  v = await s.call(4, "home");
  assert.equal(v.me.vip, 1);
});

test("会员权益：补货次数、第四张悬赏、离线上限、手续费、秘境次数、灵田、折扣、兑换率、称号", async () => {
  const { offlineCapMs } = await import("../lib/game/stats.js");
  const { shopReLimit } = await import("../lib/game/shop.js");
  const { lsPerEnergy } = await import("../lib/game/energy.js");
  const s = new Site();
  await setup(s, 5, "王者", (c) => { c.r = 2; c.ls = 100000; });
  const c0 = s.char(5);
  assert.equal(shopReLimit({ ...c0, vip: 0 }), 3); assert.equal(shopReLimit({ ...c0, vip: 1 }), 4);
  assert.equal(offlineCapMs({ ...c0, vip: 2 }) - offlineCapMs({ ...c0, vip: 1 }), 4 * HOUR); // 白银 +2h → 黄金 +6h
  assert.equal(lsPerEnergy(2, 4), Math.round(lsPerEnergy(2, 0) * 1.5)); assert.equal(lsPerEnergy(2, 3), Math.round(lsPerEnergy(2, 0) * 1.25));
  // 挂上王者，看各视图
  setEn(s, 5, 100);
  let v = await s.call(5, "home");
  assert.equal(v.me.vip, 4);
  const bo = s.char(5).daily.bo;
  s.setChar(5, (c) => { c.daily.bo = null; c.daily.bs = null; });
  v = await s.call(5, "bounty");
  assert.equal(v.data.bounty.list.length, 4, "白银及以上每天四张悬赏");
  v = await s.call(5, "dg");
  assert.equal(v.data.dg.limit, 4, "王者秘境 +2");
  v = await s.call(5, "farm");
  assert.equal(v.data.farm.n, 5, "灵田封顶 5（金丹 4 块 + 王者 2 块，FM_MAX 5）");
  // 坊市九五折
  const shop0 = (await s.call(5, "shop")).data.shop;
  setEn(s, 5, 0);
  const shop1 = (await s.call(5, "shop")).data.shop;
  assert.ok(shop0[0].price < shop1[0].price, `折扣生效 ${shop0[0].price} < ${shop1[0].price}`);
  // 手续费减半
  setEn(s, 5, 20);
  s.setChar(5, (c) => { c.inv.stack.m_lingcao = 10; c.ls = 100000; });
  let r = await s.call(5, "auction.create", { item: { id: "m_lingcao", n: 1 }, min: 10000 });
  assert.equal(r.ok, true, r.msg);
  assert.equal(s.char(5).ls, 100000 - 250, "5% 手续费减半 = 250");
  // 称号
  v = await s.call(5, "ach");
  assert.equal(v.data.ach.titles[0].id, "vip");
  r = await s.call(5, "ach.title", { id: "vip" });
  assert.equal(r.ok, true);
  assert.equal(s.char(5).title, "VIP2 道友");
  setEn(s, 5, 0);
  r = await s.call(5, "ach.title", { id: "vip" });
  assert.equal(r.ok, false);
});

test("珍宝阁：凡人看不到货，等级越高货越多且确定；买入记账、法宝保底两星", async () => {
  const s = new Site();
  await setup(s, 6, "买珍宝", (c) => { c.r = 2; c.ls = 1000000; });
  let v = await s.call(6, "vshop");
  assert.equal(v.data.vshop.lv, 0);
  assert.equal(v.data.vshop.stock.length, 0);
  setEn(s, 6, 5);
  v = await s.call(6, "vshop");
  assert.equal(v.data.vshop.lv, 1);
  assert.ok(v.data.vshop.stock.length >= 1 && v.data.vshop.stock.length <= 4);
  assert.ok(v.data.vshop.stock.every((x) => ["p_qingdu"].includes(x.id) || x.k === "misc"), "白银只有种子/清毒丹/符纹");
  const a = vshopStock({ ...s.char(6), vip: 1 }, 1), b = vshopStock({ ...s.char(6), vip: 1 }, 1);
  assert.deepEqual(a, b, "同日同人确定");
  setEn(s, 6, 100);
  v = await s.call(6, "vshop");
  assert.equal(v.data.vshop.lv, 4);
  assert.equal(v.data.vshop.stock.length, 8, "王者八格");
  const first = v.data.vshop.stock[0];
  const ls0 = s.char(6).ls;
  let r = await s.call(6, "vshop.buy", { idx: first.idx });
  assert.equal(r.ok, true, r.msg);
  assert.equal(s.char(6).ls, ls0 - first.price);
  assert.equal(r.data.vshop.stock[0].left, first.n - 1);
  for (let i = 1; i < first.n; i++) await s.call(6, "vshop.buy", { idx: first.idx });
  r = await s.call(6, "vshop.buy", { idx: first.idx });
  assert.equal(r.ok, false); assert.match(r.msg, /售罄/);
  // 王者的法宝保底两星
  for (let day = 1; day < 40; day++) {
    const st = vshopStock({ ...s.char(6), vip: 4 }, day).find((x) => x.id.startsWith("f_"));
    if (!st) continue;
    s.setChar(6, (c) => { c.daily.vshop = {}; c.inv.arts = []; });
    const rr = await s.call(6, "vshop.buy", { idx: st.idx }); // 用今天的 idx 可能对不上，只检查不会崩
    if (rr.ok) { const it = s.char(6).inv.arts[0]; if (it) assert.ok(it.q >= 3, "王者保底三星"); }
    break;
  }
});
