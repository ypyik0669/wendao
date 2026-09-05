// Blocks surface: the game rendered as the platform's native component tree.
// Every handler call re-renders the current tab from `view` (what core returned) + `ui` (signed state).
import { bannerArt, sealArt, regionArt, itemArt, monArt } from "./art.js";
import { PATHS, SUB_PATHS } from "../data/paths.js";
import { REALMS } from "../data/realms.js";

const TABS = [["home", "洞府"], ["explore", "游历"], ["bag", "行囊"], ["market", "坊市"], ["arena", "论道"], ["sect", "宗门"], ["lb", "榜单"], ["bio", "道册"]];
const TAB_METHOD = { home: "home", explore: "regions", bag: "bag", market: "shop", arena: "arena", sect: "sect", lb: "lb", bio: "bio" };
const PRIMARY = { "trib.step": "act", path: "id", sub: "id", explore: "region", choose: "opt", use: "id", "book.seal": "id", equip: "iid", unequip: "slot", sellArt: "iid", gongfa: "id", craft: "id", buy: "idx", "arena.fight": "uid", "sect.join": "sid", "auction.bid": "aid", sell: "id", "arts.toggle": "id", "sect.view": "sid", "auction.create": "id", "auction.createArt": "iid", "refine.view": "iid", "refine.star": "iid", "farm.tend": "i", "farm.harvest": "i", "farm.clear": "i", "pet.feed": "item", "bounty.claim": "i", "ach.title": "id", "sect.build": "b", "dg.enter": "diff", "dg.pick": "i", "dg.use": "id", "vshop.buy": "idx" };
const REALM_SHORT = ["炼气", "筑基", "金丹", "元婴", "化神", "炼虚", "合体", "大乘", "渡劫", "仙"];
// 减益的名字 + 它到底扣什么，两端共用一份口径（page.js 的 DBFN 同源）
const DBF_N = { qi: ["走火入魔", "修炼 ×0.5"], injury: ["重伤", "气血/攻防 ×0.7，修炼 ×0.6"], heart: ["心魔", "灵力 ×0.7，暴击 −3%，修炼 ×0.75，突破 −10%"] };
const PATHN = Object.fromEntries(PATHS.map((p) => [p.id, p.name]));
const SUBN = Object.fromEntries(SUB_PATHS.map((p) => [p.id, p.name]));
const KINDN = { mat: "材料", pill: "丹药", tal: "符箓", egg: "兽卵", misc: "杂物", book: "典籍" };
const SLOTN = { w: "武器", a: "护甲", r: "饰品" };
const STN = { atk: "攻击", def: "防御", hp: "气血", mp: "灵力", spd: "速度", crit: "暴击", rate: "修炼", spell: "术法" };
const PAIRED = { "refine.reforge": ["iid", "slot"], "refine.rune": ["iid", "rune"], "refine.unrune": ["iid", "k"], "farm.plant": ["i", "seed"], "pet.send": ["region", "hours"], use: ["id", "confirm"] };
const ELI = { 金: "⚔", 木: "🌿", 水: "💧", 火: "🔥", 土: "⛰", 雷: "⚡", 无: "○" };

export function normalizeUi(ui) {
  const u = ui && typeof ui === "object" ? ui : {};
  return { tab: TABS.some((t) => t[0] === u.tab) ? u.tab : "home", sub: typeof u.sub === "string" ? u.sub : "", lbType: typeof u.lbType === "string" ? u.lbType : "realm", msg: null, res: Array.isArray(u.res) ? u.res.slice(0, 14) : null, battle: Array.isArray(u.battle) ? u.battle.slice(0, 16) : null, trib: Array.isArray(u.trib) ? u.trib.slice(0, 8) : null };
}
export function tabMethod(tab) { return TAB_METHOD[tab] ?? "home"; }
export function trimUi(ui, view) {
  return { tab: ui.tab, sub: ui.sub, lbType: ui.lbType, res: ui.res, battle: ui.battle, trib: ui.trib };
}

// action_id grammar -> core method. Mutates ui (tab/sub/lbType). Inputs are passed through by name.
export function mapAction(actionId, inputs, ui) {
  const parts = actionId.split(":");
  const kind = parts[0];
  const params = {};
  for (const [k, v] of Object.entries(inputs ?? {})) if (typeof v === "string" && v.length <= 200) params[k] = v;
  ui.msg = null;
  if (kind === "tab") { ui.tab = TABS.some((t) => t[0] === parts[1]) ? parts[1] : "home"; ui.sub = ""; ui.res = null; ui.battle = null; return { method: ui.tab === "lb" ? "lb" : tabMethod(ui.tab), params: ui.tab === "lb" ? { type: ui.lbType } : {} }; }
  if (kind === "sub") { ui.sub = parts[1] ?? ""; ui.battle = null; return { method: tabMethod(ui.tab), params: {} }; }
  if (kind === "lb") { ui.lbType = parts[1] ?? "realm"; ui.tab = "lb"; return { method: "lb", params: { type: ui.lbType } }; }
  if (kind === "do") {
    const method = parts[1] ?? "home";
    const arg = parts.slice(2).join(":");
    if (method === "sect.manage") { const [action, uid] = arg.split("/"); return { method, params: { ...params, action, uid } }; }
    if (method === "sell") return { method, params: { id: arg, n: params["n_" + arg] ?? params.n ?? "1" } };
    if (method === "auction.bid") return { method, params: { aid: arg, amt: params["amt_" + arg] ?? params.amt } };
    if (method === "auction.create") return { method, params: { item: { id: arg, n: Number(params["n_" + arg] ?? params.n ?? 1) }, min: params["min_" + arg] ?? params.min } };
    if (method === "auction.createArt") return { method: "auction.create", params: { item: { iid: Number(arg) }, min: params["min_a" + arg] ?? params.min } };
    if (method === "tab.arena.boss") { ui.tab = "arena"; ui.sub = "boss"; return { method: "arena", params: {} }; }
    // v6: the handful of actions that carry two values pack them as "a/b"
    if (PAIRED[method] && arg.includes("/")) { const v = arg.split("/"); const k = PAIRED[method]; return { method, params: { ...params, [k[0]]: v[0], [k[1]]: v[1] } }; }
    if (PRIMARY[method] && arg !== "") params[PRIMARY[method]] = arg;
    return { method, params };
  }
  return { method: tabMethod(ui.tab), params: {} };
}

