// v52：VIP0–9（累计供奉能量、只升不降）、历史供奉补记、晋升喜报、珍宝阁独家货与逐级权益
import test from "node:test";
import assert from "node:assert/strict";
import { Site } from "./harness.mjs";
import { HOUR } from "../lib/game/time.js";
import { VIP_MOD, VIP_EN } from "../lib/game/vipmod.js";
import { vipLevel, vipTitle, vshopStock, VS_EXCLUSIVE } from "../lib/game/vip.js";
import { arenaDaily } from "../lib/game/arena.js";
import { bossDaily } from "../lib/game/boss.js";

const setup = async (s, uid, name, fn) => { await s.call(uid, "boot", {}); await s.call(uid, "create", { name }); s.setChar(uid, (c) => { c.created = Date.UTC(2026, 8, 20); if (fn) fn(c); }); await s.call(uid, "home"); };
const setLegacy = (s, uid, patch) => { const m = s.kv.get(uid); m.set("legacy", { ...(m.get("legacy") ?? {}), ...patch }); };

test("等级表：十档门槛递增，每一列都不倒退，每一级都比上一级多点什么", () => {
  assert.equal(VIP_EN.length, 10); assert.equal(VIP_MOD.length, 10);
  for (let i = 1; i < 10; i++) assert.ok(VIP_EN[i] > VIP_EN[i - 1]);
  const up = ["rate", "off", "exp", "drop", "bt", "trib", "en", "enRate", "dg", "farm", "pet", "vs", "q", "gift", "wk", "arena", "boss", "auc", "arts", "shine"];
  for (let i = 1; i < 10; i++) {
    for (const k of up) assert.ok(VIP_MOD[i][k] >= VIP_MOD[i - 1][k], `VIP${i}.${k}`);
    assert.ok(VIP_MOD[i].disc <= VIP_MOD[i - 1].disc, `VIP${i}.disc`);
    assert.ok(VIP_MOD[i].rate > VIP_MOD[i - 1].rate && VIP_MOD[i].exp > VIP_MOD[i - 1].exp && VIP_MOD[i].off > VIP_MOD[i - 1].off, `VIP${i} 修炼/游历/离线都要涨`);
  }
  assert.equal(vipLevel(4), 0); assert.equal(vipLevel(5), 1); assert.equal(vipLevel(100), 4); assert.equal(vipLevel(180), 5); assert.equal(vipLevel(1199), 8); assert.equal(vipLevel(1200), 9);
  assert.equal(vipTitle(1), null); assert.equal(vipTitle(2), "VIP2 道友"); assert.equal(vipTitle(8), "VIP8 真君"); assert.equal(vipTitle(9), "VIP9 至尊");
  assert.equal(arenaDaily({ vip: 5 }), 5); assert.equal(arenaDaily({ vip: 6 }), 7); assert.equal(bossDaily({ vip: 7 }), 4);
});

test("历史补记：改版前只有供奉次数的账号按 3 点/次补进 legacy.en，只补不扣、只跑一次", async () => {
  const s = new Site();
  await setup(s, 1, "老供奉", (c) => { c.enN = 10; });
  setLegacy(s, 1, { en: 0, enMig: undefined });
  await s.call(1, "home");
  assert.equal(s.kv.get(1).get("legacy").en, 30, "10 次 → 30 点");
  assert.equal(s.kv.get(1).get("legacy").enMig, 1);
  let v = await s.call(1, "home");
  assert.equal(v.me.vip, 2, "30 点 = VIP2");
  // 已经精确记了更多的不被覆盖
  await setup(s, 2, "新供奉", (c) => { c.enN = 2; });
  setLegacy(s, 2, { en: 100 });
  await s.call(2, "home");
  assert.equal(s.kv.get(2).get("legacy").en, 100, "精确值更大时不动");
  // 第二次不再重跑
  s.setChar(1, (c) => { c.enN = 100; });
  await s.call(1, "home");
  assert.equal(s.kv.get(1).get("legacy").en, 30, "迁移只跑一次");
});

