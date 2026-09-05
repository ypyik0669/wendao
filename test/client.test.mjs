// Drives the real webview client (pageHtml/pageCss/pageJs) inside jsdom against the harness Site.
import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM, VirtualConsole } from "jsdom";
import { Site, app } from "./harness.mjs";
import { stageNeed } from "../lib/data/realms.js";
import { pageJs } from "../lib/ui/page.js";

async function mount(site, uid) {
  const ctx = { user: uid === null ? null : site.user(uid), state: {} };
  const page = await app.webview(ctx, site.api(uid));
  const errors = [];
  const vc = new VirtualConsole();
  vc.on("jsdomError", (e) => { const m = String(e && e.message || e); if (!/Not implemented: HTMLCanvasElement/.test(m)) errors.push(m); });
  vc.on("error", (...a) => errors.push(a.join(" ")));
  vc.on("warn", () => {});
  const dom = new JSDOM(`<!doctype html><html><head><style>${page.css}</style></head><body>${page.html}</body></html>`, { runScripts: "outside-only", virtualConsole: vc, pretendToBeVisual: true });
  const w = dom.window;
  // the live srcdoc sandbox has no allow-modals: native dialogs must never be called
  w.scrollTo = () => {};
  w.confirm = () => { throw new Error("native confirm() called"); };
  w.prompt = () => { throw new Error("native prompt() called"); };
  const net = { lag: 0 };
  w.community = {
    call: async (method, params) => {
      if (net.lag) await new Promise((r) => setTimeout(r, net.lag));
      const out = await app.onMessage({ user: ctx.user, state: {}, method, params, now: site.now }, site.api(uid));
      site.apply(uid, out.effects ?? []);
      return out; // the page must cope with the whole handler return
    },
  };
  w.eval(page.js);
  const tick = async (ms = 30) => { await new Promise((r) => setTimeout(r, ms)); };
  const $ = (sel) => w.document.querySelector(sel);
  const $$ = (sel) => [...w.document.querySelectorAll(sel)];
  const text = () => w.document.getElementById("wd").textContent;
  const click = async (btn) => { assert.ok(btn, "button exists"); btn.click(); await tick(); await tick(); };
  const btn = (label) => $$("#wd button").find((b) => b.textContent.trim().startsWith(label));
  const tab = async (name) => { await click($$("#tabs button").find((b) => b.textContent.includes(name))); await tick(40); };
  return { w, dom, errors, tick, $, $$, text, click, btn, tab, net };
}

test("guest page renders leaderboard", async () => {
  const site = new Site();
  const p = await mount(site, null);
  await p.tick(60);
  assert.match(p.text(), /登录 NodeLoc/);
  assert.deepEqual(p.errors, []);
});

test("full client walkthrough: create, home, explore, bag, market, arena, sect, boards, bio", async () => {
  const site = new Site();
  const p = await mount(site, 7);
  await p.tick(60);
  assert.match(p.text(), /踏上仙路/);
  p.$("#app input").value = "云中客";
  await p.click(p.btn("定下道号"));
  assert.match(p.text(), /测灵根/);
  await p.click(p.btn("逆天改命"));
  await p.click(p.btn("就这样"));
  await p.tick(60);
  assert.match(p.text(), /洞府/);
  assert.match(p.$("#top").textContent, /云中客/);
  // breathe
  await p.click(p.btn("吐纳"));
  assert.match(p.text(), /修为/);
  // minor breakthrough via overlay
  site.setChar(7, (c) => { c.xp = stageNeed(0, 0); });
  await p.tab("洞府");
  await p.click(p.btn("突破"));
  assert.ok(!p.$("#overlay").classList.contains("hidden"), "result overlay shown");
  await p.click(p.btn("继续"));
  // explore
  await p.tab("游历");
  assert.match(p.text(), /青山村/);
  await p.click(p.btn("前往"));
  await p.tick(40);
  const opts = p.$$("#wd button.opt");
  assert.ok(opts.length >= 2, "event options rendered");
  await p.click(opts.find((b) => !b.disabled));
  await p.tick(120);
  // a battle replay overlay may be open; skip through it
  if (!p.$("#overlay").classList.contains("hidden")) { await p.click(p.btn("跳过")); await p.click(p.$$("#overlay button.pri")[0]); }
  assert.match(p.text(), /经过|奇遇|遭遇|游历/);
  // bag
  site.setChar(7, (c) => { c.inv.stack.m_tiekuang = 10; c.ls = 500; });
  await p.tab("行囊");
  assert.match(p.text(), /材料|丹药/);
  await p.click(p.btn("法宝"));
  await p.click(p.btn("功法神通"));
  assert.match(p.text(), /太玄吐纳诀/);
  await p.click(p.btn("炼制"));
  assert.match(p.text(), /炼丹/);
  await p.click(p.btn("开炉"));
  // market
  await p.tab("坊市");
  assert.match(p.text(), /坊市/);
  assert.match(p.text(), /拍卖行/);
  const buy = p.$$("#wd button").find((b) => b.textContent === "买" && !b.disabled);
  if (buy) await p.click(buy);
  // arena + boss
  await p.tab("论道");
  assert.match(p.text(), /论道/);
  assert.match(p.text(), /讨伐/);
  await p.click(p.btn("出手"));
  await p.tick(120);
  if (!p.$("#overlay").classList.contains("hidden")) { await p.click(p.btn("跳过")); await p.click(p.$$("#overlay button.pri")[0]); }
  // sect
  await p.tab("宗门");
  assert.match(p.text(), /散修/);
  // boards
  await p.tab("榜单");
  assert.match(p.text(), /云中客/);
  await p.click(p.btn("战力"));
  await p.click(p.btn("宗门"));
  // 道册（原「传记」页签）
  await p.tab("道册");
  assert.match(p.text(), /今日/);
  await p.click(p.btn("传记"));
  await p.tick(60);
  assert.match(p.text(), /年谱/);
  assert.deepEqual(p.errors, []);
});