// ---------------------------------------------------------------- primitives
const T = (value, o = {}) => ({ type: "text", value: String(value ?? ""), ...o });
const B = (label, action, o = {}) => ({ type: "button", label: String(label).slice(0, 40), action, ...o });
const V = (children, o = {}) => ({ type: "vstack", gap: "small", children: children.filter(Boolean), ...o });
const H = (children, o = {}) => ({ type: "hstack", gap: "small", align: "center", children: children.filter(Boolean), ...o });
const P = (value, max) => ({ type: "progress", value: Math.max(0, Math.min(max || 1, Math.round(value))), max: Math.max(1, Math.round(max || 1)) });
const I = (name, placeholder, value) => ({ type: "input", name, placeholder, ...(value !== undefined ? { value: String(value) } : {}) });
const DIV = { type: "divider" };
const SP = { type: "spacer", size: "small" };
const muted = (v) => T(v, { size: "small" });
const title = (v) => T(v, { size: "large", weight: "bold" });
const h4 = (v) => T(v, { weight: "bold" });
const fmt = (n) => { n = Number(n) || 0; if (Math.abs(n) >= 1e8) return (n / 1e8).toFixed(2) + "亿"; if (Math.abs(n) >= 1e4) return (n / 1e4).toFixed(n >= 1e6 ? 0 : 1) + "万"; return String(Math.round(n)); };
const rows = (list, fn, max = 15) => list.slice(0, max).map(fn);

// ---------------------------------------------------------------- screens
export function renderBlocks(view, ui) {
  try {
    return V(sc_screen(view, ui), { padding: "medium" });
  } catch (e) {
    return V([title("问道"), T("界面出了点岔子：" + (e && e.message ? e.message : String(e))), B("重试", "tab:home", { variant: "primary" })], { padding: "medium" });
  }
}

function sc_screen(view, ui) {
  if (!view || typeof view !== "object") return [title("问道"), B("重试", "tab:home")];
  if (view.guest) return sc_guest(view);
  if (view.need === "create") return sc_create(view);
  const me = view.me;
  if (!me) return [title("问道"), T(view.msg ?? "未能载入角色"), B("重试", "tab:home", { variant: "primary" })];
  if (me.dead || me.ascended) return sc_end(view);
  const d = view.data ?? {};
  const out = [sc_header(me, view), sc_nav(ui.tab), d.home?.trib ? null : bannerArt(ui.tab)].filter(Boolean);
  if (view.msg) out.push(T((view.ok === false ? "✗ " : "✓ ") + view.msg, { weight: "medium" }));
  for (const n of (view.notes ?? []).slice(0, 4)) out.push(muted("· " + n.v));
  if (d.home?.trib) return out.concat(sc_tribulation(view, ui));
  switch (ui.tab) {
    case "home": return out.concat(sc_home(view, ui));
    case "explore": return out.concat(sc_explore(view, ui));
    case "bag": return out.concat(sc_bag(view, ui));
    case "market": return out.concat(sc_market(view, ui));
    case "arena": return out.concat(sc_arena(view, ui));
    case "sect": return out.concat(sc_sect(view, ui));
    case "lb": return out.concat(sc_lb(view, ui));
    case "bio": return out.concat(sc_bio(view, ui));
    default: return out.concat(sc_home(view, ui));
  }
}

function sc_guest(view) {
  const lbv = view.data ?? {};
  return [bannerArt("guest"), muted("登录 NodeLoc 后方可踏上仙路。从凡人到仙人：挂机修炼、渡劫、游历奇遇、炼丹炼器、论道竞技、宗门、赛季榜单。"), DIV, h4("境界榜"),
    ...rows(lbv.rows ?? [], (r) => T(`${r.rank}. ${r.n} · ${r.realm}`, { size: "small" }), 10)];
}
function sc_create(view) {
  const lg = view.legacy ?? {};
  return [bannerArt("create"), T("你是一个普通人。夜里抬头，远处山顶有修士御剑而过。从今天起，你也要走那条路。"),
    lg.lives ? muted(`道统 ${lg.pts} 点，这是你的第 ${lg.lives + 1} 世。前世的功法与神通会随你转生。`) : null,
    view.msg ? T("✗ " + view.msg) : null,
    I("name", "取一个道号（2-8 字）"), B("定下道号", "do:create", { variant: "primary" })];
}
function sc_end(view) {
  const me = view.me, d = view.data ?? {};
  return [title(me.ascended ? "飞升" : "坐化"),
    T(me.ascended ? `九重雷劫散尽，云开处金光万丈。${me.name}，飞升了。仙籍已录。你可以转世，带着道统从头再修一世。` : `${me.name}于${me.age}岁寿元耗尽，坐化于洞府。修仙是一场人生，这一世到此为止。`),
    muted(`此生道统 +${d.legacyPreview ?? 0}；道统每点：修炼与气血 +2%。转世保留最高阶的两部功法与所有神通。`),
    view.msg ? T("✗ " + view.msg) : null,
    I("name", "转世后的道号", me.name), B("转世", "do:rebirth", { variant: "primary" }), B("回顾此生", "tab:bio")];
}

function sc_header(me, view) {
  const st = me.stats ?? {};
  const tags = [me.path ? PATHN[me.path] : null, me.sub ? SUBN[me.sub] : null, me.title].filter(Boolean).join(" · ");
  return H([sealArt(me.r), V([
    H([T(me.name, { weight: "bold", size: "large" }), tags ? muted(tags) : null]),
    H([muted(`💎 ${fmt(me.ls)}`), muted(`⚡ ${me.st}/${me.stMax}`), muted(`${me.age}/${me.life} 岁`), muted(`战力 ${fmt(st.power)}`)]),
    H([muted("气血"), P(me.hp, st.hp), muted(`${fmt(me.hp)}/${fmt(st.hp)}`)]),
    H([muted("修为"), P(me.xp, me.need), muted(`${me.pct}% · +${fmt(st.ratePerHour)}/时`)]),
  ], { gap: "xs" })], { align: "start" });
}
function sc_nav(tab) {
  const btn = (t) => B(t[1], "tab:" + t[0], { variant: tab === t[0] ? "primary" : "secondary" });
  return V([H(TABS.slice(0, 4).map(btn)), H(TABS.slice(4).map(btn))], { gap: "xs" });
}
function sc_subnav(ui, items) {
  return H(items.map(([id, label]) => B(label, "sub:" + id, { variant: (ui.sub || items[0][0]) === id ? "primary" : "flat" })));
}

