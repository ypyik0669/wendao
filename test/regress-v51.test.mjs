// v51：秘籍成物品（可学/可封存/可上拍）、妖兽会什么掉什么、妖潮可见、会员数值表
import test from "node:test";
import assert from "node:assert/strict";
import { Site } from "./harness.mjs";
import { HOUR } from "../lib/game/time.js";
import { dayEvent } from "../lib/game/events2.js";
import { rollDrops, exploreDaily } from "../lib/game/explore.js";
import { monsterOf } from "../lib/data/monsters.js";
import { itemOf } from "../lib/data/items.js";
import { deriveStats, offlineCapMs } from "../lib/game/stats.js";
import { energyDaily, lsPerEnergy } from "../lib/game/energy.js";
import { VIP_MOD } from "../lib/game/vipmod.js";

const CST = 8 * HOUR;
const at = (y, m, d, h) => Date.UTC(y, m, d, h) - CST;
const setup = async (s, uid, name, fn) => { await s.call(uid, "boot", {}); await s.call(uid, "create", { name }); s.setChar(uid, (c) => { c.created = Date.UTC(2026, 8, 20); if (fn) fn(c); }); await s.call(uid, "home"); };
const setEn = (s, uid, en) => { const m = s.kv.get(uid); m.set("legacy", { ...(m.get("legacy") ?? {}), en }); };

test("典籍：功法与神通都有对应秘籍；用了就学会，已学/道途不合的留着，坊市不收", async () => {
  assert.ok(itemOf("b_g_xuemo") && itemOf("b_a_frost") && !itemOf("b_a_slash") && !itemOf("b_a_fire"));
  assert.equal(itemOf("b_g_xuemo").k, "book");
  const s = new Site();
  await setup(s, 1, "剑修", (c) => { c.r = 2; c.path = "jian"; c.inv.stack.b_g_xuemo = 1; c.inv.stack.b_a_frost = 1; c.inv.stack.b_a_inferno = 1; c.inv.stack.b_g_chiyan = 1; });
  let r = await s.call(1, "use", { id: "b_g_xuemo" });
  assert.equal(r.ok, false); assert.match(r.msg, /魔功.*上拍/);
  assert.equal(s.char(1).inv.stack.b_g_xuemo, 1, "书还在");
  r = await s.call(1, "use", { id: "b_a_inferno" });
  assert.equal(r.ok, false); assert.match(r.msg, /法修专修/);
  r = await s.call(1, "use", { id: "b_a_frost" });
  assert.equal(r.ok, true, r.msg); assert.ok(s.char(1).arts.includes("a_frost")); assert.equal(s.char(1).inv.stack.b_a_frost, undefined);
  r = await s.call(1, "use", { id: "b_g_chiyan" });
  assert.equal(r.ok, true, r.msg); assert.ok(s.char(1).gfs.includes("g_chiyan"));
  s.setChar(1, (c) => { c.inv.stack.b_g_chiyan = 1; });
  r = await s.call(1, "use", { id: "b_g_chiyan" });
  assert.equal(r.ok, false); assert.match(r.msg, /已习得/);
  r = await s.call(1, "sell", { id: "b_g_chiyan", n: 1 });
  assert.equal(r.ok, false); assert.match(r.msg, /拍卖行/);
  assert.equal(s.char(1).inv.stack.b_g_chiyan, 1);
});

test("封存：把已学的抄成秘籍，装备中的与基础技不可封存；上拍→落槌→买家学得", async () => {
  const s = new Site();
  await setup(s, 2, "卖家", (c) => { c.r = 2; c.path = "jian"; c.ls = 10000; c.gfs.push("g_xuemo", "g_chiyan"); c.gf = "g_chiyan"; c.arts.push("a_frost"); });
  let r = await s.call(2, "book.seal", { id: "g_tuna" }); assert.equal(r.ok, false);
  r = await s.call(2, "book.seal", { id: "g_chiyan" }); assert.equal(r.ok, false); assert.match(r.msg, /换下/);
  r = await s.call(2, "book.seal", { id: "a_fire" }); assert.equal(r.ok, false);
  r = await s.call(2, "book.seal", { id: "g_xuemo" });
  assert.equal(r.ok, true, r.msg);
  assert.ok(!s.char(2).gfs.includes("g_xuemo")); assert.equal(s.char(2).inv.stack.b_g_xuemo, 1);
  assert.ok(r.data.skills && r.data.inv, "回技能页也回行囊");
  r = await s.call(2, "book.seal", { id: "a_frost" }); assert.equal(r.ok, true, r.msg);
  assert.ok(!s.char(2).arts.includes("a_frost"));
  // 上拍
  r = await s.call(2, "auction.create", { item: { id: "b_g_xuemo", n: 1 }, min: 500 });
  assert.equal(r.ok, true, r.msg);
  assert.equal(s.char(2).inv.stack.b_g_xuemo, undefined);
  await setup(s, 3, "邪修", (c) => { c.r = 2; c.path = "xie"; c.ls = 10000; });
  const v = await s.call(3, "shop");
  const a = v.data.auctions.open.find((x) => x.item.id === "b_g_xuemo");
  assert.ok(a, "秘籍在拍卖行看得到"); assert.match(a.item.desc, /功法/);
  r = await s.call(3, "auction.bid", { aid: a.aid, amt: 600 });
  assert.equal(r.ok, true, r.msg);
  s.advance(25 * HOUR);
  s.shared.set("auction:" + a.aid, { ...s.shared.get("auction:" + a.aid), settled: { winner: 3, wname: "邪修", price: 600 } });
  await s.call(3, "home");
  assert.equal(s.char(3).inv.stack.b_g_xuemo, 1, "买家拿到秘籍");
  r = await s.call(3, "use", { id: "b_g_xuemo" });
  assert.equal(r.ok, true, r.msg); assert.ok(s.char(3).gfs.includes("g_xuemo"));
  r = await s.call(3, "gongfa", { id: "g_xuemo" }); assert.equal(r.ok, true, r.msg);
});