test("tribulation overlay walks every bolt from the client", async () => {
  const site = new Site();
  const p = await mount(site, 8);
  await p.tick(60);
  p.$("#app input").value = "渡劫者";
  await p.click(p.btn("定下道号"));
  await p.click(p.btn("就这样"));
  site.setChar(8, (c) => { c.r = 0; c.s = 8; c.xp = stageNeed(0, 8); });
  await p.tab("洞府");
  await p.click(p.btn("引动"));
  assert.ok(!p.$("#overlay").classList.contains("hidden"));
  let guard = 0;
  while (guard++ < 20) {
    // 按钮上现在还带着这道雷的预估伤害（「招架 −27%」），所以按前缀找
    const b = p.$$("#overlay button").find((x) => x.textContent.indexOf("招架") === 0 && !x.disabled);
    if (!b) break;
    await p.click(b);
    await p.tick(40);
  }
  assert.ok(p.btn("天地归于平静"), "tribulation finished");
  await p.click(p.btn("天地归于平静"));
  assert.deepEqual(p.errors, []);
});

test("death screen offers rebirth", async () => {
  const site = new Site();
  const p = await mount(site, 9);
  await p.tick(60);
  p.$("#app input").value = "将死者";
  await p.click(p.btn("定下道号"));
  await p.click(p.btn("就这样"));
  site.setChar(9, (c) => { c.born = site.now - 40 * 86400000; });
  await p.tab("洞府");
  assert.match(p.text(), /坐化/);
  p.$("#app input").value = "再来";
  await p.click(p.btn("转世"));
  await p.tick(60);
  assert.match(p.$("#top").textContent, /再来/);
  assert.deepEqual(p.errors, []);
});