// ---------------------------------------------------------------- home
function sc_home(view, ui) {
  const me = view.me, d = view.data?.home ?? {}, st = me.stats ?? {};
  const root = me.root ?? { e: [] };
  const out = [];
  if (d.event && d.event.list?.length) out.push(muted("今日活动：" + d.event.list.map((e) => `${e.name}（${e.desc}）`).join("、")));
  if (d.honors?.length) out.push(muted("仙门喜报：" + d.honors.map((x) => `${x.n} 晋升 VIP${x.lv}`).join("、")));
  if (d.mentor?.master) out.push(muted(`师承 ${d.mentor.master.n}`));
  if (d.mentor?.kids?.length) out.push(muted(`门下：${d.mentor.kids.map((k) => k.n).join("、")}`));
  if (me.rerolls > 0 && me.r === 0 && me.s === 0 && (me.stats ? true : true) && me.xp < 10) {
    out.push(V([h4("测灵根"), T(`${root.e.join("")}灵根 · 修炼 ×${st.rate}`), muted("灵根决定修炼速度与术法亲和。天灵根万中无一；杂灵根最难，但走过的人也最多。"), B(`逆天改命（剩 ${me.rerolls} 次）`, "do:reroll")]));
    out.push(DIV);
  }
  let btBtn;
  if (me.canBt && d.major) btBtn = B(`引动${d.nextRealm ?? ""}之劫`, "do:trib.start", { variant: "primary" });
  else if (me.canBt) btBtn = B(`突破 ${d.nextRealm ?? ""}（${Math.round((d.btChance ?? 0) * 100)}%）`, "do:bt", { variant: "primary" });
  else btBtn = B("修为未满", "do:home", { disabled: true });
  const breathLeft = Math.ceil((d.breathCd ?? 0) / 1000);
  out.push(V([
    h4(`洞府 · ${d.role ?? "散修"}${d.sectName ? "（" + d.sectName + "）" : ""}`),
    muted(`灵根 ${root.e.join("")} · 功法《${d.gf?.name ?? ""}》· 修炼 ${fmt(st.ratePerHour)}/时（基础 ${fmt(Math.round(st.ratePerHour / st.rate))} ×${st.rate}，已乘）· 离线上限 ${d.capHours ?? 12} 小时`),
    muted(`寿元 ${me.age}/${me.life} 岁 · 悟性 ${me.wu} · 丹毒 ${me.tox}${me.life - me.age < 30 ? " · ⚠ 大限将至" : ""}`),
    sc_statusLine(me),
    H([B(breathLeft > 0 ? `吐纳（${breathLeft}s）` : "吐纳", "do:breathe", { disabled: breathLeft > 0 }), btBtn]),
    muted("吐纳每 10 分钟一次、每日 30 次。小境界突破失败会走火入魔；大境界需渡劫。"),
  ]));
  if (d.farm) {
    const f = d.farm, seed = (f.seeds ?? [])[0];
    out.push(DIV, h4(`灵田 ${f.plots.filter((p) => p.seed).length}/${f.n}`));
    for (const p of f.plots) {
      if (!p.seed) out.push(H([B(seed ? `播 ${seed.name}` : "空田（无种子）", seed ? `do:farm.plant:${p.i}/${seed.id}` : "do:home", { disabled: !seed }), muted(`第 ${p.i + 1} 块`)]));
      else if (p.withered) out.push(H([B("清理", `do:farm.clear:${p.i}`), muted(`${p.name} · 已枯萎`)]));
      else if (p.ready) out.push(H([B("收获", `do:farm.harvest:${p.i}`, { variant: "primary" }), muted(`${p.name} · 可收 ${p.matName}`)]));
      else out.push(H([p.ev ? B(`处理（${p.ev.cost}）`, `do:farm.tend:${p.i}`) : null, muted(`${p.name} ${p.pct}%${p.ev ? " ⚠ " + p.ev.n : ""}${p.hurt ? " 受损" + p.hurt : ""}`), P(p.pct, 100)]));
    }
    if (seed) out.push(muted(`手中种子：${f.seeds.map((s) => s.name + "×" + s.n).join("、")}`));
  }
  if (d.canPath || d.canSub || d.canRespec) {
    const isSub = d.canSub && !d.canPath;
    const list = isSub ? (d.subs ?? SUB_PATHS) : (d.paths ?? PATHS);
    out.push(DIV, h4(isSub ? "兼修副业（金丹后，一次定终身）" : d.canPath ? "择道（筑基后）" : `转修（${d.respecCost} 灵石，修为减半）`));
    for (const p of list) out.push(H([B(`${p.icon} ${p.name}`, `do:${isSub ? "sub" : "path"}:${p.id}`, { variant: me.path === p.id ? "primary" : "secondary" }), muted(p.desc)]));
  }
  out.push(DIV, h4("根骨"), muted(`气血 ${fmt(st.hp)} · 灵力 ${fmt(st.mp)} · 攻 ${fmt(st.atk)} · 防 ${fmt(st.def)} · 速 ${st.spd} · 暴击 ${Math.round((st.crit ?? 0) * 100)}% · 术法 ×${st.spell} · 属性 ${st.elem ?? "无"}${ELI[st.elem] ?? ""}`),
    muted(`突破加成 +${Math.round((st.bt ?? 0) * 100)}% · 劫雷减免 ${Math.round((st.trib ?? 0) * 100)}% · 道统 ${me.legacy} 点 · 第 ${me.lives} 世${me.pet ? ` · 灵兽 ${me.pet.name} ${me.pet.lv} 级` : ""}`));
  const w = view.world;
  if (w) out.push(DIV, H([muted(`第 ${w.season.n + 1} 赛季，余 ${w.season.daysLeft} 天 · 今日 ${w.weather}，${w.boss.icon} ${w.boss.name} 现世`), B("去讨伐", "do:tab.arena.boss", { variant: "flat" })]));
  if (d.defLog?.length) { out.push(DIV, h4("被挑战")); for (const x of d.defLog.slice(0, 5)) out.push(muted(`${x.n} 向你论道 — ${x.w ? "你守住了" : "你败了"}（${x.dr >= 0 ? "+" : ""}${x.dr}）`)); }
  return out;
}
function sc_statusLine(me) {
  const now = me.now ?? 0;
  const hm = (ms) => { const m = Math.round(ms / 60000); return m < 60 ? m + " 分" : Math.floor(m / 60) + " 小时" + (m % 60 ? " " + (m % 60) + " 分" : ""); };
  const dbf = ["qi", "injury", "heart"].filter((k) => (me.dbf?.[k] ?? 0) > now)
    .map((k) => `${DBF_N[k][0]} 余 ${hm(me.dbf[k] - now)}（${DBF_N[k][1]}）`);
  const buffs = (me.buffs ?? []).map((b) => `${b.n} ×${Number(b.m).toFixed(2)}`);
  if (!dbf.length && !buffs.length) return null;
  return muted([dbf.length ? "状态：" + dbf.join("、") : "", buffs.length ? "丹效：" + buffs.join("、") : ""].filter(Boolean).join(" · "));
}

// ---------------------------------------------------------------- tribulation
const TACT = [["tank", "硬抗"], ["parry", "招架"], ["dodge", "御剑"], ["artifact", "祭法宝"], ["talisman", "避雷符"], ["pill", "定心丹"]];
function sc_tribulation(view, ui) {
  const t = view.data.home.trib;
  const bolt = t.bolts[t.bolts.length - 1] ?? { k: "雷", p: 0 };
  const out = [DIV, title(`${t.targetName}之劫 · 第 ${t.i + 1}/${t.n} 道`), H([muted("气血"), P(t.hp * 100, 100)]), H([muted("灵力"), P(t.mp * 100, 100)]),
    T(`乌云压顶。来袭：${bolt.k}劫，威能 ${Math.round(bolt.p * 100)}% · 法宝可祭 ${t.art} 次`),
    muted("硬抗 ×0.8（体修更强）· 招架耗 10% 灵力 ×0.5（法修更强）· 御剑耗 15% 灵力按速度闪避（剑修更强）· 法宝 ×0.3 · 避雷符化去此雷 · 定心丹回四成。最后一道是心魔，靠悟性。")];
  const can = t.can ?? {};
  const ok = { tank: true, parry: can.parry !== false, dodge: can.dodge !== false, artifact: !!can.artifact, talisman: !!can.talisman, pill: !!can.pill };
  out.push(H(TACT.slice(0, 3).map(([id, l]) => B(l, "do:trib.step:" + id, { variant: "primary", disabled: !ok[id] }))));
  out.push(H(TACT.slice(3).map(([id, l]) => B(l, "do:trib.step:" + id, { disabled: !ok[id] })).concat([B("逃", "do:trib.flee", { variant: "danger" })])));
  for (const l of (t.log ?? []).slice(-5).reverse()) out.push(muted(`第${l.i + 1}道${l.k}劫：${l.note}，伤 ${l.d}`));
  return out;
}