test("晋升：供奉跨过门槛时有通知、传记、档案带时间；别人的洞府能看到喜报；VIP9 置顶", async () => {
  const s = new Site();
  await setup(s, 3, "晋升者");
  setLegacy(s, 3, { en: 18 });
  s.points.set(3, 50);
  await s.call(3, "home");
  let r = await s.call(3, "energy.offer", { n: 2 });
  assert.equal(r.ok, true, r.msg);
  assert.ok((r.notes ?? []).some((n) => n.k === "vip" && /晋升 VIP2/.test(n.v)), "晋升通知");
  const lg = s.kv.get(3).get("legacy");
  assert.equal(lg.en, 20); assert.ok(lg.vt > 0, "记下晋升时间");
  await s.call(3, "home"); // 档案同步
  const prof = [...s.shared.entries()].map(([k, v]) => v).flatMap((v) => (v?.d ? Object.values(v.d) : [v])).find((p) => p && p.uid === 3 && p.vp !== undefined);
  assert.ok(prof && prof.vp === 2 && prof.vt === lg.vt, "档案带 vp/vt");
  const bio = await s.call(3, "bio");
  assert.match(JSON.stringify(bio.data), /晋升 VIP2/);
  // 同级再供奉不改 vt
  r = await s.call(3, "energy.offer", { n: 1 }); assert.equal(r.ok, true, r.msg);
  assert.equal(s.kv.get(3).get("legacy").vt, lg.vt);
  // 别人看喜报；VIP9 的排最前
  await setup(s, 4, "至尊");
  setLegacy(s, 4, { en: 1200, vt: lg.vt - HOUR });
  await s.call(4, "home");
  await setup(s, 5, "看客");
  const v = await s.call(5, "home");
  const hn = v.data.home.honors;
  assert.ok(hn.length >= 2, "喜报有两条");
  assert.equal(hn[0].n, "至尊"); assert.equal(hn[0].lv, 9);
  assert.equal(hn[1].n, "晋升者"); assert.equal(hn[1].lv, 2);
});

test("逐级权益：珍宝阁独家货只在对应档起出现、VIP7 起可出两件法宝、上拍名额与论道次数按表", async () => {
  const s = new Site();
  await setup(s, 6, "买家", (c) => { c.r = 3; c.ls = 10_000_000; });
  const c = s.char(6);
  const seenAt = {};
  for (let lv = 1; lv <= 9; lv++) for (let day = 1; day <= 60; day++) for (const it of vshopStock({ ...c, vip: lv }, day)) if (VS_EXCLUSIVE.includes(it.id)) seenAt[it.id] = Math.min(seenAt[it.id] ?? 99, lv);
  assert.deepEqual(seenAt, { x_juling: 3, x_gaiming: 4, t_biguan: 5, p_xisui: 6, x_chuancheng: 7 }, "独家货首次出现的档位");
  let two = false;
  for (let day = 1; day <= 60 && !two; day++) two = vshopStock({ ...c, vip: 7 }, day).filter((x) => x.id.startsWith("f_")).length >= 2;
  assert.ok(two, "VIP7 有两件法宝的日子");
  for (let day = 1; day <= 60; day++) assert.ok(vshopStock({ ...c, vip: 6 }, day).filter((x) => x.id.startsWith("f_")).length <= 1, "VIP6 至多一件");
  assert.ok(vshopStock({ ...c, vip: 9 }, 1).length >= 8, "VIP9 货多");
  // 上拍名额 +2
  setLegacy(s, 6, { en: 800 });
  s.setChar(6, (c) => { c.inv.stack.m_lingcao = 20; });
  await s.call(6, "home");
  const v = await s.call(6, "energy");
  assert.equal(v.data.energy.vip.lv, 8); assert.equal(v.data.energy.daily, 22);
  assert.equal(v.data.energy.vip.table.length, 9); assert.equal(v.data.energy.vip.extras.length, 9);
  let n = 0;
  for (let i = 0; i < 8; i++) { const r = await s.call(6, "auction.create", { item: { id: "m_lingcao", n: 1 }, min: 10 }); if (r.ok) n++; else { assert.match(r.msg, /最多同时 7 件/); break; } }
  assert.equal(n, 7, "VIP8 七件在拍");
  // 论道 +2
  const a = await s.call(6, "arena");
  assert.equal(a.data.arena.left, 7);
  // 称号
  const t = await s.call(6, "ach.title", { id: "vip" });
  assert.equal(t.ok, true); assert.equal(s.char(6).title, "VIP8 真君");
});