test("in-page scroll modals replace confirm/prompt: 择道, 卖出, 捐献", async () => {
  const site = new Site();
  const p = await mount(site, 10);
  await p.tick(60);
  p.$("#app input").value = "问修";
  await p.click(p.btn("定下道号"));
  await p.click(p.btn("就这样"));
  site.setChar(10, (c) => { c.r = 1; c.s = 0; c.inv.stack.m_lingcao = 5; });
  await p.tab("洞府");
  const path = p.$$("#app .item.path").find((el) => el.textContent.includes("剑修"));
  assert.ok(path, "path card rendered after 筑基");
  path.click(); await p.tick(40);
  assert.ok(p.$("#wd .modal"), "confirm modal opened");
  assert.match(p.$("#wd .modal .mq").textContent, /剑修/);
  await p.click(p.$$("#wd .modal button").find((b) => b.textContent === "取消"));
  assert.equal(p.$("#wd .modal"), null, "cancel closes the modal");
  assert.equal(site.char(10).path, null);
  path.click(); await p.tick(40);
  await p.click(p.$$("#wd .modal button").find((b) => b.textContent === "确认"));
  await p.tick(80);
  assert.equal(site.char(10).path, "jian");
  assert.match(p.$("#top").textContent, /剑修/);
  // prompt-style modal with an input
  await p.tab("行囊");
  const herb = p.$$("#app .item").find((el) => el.textContent.includes("灵草"));
  await p.click([...herb.querySelectorAll("button")].find((b) => b.textContent === "卖出"));
  const inp = p.$("#wd .modal input");
  assert.ok(inp, "input modal opened");
  assert.equal(inp.value, "5");
  inp.value = "2";
  await p.click(p.$$("#wd .modal button").find((b) => b.textContent === "确认"));
  await p.tick(80);
  assert.equal(site.char(10).inv.stack.m_lingcao, 3);
  // donate through the modal default value
  site.setChar(10, (c) => { c.r = 2; c.ls = 9000; });
  await p.tab("宗门");
  p.$$("#app input")[0].value = "问剑宗";
  await p.click(p.btn("开宗立派"));
  await p.tick(60);
  const ls0 = site.char(10).ls;
  await p.click(p.btn("捐献"));
  assert.equal(p.$("#wd .modal input").value, "100");
  await p.click(p.$$("#wd .modal button").find((b) => b.textContent === "确认"));
  await p.tick(80);
  assert.equal(site.char(10).ls, ls0 - 100);
  assert.deepEqual(p.errors, []);
});

// ---- v6: 淬炼 / 灵田 / 灵兽
async function newPlayer(site, uid, name) {
  const p = await mount(site, uid);
  await p.tick(60);
  p.$("#app input").value = name;
  await p.click(p.btn("定下道号"));
  await p.click(p.btn("就这样"));
  await p.tick(40);
  return p;
}

test("淬炼 panel: reforge charges, star merge goes through the page modal, runes socket", async () => {
  const site = new Site();
  const p = await newPlayer(site, 21, "淬炼客");
  site.setChar(21, (c) => {
    c.r = 1; c.ls = 100000; c.inv.stack.m_shuijing = 30; c.inv.stack.r_feng = 1; c.ic = 2;
    c.inv.arts = [{ iid: 1, id: "f_shuijian", q: 1, af: [{ st: "atk", v: 5, n: "锋锐" }] }, { iid: 2, id: "f_shuijian", q: 1, af: [] }];
  });
  await p.tab("行囊");
  await p.click(p.btn("法宝"));
  await p.click(p.btn("淬炼"));
  assert.ok(!p.$("#overlay").classList.contains("hidden"), "the 淬炼 panel opened");
  assert.match(p.text(), /淬炼 · 碧水剑/);
  assert.match(p.text(), /符纹/);
  const ls0 = site.char(21).ls;
  await p.click(p.btn("重铸"));
  await p.tick(60);
  assert.equal(site.char(21).ls, ls0 - 150, "the reforge fee was charged once");
  assert.equal(site.char(21).inv.arts[0].af.length, 1);
  // the star merge asks before it eats the spare
  await p.click(p.btn("合炉"));
  assert.ok(p.$("#wd .modal"), "star merge uses the in-page modal, never confirm()");
  await p.click(p.$$("#wd .modal button").find((b) => b.textContent === "取消"));
  assert.equal(site.char(21).inv.arts.length, 2, "cancelling keeps the sacrifice");
  await p.click(p.btn("合炉"));
  await p.click(p.$$("#wd .modal button").find((b) => b.textContent === "确认"));
  await p.tick(80);
  assert.equal(site.char(21).inv.arts.length, 1, "the spare was consumed");
  assert.equal(site.char(21).inv.arts[0].q, 2, "one star up at 100%");
  await p.click(p.btn("锋锐纹"));
  await p.tick(60);
  assert.equal(site.char(21).inv.arts[0].rn.length, 1, "the rune went in");
  await p.click(p.btn("收炉"));
  assert.ok(p.$("#overlay").classList.contains("hidden"), "the panel closed");
  assert.deepEqual(p.errors, []);
});