// ---------------------------------------------------------------- explore
function sc_explore(view, ui) {
  const me = view.me, d = view.data ?? {};
  const out = [sc_subnav(ui, [["explore", "游历"], ["dg", "秘境"]])];
  if ((ui.sub || "explore") === "dg") return out.concat(sc_dungeon(view, ui));
  if (d.result) out.push(...sc_resultBlock(d.result));
  const ev = d.event;
  if (ev) {
    out.push(h4(ev.enc ? "遭遇" : "奇遇"));
    if (ev.enc) out.push(H([monArt(ev.enc.id), V([T(ev.enc.name, { weight: "bold" }), muted((ev.enc.elem ? ev.enc.elem + "属性 · " : "") + (ev.enc.desc ?? ""))], { gap: "xs" })]));
    out.push(T(ev.text));
    for (const o of ev.opts ?? []) out.push(H([B(o.label, "do:choose:" + o.id, { variant: o.ok ? "primary" : "secondary", disabled: !o.ok }), o.req ? muted(o.req) : null]));
    return out;
  }
  out.push(h4(`游历 · 体力 ${me.st}/${me.stMax} · 今日 ${me.daily?.exp ?? 0}/${d.daily ?? 20}`), muted(d.ev?.hot ? "🌊 妖潮进行中：掉落 ×1.5、遭妖更多" : "每晚 20:00–22:00（北京时间）妖潮：就在这里游历，掉落 ×1.5，不是副本。妖兽会什么神通就可能掉什么秘籍。"), muted("每次游历消耗 1 体力（每半小时回 1 点，上限 10）。一趟最多走 10 步，辟谷丹可再续 5 点。"));
  for (const r of d.regions ?? []) out.push(H([regionArt(r.id), r.open ? B(`${r.icon} ${r.name}`, "do:explore:" + r.id, { variant: "primary", disabled: me.st < 1 }) : B(`${r.icon} ${r.name}（需${REALM_SHORT[r.realm]}）`, "do:regions", { disabled: true }), muted(r.desc)]));
  return out;
}
function sc_dungeon(view, ui) {
  const d = view.data ?? {}, g = d.dg;
  if (!g) return [muted("秘境暂不可见。"), B("重试", "sub:dg")];
  const out = [];
  const b = d.bank;
  if (b) {
    out.push(h4(b.done ? "秘境通关" : b.dead ? "力竭而返" : "收手而归"),
      muted(`深入 ${b.depth} 层${b.dead ? "（所得折半）" : ""} · 修为 +${fmt(b.xp)} · 灵石 +${fmt(b.ls)}`));
    if (b.drops.length) out.push(muted("得：" + b.drops.map((x) => `${x.name}${x.n > 1 ? "×" + x.n : ""}${x.lost ? "（遗失）" : ""}`).join("、")));
    out.push(DIV);
  }
  const run = g.run;
  if (!run) {
    out.push(h4(`秘境 · 今日余 ${g.left}/${g.limit} 次`), muted("每层两三条路，自己挑。所得先寄在秘境里，收手或通关才入行囊；死在里面折损一半。"));
    for (const x of g.diffs) out.push(B(`${x.name} · ${x.n} 层 · 掉落×${x.lm}`, "do:dg.enter:" + x.id, { variant: "primary", disabled: !x.ok || g.left <= 0 }));
    if (g.best) out.push(muted(`本周最深 ${g.best.d} 层`));
    if (g.board.length) { out.push(h4("本周最深")); for (const x of g.board.slice(0, 8)) out.push(muted(`${x.rank}. ${x.n} — 第 ${x.d} 层`)); }
    return out;
  }
  out.push(h4(`${run.diff} · 第 ${run.f}/${run.n} 层`),
    muted(`气血 ${Math.round(run.hp * 100)}% · 灵力 ${Math.round(run.mp * 100)}% · 灵石 ${fmt(run.ls)} · 修为 ${fmt(run.xp)} · 战利品 ${run.loot.n} 样`));
  if (run.rel.length) out.push(muted("机缘：" + run.rel.map((r) => r.n).join("、")));
  for (const l of (run.last ?? []).slice(-3)) out.push(muted("· " + l));
  const p = run.pend;
  if (p?.t === "ev") { out.push(T(p.text)); p.o.forEach((o, i) => out.push(B(o.l, "do:dg.pick:" + i, { variant: "primary" }))); }
  else if (p?.t === "shop") { p.g.forEach((o, i) => out.push(B(`${o.n} · ${o.ls} 灵石`, "do:dg.pick:" + i, { variant: "primary", disabled: run.ls < o.ls }))); out.push(B("不买了", "do:dg.pick:-1")); }
  else if (p?.t === "relic") { p.r.forEach((o, i) => out.push(B(`${o.n} — ${o.d}`, "do:dg.pick:" + i, { variant: "primary" }))); out.push(B("不取", "do:dg.pick:-1")); }
  else run.opts.forEach((o, i) => out.push(H([B(`${o.i} ${o.n}`, "do:dg.pick:" + i, { variant: "primary" }), muted(o.d)])));
  out.push(H([B("服回血丹", "do:dg.use:p_huixue", { disabled: !run.pillOk }), B("服回灵丹", "do:dg.use:p_huiling", { disabled: !run.pillOk }), B("收手", "do:dg.leave", { variant: "danger" })]));
  return out;
}
function sc_resultBlock(r) {
  const out = [h4("经过")];
  for (const l of (r.lines ?? []).slice(0, 10)) out.push(T(l));
  const g = [];
  if (r.xp) g.push(`修为 ${r.xp > 0 ? "+" : ""}${fmt(r.xp)}`);
  if (r.ls) g.push(`灵石 ${r.ls > 0 ? "+" : ""}${fmt(r.ls)}`);
  if (r.wu) g.push(`悟性 ${r.wu > 0 ? "+" : ""}${r.wu}`);
  if (r.drops?.length) g.push("得：" + r.drops.map((x) => `${x.name}${x.n > 1 ? "×" + x.n : ""}${x.q ? "（" + x.q + "星）" : ""}${x.lost ? "（行囊已满，遗失）" : ""}`).join("、"));
  if (g.length) out.push(muted(g.join(" · ")));
  if (r.battle) out.push(...sc_battleBlock(r.battle));
  out.push(DIV);
  return out;
}
function sc_battleBlock(b) {
  const out = [H([b.foe.id ? monArt(b.foe.id) : null, h4(`${b.me.name} 对 ${b.foe.icon ?? ""}${b.foe.name} — ${b.win ? "胜" : "败"}（${b.turns} 回合）`)])];
  const log = b.log ?? [];
  const keep = log.filter((e) => e.d || e.s === "胜" || e.s === "败" || e.e).slice(-10);
  for (const e of keep) {
    const who = e.w === "A" ? b.me.name : e.w === "B" ? b.foe.name : "";
    out.push(muted(`${e.t ? "[" + e.t + "] " : ""}${who}${e.s ? " · " + e.s : ""}${e.d ? " -" + fmt(e.d) : ""}${e.c ? " 暴击" : ""}${e.e ? " " + e.e : ""}`));
  }
  return out;
}