test("掉落：妖兽会什么神通就可能掉什么秘籍；妖潮与会员按倍率加成；封存过的功法转世不再保留", async () => {
  const seen = [];
  const yes = { chance: (p) => { seen.push(+p.toFixed(4)); return true; }, pick: (a) => a[0], next: () => 0.5 };
  const c = { uid: 9, r: 0, path: null, gfs: ["g_tuna"], arts: ["a_slash", "a_fire"], inv: { stack: {}, arts: [] }, ic: 0, vip: 0, _now: at(2026, 8, 8, 12) };
  const into = [];
  rollDrops(c, monsterOf("w_shuyao"), yes, into); // 树妖：掉 g_qingfeng，会 a_wood/a_slash
  assert.ok(into.some((x) => x.id === "b_g_qingfeng"), "功法掉的是秘籍");
  assert.ok(into.some((x) => x.id === "b_a_wood"), "会的神通也掉秘籍");
  assert.ok(!into.some((x) => x.id === "b_a_slash"));
  assert.ok(seen.includes(0.12), `BOSS 神通秘籍 12%（${seen}）`);
  assert.equal(c.inv.stack.b_a_wood, 1);
  seen.length = 0;
  c._now = at(2026, 8, 8, 21); c.vip = 4; // 妖潮 ×1.5 × 王者 ×1.5
  rollDrops(c, monsterOf("w_yelang"), yes, []);
  assert.ok(seen.includes(+(0.3 * 2.25).toFixed(4)), `掉率乘上去了（${seen}）`);
  assert.equal(dayEvent(at(2026, 8, 8, 21)).enc, 0.5); assert.equal(dayEvent(at(2026, 8, 8, 21)).hot, true);
  assert.equal(dayEvent(at(2026, 8, 8, 12)).enc, 0.3);
  // 游历视图带活动
  const s = new Site(at(2026, 8, 8, 21));
  await setup(s, 4, "赶潮", (c) => { c.gfs.push("g_taiyi"); });
  let v = await s.call(4, "regions");
  assert.equal(v.data.ev.hot, true);
  // 封存后转世：keep 里没有它
  let r = await s.call(4, "book.seal", { id: "g_taiyi" }); assert.equal(r.ok, true, r.msg);
  s.setChar(4, (c) => { c.dead = { cause: "test" }; });
  r = await s.call(4, "rebirth", { name: "赶潮二世" }); assert.equal(r.ok, true, r.msg);
  assert.ok(!s.char(4).gfs.includes("g_taiyi"));
});

test("会员数值表：修炼、离线、游历次数、供奉上限与兑换率、突破与渡劫、每日礼一天一次", async () => {
  assert.equal(VIP_MOD.length, 10);
  const s = new Site();
  await setup(s, 5, "王者", (c) => { c.r = 2; c.ls = 0; });
  const base = s.char(5);
  const st0 = deriveStats({ ...base, vip: 0 }), st4 = deriveStats({ ...base, vip: 4 });
  assert.equal(+(st4.rate / st0.rate).toFixed(2), 1.35);
  assert.equal(+(st4.bt - st0.bt).toFixed(2), 0.08);
  assert.equal(+(st4.trib - st0.trib).toFixed(2), 0.2);
  assert.equal(offlineCapMs({ ...base, vip: 4 }) - offlineCapMs({ ...base, vip: 0 }), 24 * HOUR);
  assert.equal(exploreDaily({ vip: 0 }), 20); assert.equal(exploreDaily({ vip: 3 }), 40);
  assert.equal(energyDaily({ vip: 2 }), 6); assert.equal(energyDaily({ vip: 4 }), 10);
  assert.equal(lsPerEnergy(2, 2), Math.round(lsPerEnergy(2, 0) * 1.1));
  // 每日礼：第一次请求发，同日不重发，跨日再发
  setEn(s, 5, 100);
  const ls0 = s.char(5).ls;
  let v = await s.call(5, "home");
  assert.equal(s.char(5).ls - ls0, 8000 * 3, "王者每日礼 8000×(境界+1)");
  assert.ok((v.notes ?? []).some((n) => n.k === "vip"), "有通知");
  await s.call(5, "home");
  assert.equal(s.char(5).ls - ls0, 8000 * 3, "同日不重发");
  s.advance(25 * HOUR);
  await s.call(5, "home");
  const d2 = s.char(5).ls - ls0;
  assert.ok(d2 >= 8000 * 6 && d2 < 8000 * 6 + 1000, `跨日再发（${d2}，另有零星日常收入）`);
  // 供奉上限随等级
  v = await s.call(5, "energy");
  assert.equal(v.data.energy.daily, 10);
  assert.ok(v.data.energy.vip.table.length === 9 && v.data.energy.vip.table[0].length === v.data.energy.vip.cols.length, "对比表九行");
  assert.equal(v.data.energy.vip.now.rate, 1.35);
  // 游历次数
  v = await s.call(5, "regions");
  assert.equal(v.data.daily, 50);
});