test("灵田: pick a seed on the 洞府 card, sow a plot, harvest it", async () => {
  const site = new Site();
  const p = await newPlayer(site, 22, "药圃主");
  site.setChar(22, (c) => { c.inv.stack.s_lingcao = 2; });
  await p.tab("洞府");
  assert.match(p.text(), /灵田药圃/);
  const plot = p.$$("#app .item").find((el) => el.textContent.includes("空田 1"));
  assert.ok(plot, "an empty plot is drawn");
  await p.click(plot);
  await p.tick(20);
  const pick = p.$$("#overlay .item").find((el) => el.textContent.includes("灵草种"));
  assert.ok(pick, "the seed picker lists the seed");
  await p.click(pick);
  await p.tick(80);
  assert.equal(site.char(22).farm.plots[0].seed, "s_lingcao", "sown");
  assert.equal(site.char(22).inv.stack.s_lingcao, 1);
  site.setChar(22, (c) => { c.farm.plots[0].ready = site.now - 1000; });
  await p.tab("洞府");
  assert.match(p.text(), /可收 灵草/);
  await p.click(p.btn("收获"));
  await p.tick(80);
  assert.ok(site.char(22).inv.stack.m_lingcao >= 5, "the herbs landed in the bag");
  assert.equal(site.char(22).farm.plots[0], null, "the plot is empty again");
  const rv = p.$("#wd .rvl");
  if (rv) { rv.click(); await p.tick(60); }
  assert.deepEqual(p.errors, []);
});

test("灵兽 sub-page: send the beast out and collect what it brings back", async () => {
  const site = new Site();
  const p = await newPlayer(site, 23, "驭兽客");
  site.setChar(23, (c) => { c.r = 1; c.pet = { id: "e_linghu", name: "灵狐", elem: "火", atk: 0.3, hp: 0.3, lv: 0, xp: 0, hpP: 1, ev: 0, trip: null }; });
  await p.tab("行囊");
  await p.click(p.btn("灵兽"));
  assert.match(p.text(), /灵狐/);
  assert.match(p.text(), /远行（今日余 3 次）/);
  await p.click(p.btn("8 小时"));
  await p.tick(80);
  const trip = site.char(23).pet.trip;
  assert.ok(trip, "the beast left");
  assert.equal(trip.h, 8);
  assert.match(p.text(), /余 8 小时/);
  site.advance(8 * 3600 * 1000);
  await p.click(p.btn("灵兽"));
  await p.tick(60);
  assert.match(p.text(), /已归来/);
  const before = Object.keys(site.char(23).inv.stack).length;
  await p.click(p.btn("收取"));
  await p.tick(80);
  assert.equal(site.char(23).pet.trip, null, "the trip is done");
  assert.ok(Object.keys(site.char(23).inv.stack).length >= before, "it brought something home");
  assert.ok(site.char(23).pet.xp > 0 || site.char(23).pet.lv > 0, "and gained some experience");
  const rv = p.$("#wd .rvl");
  if (rv) { rv.click(); await p.tick(60); }
  assert.deepEqual(p.errors, []);
});

test("道册：悬赏子页领赏走 rpc，成就与传记子页可切换", async () => {
  const site = new Site();
  const p = await mount(site, 12);
  await p.tick(60);
  p.$("#app input").value = "册中人";
  await p.click(p.btn("定下道号"));
  await p.click(p.btn("就这样")); // 走完测灵根，页签才挂出来
  await p.tick(80);
  // 钉住今日三张悬赏，并把第一张做完
  site.setChar(12, (c) => { c.daily.bo = ["fight", "kill", "win"]; c.daily.bs = { ...c.stats }; c.stats.fights += 20; });
  await p.tab("道册");
  assert.match(p.text(), /今日 1\/3/);
  assert.match(p.text(), /手别生了/);
  const ls0 = site.char(12).ls;
  await p.click(p.btn("领取"));
  await p.tick(150);
  assert.equal(site.char(12).daily.claim.b0, 1, "服务端记了账");
  assert.ok(site.char(12).ls > ls0, "赏金到手");
  // 成就
  await p.click(p.btn("成就"));
  await p.tick(80);
  assert.match(p.text(), /初试锋芒|三世修者/);
  assert.match(p.text(), /不用称号/);
  // 图鉴：物品按类、妖兽带出没与掉落
  await p.click(p.btn("图鉴"));
  await p.tick(120);
  assert.match(p.text(), /件物品/);
  assert.match(p.text(), /回血丹.*回复一半气血/, "丹药默认在列，说明与数字都在");
  await p.click(p.btn("妖兽"));
  await p.tick(120);
  assert.match(p.text(), /野狼.*出没：青山村.*掉落：妖兽皮/);
  // 传记
  await p.click(p.btn("传记"));
  await p.tick(80);
  assert.match(p.text(), /年谱/);
  assert.deepEqual(p.errors, []);
});