// ---------------------------------------------------------------- bag
function sc_bag(view, ui) {
  const me = view.me, d = view.data ?? {}, inv = d.inv ?? { stack: [], arts: [], eq: {} }, sk = d.skills ?? { gongfa: [], arts: [], eqArts: [] };
  const sub = ui.sub || "items";
  const out = [sc_subnav(ui, [["items", "物品"], ["arts", "法宝"], ["skills", "功法神通"], ["craft", "炼制"], ["pet", "灵兽"]])];
  if (sub === "items" || sub.startsWith("auc_")) {
    out.push(muted(`行囊 ${inv.used ?? inv.stack.length}/${inv.cap?.stack ?? 60} 种（种子与典籍不占格）· 卖出价为半价`));
    for (const it of inv.stack.slice(0, 20)) {
      const usable = it.k === "pill" || it.k === "egg" || it.fx?.learn || (it.k === "misc" && (it.fx?.array || it.fx?.legacy));
      const swap = it.k === "egg" && me.pet; // hatching over a living beast: the blocks surface confirms in the label
      out.push(H([itemArt(it.id), V([T(`${KINDN[it.k] ?? it.k} · ${it.name} ×${it.n}`, { weight: "medium" }), muted(it.desc), H([usable ? B(swap ? "孵化（换灵兽）" : "使用", "do:use:" + it.id + (swap ? "/1" : ""), { variant: "primary" }) : null, B("卖 1", "do:sell:" + it.id), me.r >= 1 ? B("上拍", "sub:auc_" + it.id, { variant: "flat" }) : null])], { gap: "xs" })], { align: "start" }));
    }
    if (ui.sub && ui.sub.startsWith("auc_")) { const id = ui.sub.slice(4); const it = inv.stack.find((x) => x.id === id); if (it) out.push(h4(`上拍 ${it.name}`), H([I("n_" + id, "数量", 1), I("min_" + id, "起拍价（灵石）")]), H([B("确认上拍", "do:auction.create:" + id, { variant: "primary" }), B("取消", "sub:items")])); }
  } else if (sub === "arts" || sub.startsWith("auca_")) {
    out.push(muted("已装备：" + ["w", "a", "r"].map((s) => { const it = inv.arts.find((a) => a.iid === inv.eq[s]); return `${SLOTN[s]} ${it ? it.name : "—"}`; }).join(" · ") + ` · 法宝匣 ${inv.arts.length}/${inv.cap?.arts ?? 30}`));
    for (const a of inv.arts.slice(0, 15)) {
      const stl = Object.keys(a.st ?? {}).map((k) => `${k} +${a.st[k] < 1 ? Math.round(a.st[k] * 100) + "%" : a.st[k]}`).join(" ");
      const af = (a.af ?? []).map((f) => `${f.n} +${f.v < 1 ? Math.round(f.v * 100) + "%" : f.v}`).join("、");
      const rn = (a.rn ?? []).map((f) => `${STN[f.st] ?? f.st} +${f.v < 1 ? Math.round(f.v * 100) + "%" : f.v}`).join("、");
      out.push(V([T(`${SLOTN[a.slot]} · ${a.name} ${"★".repeat(a.q)}${a.equipped ? "（已装备）" : ""}`, { weight: "medium" }), muted(`${stl}${a.elem ? " · " + a.elem + "属性" : ""}${af ? " · " + af : ""}${rn ? " · 纹 " + rn : ""}`), H([a.equipped ? B("卸下", "do:unequip:" + a.slot) : B("装备", "do:equip:" + a.iid, { variant: "primary" }), B("淬炼", "sub:ref_" + a.iid), B("卖出", "do:sellArt:" + a.iid), !a.equipped && me.r >= 1 ? B("上拍", "sub:auca_" + a.iid, { variant: "flat" }) : null])], { gap: "xs" }));
    }
    if (sub.startsWith("auca_")) { const iid = sub.slice(5); const a = inv.arts.find((x) => String(x.iid) === iid); if (a) out.push(h4(`上拍 ${a.name}`), H([I("min_a" + iid, "起拍价（灵石）"), B("确认上拍", "do:auction.createArt:" + iid, { variant: "primary" }), B("取消", "sub:arts")])); }
  } else if (sub.startsWith("ref_")) {
    const rf = d.refine;
    if (!rf) out.push(muted("这件法宝已不在匣中。"), B("返回法宝", "sub:arts"));
    else {
      out.push(h4(`淬炼 ${rf.name} ${"★".repeat(rf.q)}`), muted(`重铸 ${rf.reforge.ls} 灵石 · ${rf.reforge.mats.map((x) => `${x.name} ${x.have}/${x.n}`).join("、")}（锁一条则翻倍）`));
      for (let i = 0; i < rf.maxAf; i++) {
        const a = rf.af[i];
        out.push(H([B(a ? "重铸" : "开一槽", `do:refine.reforge:${rf.iid}/${i}`, { disabled: !rf.reforge.can }), muted(a ? `${a.n} +${a.v < 1 ? Math.round(a.v * 100) + "%" : a.v}` : "空槽")]));
      }
      out.push(DIV, H([B(`升星 ${Math.round(rf.star.p * 100)}%`, `do:refine.star:${rf.iid}`, { variant: "primary", disabled: !rf.star.can }), muted(`${rf.star.ls} 灵石，取同名最低星者为祭（余 ${rf.star.cands.length} 件）`)]));
      out.push(DIV, h4(`符纹 ${rf.rn.length}/${rf.maxRn}`));
      rf.rn.forEach((r, k) => out.push(H([B(`拆 ${STN[r.st] ?? r.st}`, `do:refine.unrune:${rf.iid}/${k}`, { variant: "flat" }), muted("拆下即毁")])));
      for (const r of (rf.runes ?? []).slice(0, 6)) out.push(H([B(`嵌 ${r.name}`, `do:refine.rune:${rf.iid}/${r.id}`, { disabled: !!r.had || rf.rn.length >= rf.maxRn }), muted(`×${r.n} · ${STN[r.st] ?? r.st}`)]));
      out.push(B("返回法宝", "sub:arts"));
    }
  } else if (sub === "pet") {
    const pv = d.pet ?? {}, p = pv.pet;
    if (!p) out.push(muted("尚无灵兽。行囊里的兽卵可以孵化——妖兽会掉，灵兽远行也会叼回来。"));
    else {
      out.push(h4(`${["凡品", "黄阶", "玄阶", "地阶", "天阶", "仙阶"][p.eggTier | 0] ?? ""} ${p.name} ${p.lv} 级${["", "（化形）", "（仙形）"][p.ev] ?? ""}`), muted(`${ELI[p.elem] ?? ""}${p.elem} · 攻 ${fmt(p.atk)} · 血 ${fmt(p.hp)} · 气血 ${Math.round((p.hpP ?? 1) * 100)}%`), P(p.xp, p.need));
      if (p.trip) out.push(H([B(p.trip.ready ? "收取" : "远行中", "do:pet.collect", { variant: "primary", disabled: !p.trip.ready }), muted(`${p.trip.regionName} · ${p.trip.ready ? "已归来" : "余 " + (p.trip.left / 3600000).toFixed(1) + " 小时"}`)]));
      else {
        out.push(muted(`远行：今日余 ${pv.tripsLeft} 次，一趟 8 小时${p.hpP < 0.3 ? " · 气血不足三成" : ""}`));
        for (const rg of (pv.regions ?? []).filter((r) => r.open).slice(0, 7)) out.push(H([B(`${rg.icon} ${rg.name}`, `do:pet.send:${rg.id}/8`, { disabled: pv.tripsLeft <= 0 || p.hpP < 0.3 }), muted(`第 ${rg.tier} 阶`)]));
      }
      out.push(DIV, h4("喂养"));
      for (const f of (pv.feed ?? []).slice(0, 3)) out.push(H([B(`${f.name} +${f.xp}`, "do:pet.feed:" + f.id), muted(`×${f.n}`)]));
      if (p.evoLv) {
        // 按钮要说清「到底卡在哪」：旧版一律写「化形（10 级）」，20 级的玩家看了以为坏了，
        // 其实卡的是材料。
        const lack = (p.evoCost ?? []).filter((z) => z.have < z.n);
        const lb = p.canEvolve ? "化形" : (p.lv ?? 0) < p.evoLv ? `化形（需 ${p.evoLv} 级）` : lack.length ? `化形（缺 ${lack.map((z) => `${z.name}×${z.n - z.have}`).join("、")}）` : "化形";
        out.push(DIV, H([B(lb, "do:pet.evolve", { variant: "primary", disabled: !p.canEvolve }), muted(p.evoCost.map((z) => `${z.name} ${z.have}/${z.n}`).join("、") + " · 攻防 ×1.3")]));
      }
    }
  } else if (sub === "skills") {
    out.push(h4("功法（被动，择一修炼）"));
    for (const g of sk.gongfa) out.push(H([B(`《${g.name}》${["黄", "玄", "地", "天"][g.grade]}阶${g.equipped ? " ✓" : ""}`, "do:gongfa:" + g.id, { variant: g.equipped ? "primary" : "secondary", disabled: !!g.locked }), g.equipped || g.basic ? null : B("封存", "do:book.seal:" + g.id), muted(`×${g.rate}${g.elem ? " · " + g.elem : ""} ${g.desc}`)]));
    out.push(muted("用不上的功法神通可「封存」成秘籍去坊市上拍；妖兽会什么神通就可能掉什么秘籍。"));
    out.push(DIV, h4("神通（出战 1-3 个，点击切换）"));
    for (const a of sk.arts) out.push(H([B(`${ELI[a.elem] ?? ""}${a.name}${a.equipped ? " ✓" : ""}`, "do:arts.toggle:" + a.id, { variant: a.equipped ? "primary" : "secondary", disabled: !!a.locked }), a.equipped || a.basic ? null : B("封存", "do:book.seal:" + a.id), muted(`×${a.mult} 耗${a.mp} ${a.desc}`)]));
  } else if (sub === "craft") {
    const rc = d.recipes ?? { pills: [], forge: [] };
    const list = (arr, h) => { out.push(h4(h)); for (const r of arr.slice(0, 12)) out.push(H([B(`${r.name}${r.n > 1 ? "×" + r.n : ""} ${Math.round(r.p * 100)}%`, "do:craft:" + r.id, { variant: "primary", disabled: !r.can }), muted(r.in.map((i) => `${i.name} ${i.have}/${i.n}`).join("、") + ` · ${r.ls} 灵石`)])); };
    list(rc.pills, "炼丹（丹修 +25%，丹毒减半）");
    list(rc.forge, "炼器 / 制符（器修 +25%）");
  }
  return out;
}

// ---------------------------------------------------------------- market
function sc_market(view, ui) {
  const me = view.me, d = view.data ?? {};
  const sub = ui.sub || "shop";
  const out = [sc_subnav(ui, [["shop", "坊市"], ["auction", "拍卖行"]])];
  if (sub === "shop") {
    out.push(muted("每日换货。"));
    const vs = d.vshop;
    if (vs && vs.lv) {
      out.push(h4(`珍宝阁 · ${vs.name}会员`));
      for (const s of vs.stock) out.push(H([itemArt(s.id), B(`${s.name} 💎${s.price}（余 ${s.left}）`, "do:vshop.buy:" + s.idx, { variant: "primary", disabled: !s.left || me.ls < s.price })]));
    } else if (vs) out.push(muted(`珍宝阁：VIP1（累计供奉 ${vs.unlockAt} 点能量）起开放。`));
    for (const s of d.shop ?? []) out.push(H([itemArt(s.id), B(`${s.name} 💎${s.price}（余 ${s.left}）`, "do:buy:" + s.idx, { variant: "primary", disabled: !s.left || me.ls < s.price }), muted(`${KINDN[s.k] ?? "法宝"} · ${s.desc}`)]));
  } else {
    const a = d.auctions ?? { open: [], mine: [], ended: [] };
    const name = (it) => `${it.name}${it.n ? "×" + it.n : ""}${it.q ? "（" + it.q + "星）" : ""}`;
    const left = (end) => { const s = Math.max(0, end - (me.now ?? 0)); return s > 3600000 ? Math.round(s / 3600000) + " 小时" : Math.max(1, Math.round(s / 60000)) + " 分"; };
    out.push(muted("出价托管灵石，落槌后由定时任务裁定，回来即自动结算。在行囊里把东西挂上来。"), h4(`在拍（${a.open.length}）`));
    for (const x of a.open.slice(0, 10)) {
      const floor = x.top ? Math.ceil(x.top.amt * 1.05) : x.min;
      out.push(V([T(`${name(x.item)} · ${x.seller} · 余 ${left(x.end)} · ${x.top ? "现价 " + x.top.amt : "起拍 " + x.min}${x.myBid ? (x.top && x.top.amt > x.myBid ? " · 我出 " + x.myBid + "（已被超）" : " · 我出 " + x.myBid + "（领先）") : ""}`), H([I("amt_" + x.aid, `出价 ≥ ${floor}`), B("出价", "do:auction.bid:" + x.aid, { variant: "primary" })])], { gap: "xs" }));
    }
    if (a.mine.length) { out.push(DIV, h4("我的拍品")); for (const x of a.mine.slice(0, 6)) out.push(muted(`${name(x.item)} · ${x.settled ? (x.settled.winner ? `成交 ${x.settled.price}（${x.settled.wname}）` : "流拍") : x.ended ? "落槌，等待裁定" : `在拍 余 ${left(x.end)}${x.top ? " 现价 " + x.top.amt : " 无人出价"}`}${x.claimed ? " ✓" : ""}`)); }
    if (a.ended.length) { out.push(DIV, h4("已落槌")); for (const x of a.ended.slice(0, 6)) out.push(muted(`${name(x.item)} · ${x.settled ? (String(x.settled.winner) === String(me.uid) ? "你拍得 " + x.settled.price : "他人拍得 " + x.settled.price) : "等待裁定"}`)); }
  }
  return out;
}