test("坊市：在拍列表看得见法宝词缀、符纹与物品说明；榜单前三带境界与流派", async () => {
  const site = new Site();
  // 另一位卖家挂一件带词缀的法宝
  site.shared.set("auction:99:1", { aid: "99:1", uid: 99, n: "铸剑客", min: 100, end: site.now + 3600e3 * 20, t: site.now, item: { k: "art", id: "f_tiejian", name: "精铁剑", q: 3, t: 0, slot: "w", af: [{ st: "atk", v: 12, n: "锋锐" }], rn: [{ st: "def", v: 4, id: "r_shi" }] } });
  site.shared.set("auction:99:2", { aid: "99:2", uid: 99, n: "铸剑客", min: 10, end: site.now + 3600e3 * 20, t: site.now, item: { k: "pill", id: "p_huixue", name: "回血丹", n: 3, t: 0 } });
  const p = await mount(site, 13);
  await p.tick(60);
  p.$("#app input").value = "看货人";
  await p.click(p.btn("定下道号"));
  await p.click(p.btn("就这样"));
  await p.tick(80);
  await p.tab("坊市");
  await p.tick(120);
  assert.match(p.text(), /精铁剑（3星）（1纹）.*攻击 6 · 锋锐 \+12 · 符纹：防御/, "法宝的底数、词缀、符纹都列出来");
  assert.match(p.text(), /回血丹×3.*回复一半气血/, "非法宝给说明文字");
  assert.match(p.text(), /珍宝阁.*VIP1/, "珍宝阁卡片带解锁说明");
  // 榜单前三
  for (let u = 1; u <= 3; u++) site.shared.set(`p:${u}`, { uid: u, n: "榜上人" + u, r: 4, s: 2, pw: 1000 * u, pa: "jian", title: u === 1 ? "斩妖人" : null, t: site.now });
  await p.tab("榜单");
  await p.tick(120);
  assert.match(p.text(), /榜上人3剑修化神后期/, "领奖台带境界与流派");
  assert.match(p.text(), /斩妖人/, "称号也在");
  assert.deepEqual(p.errors, []);
});

test("宗门建设卡：掌门可升级建筑，本周宗务与俸禄同屏", async () => {
  const site = new Site();
  const p = await mount(site, 13);
  await p.tick(60);
  p.$("#app input").value = "云顶子";
  await p.click(p.btn("定下道号"));
  await p.click(p.btn("就这样"));
  await p.tick(80);
  site.setChar(13, (c) => { c.r = 2; c.ls = 60000; });
  await p.tab("宗门");
  p.$$("#app input")[0].value = "云顶宗";
  await p.click(p.btn("开宗立派"));
  await p.tick(90);
  await p.click(p.btn("捐献"));
  p.$("#wd .modal input").value = "5000";
  await p.click(p.$$("#wd .modal button").find((b) => b.textContent === "确认"));
  await p.tick(120);
  assert.match(p.text(), /宗门建设/);
  assert.match(p.text(), /库藏 500/);
  assert.match(p.text(), /本周宗务/);
  assert.match(p.text(), /捐献贡献/);
  await p.click(p.btn("升级 500"));
  await p.click(p.$$("#wd .modal button").find((b) => b.textContent === "确认"));
  await p.tick(150);
  assert.equal(site.shared.get("sect:s13").bld.cj, 1, "藏经阁一级");
  assert.equal(site.shared.get("sect:s13").spent, 500);
  assert.deepEqual(p.errors, []);
});