// ---------------------------------------------------------------- arena
function sc_arena(view, ui) {
  const me = view.me, d = view.data ?? {};
  const sub = ui.sub || "arena";
  const out = [sc_subnav(ui, [["arena", "论道"], ["boss", "讨伐"], ["season", "赛季榜"], ["wx", "棋局"]])];
  if (d.battle) out.push(...sc_battleBlock(d.battle), DIV);
  const a = d.arena ?? { list: [], left: 0, refresh: 0, season: me.season, standings: [] };
  if (sub === "arena") {
    out.push(muted(`今日余 ${a.left} 次 · 论道值 ${me.season?.ar} · 赛季积分 ${me.season?.ss} · ${me.season?.w} 胜 ${me.season?.l} 负 · 点到为止`));
    for (const p of a.list) out.push(H([B(`论道 ${p.n}`, "do:arena.fight:" + p.uid, { variant: "primary", disabled: a.left <= 0 }), muted(`${REALM_SHORT[p.r]}${p.pa ? " · " + PATHN[p.pa] : ""} · 战力 ${fmt(p.pw)} · 论道 ${p.ar}`)]));
    if (!a.list.length) out.push(muted("榜上还没有别的修士。"));
    out.push(B(`换一批（余 ${a.refresh}）`, "do:arena.refresh", { disabled: a.refresh <= 0 }));
  } else if (sub === "boss") {
    const b = d.boss ?? {}; const w = b.world ?? view.world;
    out.push(h4(`${w?.boss?.icon ?? ""} ${w?.boss?.name ?? ""}（${w?.weather ?? ""}）· 今日余 ${b.left ?? 0} 次`), muted(`${w?.boss?.desc ?? ""} 伤害按自身境界折算威能，全服同榜，次日登录按名次领赏。`),
      H([B("出手", "do:boss.attack", { variant: "primary", disabled: (b.left ?? 0) <= 0 }), muted(`我的威能 ${fmt(b.mine ?? 0)}`)]));
    for (const [i, x] of (b.board ?? []).slice(0, 10).entries()) out.push(muted(`${i + 1}. ${x.n} — ${fmt(x.d)}${String(x.uid) === String(me.uid) ? " ←" : ""}`));
  } else if (sub === "wx") {
    const w = d.wx;
    out.push(h4("五行连珠"), muted("每日一局 6×6 棋盘：交换相邻两子，横竖三子以上相生或同气即成连珠。落子要点棋盘，请在正式版游玩。"));
    if (w) {
      out.push(muted(w.mine ? `你今日 ${fmt(w.mine.sc)} 分${w.rank ? "，第 " + w.rank + " 名" : ""}` : "今日尚未落子"));
      for (const x of (w.board ?? []).slice(0, 10)) out.push(muted(`${x.rank}. ${x.n} — ${fmt(x.sc)} 分`));
      if (!(w.board ?? []).length) out.push(muted("今日还没有人落子。"));
    }
  } else {
    out.push(muted("赛季末前十名获能量奖励（5/3/1），前百名获灵石。"));
    for (const p of a.standings ?? []) out.push(muted(`${p.rank}. ${p.n}${p.pa ? "（" + PATHN[p.pa] + "）" : ""} — ${p.ss} 分${String(p.uid) === String(me.uid) ? " ←" : ""}`));
  }
  return out;
}

// ---------------------------------------------------------------- sect
function sc_sect(view, ui) {
  const me = view.me, d = view.data ?? {};
  const out = [];
  if (d.battle) out.push(...sc_battleBlock(d.battle), DIV);
  if (d.sect) {
    const s = d.sect; const isLeader = s.myRole === "掌门";
    out.push(h4(`⛩ ${s.name} · ${s.level} 级 · ${s.memberCount} 人`), muted(s.desc || "（无宗旨）"), muted(`掌门 ${s.leaderName} · 我：${s.myRole}，贡献 ${s.myPts} · 修炼 +${s.buff}% · 入门需${REALM_SHORT[s.req]}`),
      H([I("amt", "捐献灵石（10 = 1 贡献）", 100), B("捐献", "do:sect.donate", { variant: "primary" })]),
      H([d.sboss ? B(`宗门试炼 ${d.sboss.boss.icon}${d.sboss.boss.name}`, "do:sect.boss", { variant: "primary" }) : null, !isLeader ? B("退出宗门", "do:sect.leave", { variant: "danger" }) : B("解散宗门", "do:sect.manage:disband/", { variant: "danger" })]));
    if (d.sboss?.board?.length) { out.push(h4("本周试炼")); for (const [i, x] of d.sboss.board.slice(0, 5).entries()) out.push(muted(`${i + 1}. ${x.n} — ${fmt(x.d)}`)); }
    if (s.wage?.lv > 0) out.push(B(s.wage.taken ? "俸禄已领" : `领俸禄 ${s.wage.amount}`, "do:sect.wage", { variant: "primary", disabled: !!s.wage.taken }));
    if (s.costs) {
      out.push(DIV, h4(`宗门建设 · 库藏 ${fmt(s.treasury)}（已用 ${fmt(s.spent)}）`));
      for (const b of s.costs) out.push(H([muted(`${b.name} ${"●".repeat(b.lv)}${"○".repeat(Math.max(0, b.max - b.lv))} — ${b.desc}`), b.cost === null ? muted("已至顶") : B(`升级 ${b.cost}`, "do:sect.build:" + b.k, { variant: "flat", disabled: !s.canBuild || s.treasury < b.cost })]));
    }
    if (s.wk) {
      out.push(DIV, h4(`本周宗务 · 余 ${s.wk.daysLeft} 天`));
      for (const [k, n] of [["don", "捐献贡献"], ["sb", "试炼出手"], ["aw", "论道胜场"]]) out.push(H([muted(n), P(s.wk.cur[k] ?? 0, s.wk.goals[k] ?? 1), muted(`${fmt(s.wk.cur[k] ?? 0)}/${fmt(s.wk.goals[k] ?? 0)}`)]));
      if (s.last) out.push(muted(`上周达成 ${s.last.done}/3`));
    }
    out.push(DIV, h4("门人"));
    for (const p of s.members.slice(0, 12)) out.push(H([muted(`${p.role} ${p.n} · ${REALM_SHORT[p.r]} · 战力 ${fmt(p.pw)} · 贡献 ${p.pts}`), isLeader && String(p.uid) !== String(me.uid) ? (p.role === "长老" ? B("免", "do:sect.manage:dismiss/" + p.uid, { variant: "flat" }) : B("任长老", "do:sect.manage:appoint/" + p.uid, { variant: "flat" })) : null, isLeader && String(p.uid) !== String(me.uid) ? B("传位", "do:sect.manage:transfer/" + p.uid, { variant: "flat" }) : null, isLeader && String(p.uid) !== String(me.uid) ? B("逐出", "do:sect.manage:ban/" + p.uid, { variant: "flat" }) : null]));
    if (isLeader) out.push(DIV, H([I("req", "入门最低境界 0-8", s.req), B("设定", "do:sect.manage:setReq/", {})]), H([I("desc", "宗旨（80 字内）", s.desc ?? ""), B("改宗旨", "do:sect.manage:setDesc/", {})]));
  } else {
    out.push(h4("你是散修"), muted(`加入宗门可获修炼加持与宗门试炼；金丹之后可花 ${d.cost ?? 5000} 灵石开宗立派。`));
    if (me.r >= 2) out.push(H([I("name", "宗门名（2-8 字）"), I("desc", "宗旨（可空）")]), B("开宗立派", "do:sect.create", { variant: "primary", disabled: me.ls < (d.cost ?? 5000) }));
  }
  out.push(DIV, h4("诸宗"));
  for (const s of d.list ?? []) out.push(H([!me.sect ? B(`拜入 ${s.name}`, "do:sect.join:" + s.sid, { variant: "primary" }) : muted(s.name), muted(`${s.level} 级 · ${s.members} 人 · 掌门 ${s.leaderName} · 需${REALM_SHORT[s.req]}${s.desc ? " · " + s.desc : ""}`)]));
  if (!(d.list ?? []).length) out.push(muted("天下尚无宗门。第一个开宗的人，会被记住。"));
  return out;
}