test("client: 秘境 sub-page walks a floor and banks the run through the in-page modal", async () => {
  const site = new Site();
  const p = await mount(site, 21);
  await p.tick(60);
  p.$("#app input").value = "秘境客";
  await p.click(p.btn("定下道号"));
  await p.click(p.btn("就这样"));
  // c.sk is random per character and seeds the run, so pin it: the doors are then the same every run
  site.setChar(21, (c) => { c.r = 8; c.s = 0; c.hpP = 1; c.mpP = 1; c.sk = "client-dg"; });
  await p.tab("游历");
  await p.click(p.btn("秘境"));
  await p.tick(60);
  assert.match(p.text(), /寻幽/, "difficulties listed");
  await p.click(p.btn("寻幽"));
  await p.tick(60);
  assert.match(p.text(), /第 1\/8 层/);
  // take a door, then settle whatever it turned out to be — a 行商/机缘/异象 needs one more tap,
  // and 收手 refuses to walk out on an unresolved 异象
  for (let guard = 0; guard < 4; guard++) {
    const doors = p.$$("#wd button.dgo, #wd button.opt").filter((b) => !b.disabled);
    if (guard === 0) assert.ok(doors.length >= 1, "the floor offers doors");
    if (!doors.length) break;
    await p.click(doors[0]);
    await p.tick(160);
    if (!p.$("#overlay").classList.contains("hidden")) {
      const skip = p.btn("跳过");
      if (skip) await p.click(skip);
      const done = p.$$("#overlay button.pri")[0];
      if (done) await p.click(done);
      await p.tick(60);
    }
    if (p.$("#wd .rvl")) { p.$("#wd .rvl").click(); await p.tick(60); }
    const run = site.char(21).dg;
    if (!run || !run.pend) break;
  }
  assert.ok(!site.char(21).dg || !site.char(21).dg.pend, "nothing is left hanging on the floor");
  if (site.char(21).dg) {
    await p.click(p.btn("收手"));
    assert.ok(p.$("#wd .modal"), "收手 asks through the in-page modal, never confirm()");
    await p.click(p.$$("#wd .modal button").find((b) => b.textContent === "确认"));
    await p.tick(140);
    if (p.$("#wd .rvl")) { p.$("#wd .rvl").click(); await p.tick(80); }
  }
  assert.equal(site.char(21).dg, null, "the run is banked");
  assert.match(p.text(), /收手而归|秘境通关|力竭而返/);
  assert.deepEqual(p.errors, []);
});

test("client: 五行连珠 runs the server's own simulator in the page and submits a score", async () => {
  const { wxSim, wxSeed } = await import("../lib/game/wuxing.js");
  const { dayKey } = await import("../lib/game/time.js");
  const site = new Site();
  const p = await mount(site, 22);
  await p.tick(60);
  p.$("#app input").value = "棋客";
  await p.click(p.btn("定下道号"));
  await p.click(p.btn("就这样"));
  await p.tab("论道");
  await p.click(p.btn("棋局"));
  await p.tick(80);
  const tiles = p.$$("#wd .wxt");
  assert.equal(tiles.length, 36, "a 6×6 board");
  const day = dayKey(site.now);
  const NAMES = ["金", "水", "木", "火", "土"];
  assert.deepEqual(tiles.map((el) => el.textContent), wxSim(wxSeed(day), []).board.map((v) => NAMES[v]), "client wxSim === server wxSim");
  const swaps = [];
  for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) { if (c < 5) swaps.push([r, c, r, c + 1]); if (r < 5) swaps.push([r, c, r + 1, c]); }
  const dud = swaps.find((sw) => !wxSim(wxSeed(day), [sw]).ok);
  await p.click(p.$("#wx" + (dud[0] * 6 + dud[1])));
  await p.click(p.$("#wx" + (dud[2] * 6 + dud[3])));
  await p.tick(60);
  assert.match(p.text(), /第 0\/20 步/, "an illegal swap is refused in the page, with no round trip");
  const mv = swaps.find((sw) => wxSim(wxSeed(day), [sw]).ok);
  await p.click(p.$("#wx" + (mv[0] * 6 + mv[1])));
  await p.click(p.$("#wx" + (mv[2] * 6 + mv[3])));
  await p.tick(400);
  assert.match(p.text(), /第 1\/20 步/);
  await p.click(p.btn("交卷"));
  assert.ok(p.$("#wd .modal"), "handing in early asks first");
  await p.click(p.$$("#wd .modal button").find((b) => b.textContent === "确认"));
  await p.tick(200);
  if (p.$("#wd .rvl")) { p.$("#wd .rvl").click(); await p.tick(80); }
  assert.equal(site.shared.get(`wx:${day}:22`).sc, wxSim(wxSeed(day), [mv]).score, "the server replayed the same move");
  assert.match(p.text(), /今日已交卷/);
  assert.deepEqual(p.errors, []);
});