// ---------------------------------------------------------------- boards / bio
function sc_lb(view, ui) {
  const d = view.data ?? {}; const l = d.lb ?? { rows: [], total: 0 };
  const types = [["realm", "境界"], ["power", "战力"], ["arena", "论道"], ["season", "赛季"], ["wealth", "财富"], ["sect", "宗门"], ["xian", "仙籍"]];
  const out = [H(types.slice(0, 4).map(([id, n]) => B(n, "lb:" + id, { variant: ui.lbType === id ? "primary" : "flat" }))), H(types.slice(4).map(([id, n]) => B(n, "lb:" + id, { variant: ui.lbType === id ? "primary" : "flat" }))), muted(`共 ${l.total ?? l.rows.length} 人`)];
  for (const r of (l.rows ?? []).slice(0, 20)) out.push(muted(`${r.rank}. ${r.n}${r.realm ? " · " + r.realm : ""}${r.pa ? " · " + PATHN[r.pa] : ""}${r.title ? " · " + r.title : ""}${r.sub ? " · " + r.sub : ""} — ${typeof r.v === "number" ? fmt(r.v) : r.v}${l.me && l.me.rank === r.rank ? " ←" : ""}`));
  if (l.me && l.me.rank > 20) out.push(muted(`你排在第 ${l.me.rank}`));
  return out;
}
function sc_bio(view, ui) {
  const me = view.me, d = view.data ?? {}, st = d.stats ?? {};
  const sub = ui.sub || "bounty";
  const out = [sc_subnav(ui, [["bounty", "悬赏"], ["ach", "成就"], ["codex", "图鉴"], ["life", "传记"]])];
  if (sub === "codex") {
    const cx = d.codex;
    if (!cx) return out.concat(muted("图鉴未载入"));
    out.push(h4(`图鉴 · ${cx.items.length} 件物品，${cx.mons.length} 种妖兽`), muted("此处只列丹药；法宝、妖兽等请在正式版页面翻阅。"));
    for (const x of cx.items.filter((i) => i.k === "pill").slice(0, 20)) out.push(muted(`${x.name} — ${x.desc}${x.fx ? "（" + x.fx + "）" : ""}`));
    return out;
  }
  if (sub === "bounty") {
    const b = d.bounty;
    if (!b) return out.concat(muted("悬赏未载入"));
    out.push(h4(`今日悬赏 ${b.doneN}/${b.total} · 连续 ${b.streak} 日`));
    for (const x of b.list) out.push(V([T(`${x.done ? "✓" : "○"} ${x.name} — ${x.text}`), H([P(x.cur, x.need), muted(`${x.cur}/${x.need} · 赏 ${x.ls} 灵石`), x.claimed ? muted("已领") : B("领取", "do:bounty.claim:" + x.i, { variant: "primary", disabled: !x.done })])], { gap: "xs" }));
    out.push(muted(b.allClaimed ? `今日三赏皆结，悟性 +1。已连续 ${b.streak} 日。` : `三张皆结：悟性 +1；连续七日得宝匣（还差 ${b.allReward.chestIn} 日）。`));
    return out;
  }
  if (sub === "ach") {
    const a = d.ach;
    if (!a) return out.concat(muted("成就未载入"));
    out.push(h4(`成就 ${a.done}/${a.total}${a.cur ? " · 称号 " + a.cur : ""}`));
    // ACH 一共给出十个称号，切到 6 个会有四个永远穿不上（webview 是全的）；一行放四个，分行摆开
    const tbtn = a.titles.map((t) => B(t.title, "do:ach.title:" + t.id, { variant: a.cur === t.title ? "primary" : "flat" }));
    out.push(H([B("不用称号", "do:ach.title:", { variant: a.cur ? "flat" : "primary" }), ...tbtn.slice(0, 3)]));
    for (let i = 3; i < tbtn.length; i += 4) out.push(H(tbtn.slice(i, i + 4)));
    for (const x of a.list) out.push(muted(`${x.done ? "✓" : "○"} ${x.name} — ${x.desc}${x.title ? " · 称号「" + x.title + "」" : ""}${x.ls ? " · " + x.ls + " 灵石" : ""}${x.wu ? " · 悟性 +" + x.wu : ""}`));
    return out;
  }
  out.push(h4(`${me.name}传`), muted(`战斗 ${st.fights ?? 0} 场，胜 ${st.wins ?? 0} · 游历 ${st.explores ?? 0} · 突破 ${st.bt ?? 0}（失败 ${st.btFail ?? 0}）· 渡劫 ${st.tribs ?? 0} · 炼制 ${st.crafts ?? 0} · 道统 ${d.legacy?.pts ?? 0} 点 · 第 ${me.lives} 世`), DIV, h4("年谱"));
  for (const b of (d.bio ?? []).slice(0, 20)) { const dt = new Date(b.t); out.push(muted(`${dt.getMonth() + 1}/${dt.getDate()} ${b.v}`)); }
  if (d.legacy?.history?.length) { out.push(DIV, h4("前世")); for (const x of d.legacy.history.slice(-5)) out.push(muted(`${x.name} · ${x.cause} · ${x.age} 岁`)); }
  return out;
}