test("洞府状态栏：三种减益各报剩余时间与实际影响，过期的不再出现", async () => {
  const site = new Site();
  const p = await newPlayer(site, 41, "待愈人");
  site.setChar(41, (c) => { c.dbf = { qi: site.now + 8 * 3600000, injury: site.now + 90 * 60000, heart: site.now - 1000 }; });
  await p.tab("洞府");
  const t = p.text();
  assert.match(t, /走火入魔 余 8 小时（修炼 ×0\.5）/);
  assert.match(t, /重伤 余 1 小时 30 分（气血\/攻防 ×0\.7，修炼 ×0\.6）/);
  assert.equal(/心魔 余/.test(t), false, "已过期的心魔不再列出");
  assert.match(t, /养神丹可立刻尽去/);
  assert.deepEqual(p.errors, []);
});

test("地域卡：太虚古战场锁着时写「需大乘」，不是 undefined", async () => {
  const site = new Site();
  const p = await newPlayer(site, 42, "远行人");
  await p.tab("游历");
  const t = p.text();
  assert.match(t, /太虚古战场/);
  assert.match(t, /需大乘/);
  assert.match(t, /需炼虚/, "九天罡风层");
  assert.equal(/需undefined/.test(t), false);
  assert.deepEqual(p.errors, []);
});

test("种子/符纹不再给一个必然报错的「使用」，而是指向真正的入口", async () => {
  const site = new Site();
  const p = await newPlayer(site, 43, "囊中人");
  site.setChar(43, (c) => { c.inv.stack.s_lingcao = 1; c.inv.stack.r_feng = 1; c.inv.stack.p_huixue = 1; });
  await p.tab("行囊");
  const labels = p.$$("#app button").map((b) => b.textContent.trim());
  assert.ok(labels.includes("使用"), "回血丹还是能直接用");
  assert.ok(labels.includes("去播种"), "灵草种指向灵田");
  assert.ok(labels.includes("去淬炼"), "锋锐纹指向淬炼");
  // 点「去播种」应当落到洞府，而不是弹「此物无法直接使用」
  await p.click(p.btn("去播种"));
  await p.tick(60);
  assert.match(p.text(), /灵田药圃/);
  assert.equal(/此物无法直接使用/.test(p.text()), false);
  assert.deepEqual(p.errors, []);
});

test("卖出说清楚是折半卖给坊市，跟上拍不是一回事", async () => {
  const site = new Site();
  const p = await newPlayer(site, 44, "货郎");
  await p.tab("行囊");
  assert.match(p.text(), /卖出＝折半价卖给坊市，立刻到手；上拍＝挂拍卖行 24 小时/);
  assert.deepEqual(p.errors, []);
});

test("成就页说明称号从哪来、戴上后在哪显示", async () => {
  const site = new Site();
  const p = await newPlayer(site, 45, "无名氏");
  await p.tab("道册");
  await p.click(p.btn("成就"));
  await p.tick(60);
  assert.match(p.text(), /尚无称号。下面带紫色标签的成就，达成即可佩戴。/);
  assert.deepEqual(p.errors, []);
});

test("榜单：自己在榜内就留在原位，只有落到榜外才钉在末尾", async () => {
  const js = pageJs();
  const body = js.slice(js.indexOf("function lbCard("), js.indexOf("function lbCard(") + 900);
  assert.match(body, /var pin=!!\(lb\.me&&!rows\.some\(/, "按「是否已在本页」决定钉底，而不是按名次 > 3");
  assert.equal(/lb\.me\.rank>3/.test(body), false);
});

test("连点页签：慢的那次回应不能盖住新页，且被 busy 挡下的切页要补上", async () => {
  const site = new Site();
  const p = await newPlayer(site, 46, "手快人");
  const w = p.w;
  // 行囊 → 游历 → 行囊，三下都在第一次 rpc 回来之前
  const tabs = p.$$("#tabs button");
  const hit = (n) => tabs.find((b) => b.textContent.includes(n));
  hit("行囊").click(); await p.tick(80);
  p.net.lag = 150;
  hit("游历").click(); await p.tick(20);
  hit("行囊").click();
  await p.tick(800);
  p.net.lag = 0;
  await p.tick(200);
  assert.equal(w.document.querySelector("#tabs button.on")?.textContent.includes("行囊") ?? false, true, "页签停在行囊");
  assert.match(p.text(), /法宝匣|行囊 \d+\//, "内容也是行囊，不是上一次点的游历");
  assert.equal(/山高水长|每次游历消耗/.test(p.text()), false, "游历的内容没有残留");
  assert.deepEqual(p.errors, []);
});
