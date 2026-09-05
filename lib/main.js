// 《问道》 handlers. Everything here runs server-side in the NodeLoc sandbox.
// The page only ever sends intent; every outcome is decided in these functions.
import { nowOf, dayKey, weekKey, HOUR, DAY } from "./game/time.js";
import { makeRng } from "./game/rng.js";
import { profiles, indexShared, byPrefix, setShared, delShared, setSharedSoft, sharedRoomFor, PX_BUCKETS, AX_BUCKETS, SX_BUCKETS, AUX_BUCKETS, pxKey, axKey, sxKey, auxKey, utf8Len, BUCKET_BYTES } from "./game/shared.js";
import { newCharacter, validName, settle, summary, xpNeed } from "./game/char.js";
import { deriveStats, offlineCapMs } from "./game/stats.js";
import { rollRoot } from "./data/roots.js";
import { REALMS, ASCEND_REALM, realmName, isMajorStep } from "./data/realms.js";
import { PATHS, SUB_PATHS, PATH_CHOOSE_REALM, SUB_CHOOSE_REALM, RESPEC_COST, pathOf, subOf } from "./data/paths.js";
import { GONGFA, ARTS, gongfaOf, artOf } from "./data/skills.js";
import { itemOf } from "./data/items.js";
import { codexView } from "./game/codex.js";
import { vipLevel, vipView, vshopView, vshopBuy, VIP, vipMod } from "./game/vip.js";
import { dayEvent } from "./game/events2.js";
import { mentorApply, apprenticeBreak, mentorSettle, mentorView } from "./game/social.js";
import { breathe, breakthrough, breakthroughChance, choosePath, chooseSub } from "./game/cultivate.js";
import { startTribulation, tribStep, tribView, abandonTribulation } from "./game/tribulation.js";
import { explore, choose, regionsView, eventView, exploreDaily } from "./game/explore.js";
import { inventoryView, useItem, equip, unequip, sell, sellArtifact, setGongfa, setArts, countOf, removeItems, sealBook, BOOK_BASIC } from "./game/inventory.js";
import { recipesView, craft } from "./game/craft.js";
import { shopView, buy, shopRefresh, refreshCost, SHOP_REFRESH_DAILY, shopReLimit } from "./game/shop.js";
import { auctionsView, createAuction, bid, claimAuctions, botSettleAuctions, PRUNE_DAYS } from "./game/auction.js";
import { candidates, refresh, fight, syncDefense, arenaDaily, ATK_KEEP } from "./game/arena.js";
import { validateMembership, createSect, joinSect, leaveSect, donate, manage, sectView, sectList, roleOf, sectOf, botAggregateSects } from "./game/sect.js";
import { worldFor, attackWorldBoss, bossBoard, bossMine, claimBossReward, attackSectBoss, sectBossBoard, bossDaily } from "./game/boss.js";
import { seasonOf, standings, settleSeason, botRolloverSeason } from "./game/season.js";
import { syncProfile, leaderboards, makeProfile } from "./game/snapshot.js";
import { rebirth, legacyGain } from "./game/lifespan.js";
import { pushBio, amendBorn, trimBio } from "./game/bio.js";
import { milestoneAward, flushPending, seasonAward } from "./game/awards.js";
import { claimGift } from "./game/gift.js";
import { energyView, offerEnergy, ENERGY_DAILY, lsPerEnergy } from "./game/energy.js";
import { pageHtml, pageCss, pageJs } from "./ui/page.js";
import { svgAssets } from "./ui/artsvg.js";
import { renderBlocks, mapAction, tabMethod, normalizeUi, trimUi } from "./ui/blocks.js";
// ---- v6 module imports (A: dungeon/wuxing · B: refine/farm/pet · C: bounty/ach/sect-build)
// v6-imports:A
import { dungeonView, dgEnter, dgPick, dgLeave, dgUse } from "./game/dungeon.js";
import { wuxingView, wxSubmit } from "./game/wuxing.js";
import { janitorSweep, JAN_KEY_CAP, JAN_IDLE_DAYS } from "./game/janitor.js";
// v6-imports:B
import { refineView, refineReforge, refineStar, refineRune, refineUnrune } from "./game/refine.js";
import { farmView, farmTick, farmPlant, farmTend, farmHarvest, farmClear } from "./game/farm.js";
import { petView, petTick, petSend, petCollect, petFeed, petEvolve, petRelease } from "./game/pet.js";
// v6-imports:C
import { ensureBountyDay, bountyView, bountyHome, claimBounty, checkAchievements, achView, setAchTitle } from "./game/bounty.js";
import { sectBuild, sectWage, claimSectWeek } from "./game/sect.js";

const VIEW_VERSION = 1;
const TICK_SECONDS = 600;

// ---------------------------------------------------------------- webview
// The webview CSP only allows img-src data:/blob:, so its art is inlined as SVG data-URIs
// (the blocks surface uses the uploaded PNG URLs from ui/assets.js instead).
const svgUri = (svg) => "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg).replace(/%20/g, " ").replace(/%3D/g, "=").replace(/%3A/g, ":").replace(/%2F/g, "/").replace(/%2C/g, ",").replace(/%3B/g, ";");
let WEB_ASSETS = null;
function webAssets() {
  if (!WEB_ASSETS) { WEB_ASSETS = {}; for (const [k, v] of Object.entries(svgAssets())) WEB_ASSETS[k] = svgUri(v); }
  return WEB_ASSETS;
}
export async function webview(ctx) {
  return { html: pageHtml(ctx), css: pageCss(), js: pageJs(webAssets()) };
}

// ---------------------------------------------------------------- dev cheats (author only)
// Used for accelerated real-site playtesting. Set DEV_UID to null before a public release.
const DEV_UID = (typeof process !== "undefined" && process.env && process.env.WD_DEV_UID) ? Number(process.env.WD_DEV_UID) : null; // author-only dev.* cheats; set WD_DEV_UID=26651 for local preview / live test builds
function devCheat(c, method, params, now, shared, effects) {
  const n = (x, d = 0) => (Number.isFinite(Number(x)) ? Number(x) : d);
  switch (method) {
    case "dev.time": { // pretend N hours passed: every private timestamp moves back, daily counters reset
      const ms = Math.max(0, n(params.hours)) * HOUR;
      for (const k of ["last", "stAt", "breathAt", "toxAt", "born", "created"]) if (typeof c[k] === "number") c[k] -= ms;
      for (const b of c.buffs ?? []) { b.from -= ms; b.until -= ms; }
      for (const k of Object.keys(c.dbf ?? {})) c.dbf[k] -= ms;
      if (c.trib) c.trib.t -= ms;
      if (c.dg) c.dg.t0 -= ms;
      for (const p of c.farm?.plots ?? []) { if (!p) continue; p.at -= ms; p.ready -= ms; if (p.ev) p.ev.at -= ms; }
      if (c.pet?.trip) { c.pet.trip.at -= ms; c.pet.trip.ready -= ms; }
      if (c.pet && typeof c.pet.restAt === "number") c.pet.restAt -= ms;
      if (ms >= 24 * HOUR) c.daily = { d: "", exp: 0, arena: 0, boss: 0, breath: 0, login: false, claim: {}, bs: null, bo: null, br: null };
      return { ok: true, msg: `时光流逝 ${n(params.hours)} 小时` };
    }
    case "dev.give": {
      if (params.ls) c.ls = Math.max(0, c.ls + n(params.ls));
      if (params.xp) c.xp = Math.max(0, c.xp + n(params.xp));
      if (params.st) c.st = Math.min(99, c.st + n(params.st));
      if (params.heal) { c.hpP = 1; c.mpP = 1; c.tox = 0; c.dbf = {}; }
      for (const [id, k] of Object.entries(params.items ?? {})) if (itemOf(id) && itemOf(id).k !== "art") c.inv.stack[id] = (c.inv.stack[id] ?? 0) + Math.max(1, n(k, 1));
      for (const id of params.arts ?? []) if (itemOf(id)?.k === "art") { c.ic = (c.ic ?? 0) + 1; c.inv.arts.push({ iid: c.ic, id, q: 3, af: [] }); }
      return { ok: true, msg: "天降机缘" };
    }
    case "dev.realm": {
      const r = Math.max(0, Math.min(ASCEND_REALM - 1, n(params.r))), st = Math.max(0, Math.min(REALMS[r].stages - 1, n(params.s)));
      c.r = r; c.s = st; c.xp = params.full ? xpNeed(c) : 0; c.hpP = 1; c.mpP = 1; c.trib = null;
      return { ok: true, msg: `境界定为 ${realmName(r, st)}` };
    }
    case "dev.seed": { // 6 rival snapshots so arena/boards have opponents
      const names = ["青云子", "赤霞仙子", "铁牛", "顾寒", "白衣客", "老坛主"], paths = ["jian", "fa", "ti", "xie", "dan", null];
      for (let i = 0; i < 6; i++) {
        const uid = 900001 + i;
        const fc = newCharacter({ uid, name: names[i], now, seed: `dev:${uid}`, legacy: null });
        fc.r = Math.min(ASCEND_REALM - 1, Math.max(0, c.r + (i % 3) - 1)); fc.s = i % 3; fc.ls = 500 * (i + 1); fc.path = fc.r >= 1 ? paths[i] : null;
        fc.season = { n: seasonOf(now).n, ar: 980 + i * 17, ss: i * 5, w: i, l: 1, sync: now };
        const p = makeProfile(fc, now); p.t = now;
        setShared(effects, `p:${uid}`, p);
      }
      return { ok: true, msg: "六位道友已至" };
    }
    case "dev.reset": return { ok: true, msg: "此身已散，重新来过", reset: true };
    case "dev.vip": return { ok: true, msg: "供奉账已改", en: n(params.en) };
    case "dev.fx": { // 平台限额探针：一次发 n 个共享区写入（del=1 时发删除），用来二分 effect 上限
      const n = Math.max(1, Math.min(500, Math.floor(Number(params.n) || 1)));
      for (let i = 0; i < n; i++) { const kk = `fx:${Math.floor(Number(params.base) || 0) + i}`; effects.push(params.sch ? { type: "schedule.add", job_key: params.same ? "probe" : `probe${i}`, in_seconds: Math.max(5, Math.floor(Number(params.sec) || 3000)) + i } : params.del ? { type: "kv.shared.delete", key: kk } : { type: "kv.shared.set", key: kk, value: { i } }); }
      return { ok: true, msg: `发出 ${n} 个${params.del ? "删除" : "写入"}` };
    }
    case "dev.kvfill": { // 配额探针：写 n 个私有键，每个 pad 到 size 字节；del=1 清掉
      const n = Math.max(1, Math.min(200, Math.floor(Number(params.n) || 1)));
      const size = Math.max(2, Math.min(20000, Math.floor(Number(params.size) || 100)));
      const base = Math.floor(Number(params.base) || 0);
      for (let i = 0; i < n; i++) effects.push(params.del ? { type: "kv.delete", key: `probe:${base + i}` } : { type: "kv.set", key: `probe:${base + i}`, value: { pad: "x".repeat(size) } });
      return { ok: true, msg: `${params.del ? "删" : "写"} probe:${base}..${base + n - 1} × ${size}B` };
    }
    default: return { ok: false, msg: "未知调试指令" };
  }
}

// ---------------------------------------------------------------- helpers
function secretKey() {
  let s = "";
  for (let i = 0; i < 4; i++) s += Math.floor(Math.random() * 0x7fffffff).toString(36);
  return s;
}
function reply(view, effects = []) {
  return { view: { __v: VIEW_VERSION, ...view }, effects };
}
function worldView(shared, now) {
  const day = dayKey(now);
  const w = worldFor(day);
  const season = seasonOf(now);
  // kv.x：共享区按前缀的键数分布（纯读，几十个字节）。配额是按键数算的（100/安装），
  // 猜构成猜错过两回 —— 这个字段让下一次不用猜。
  const pfx = {};
  for (const k of shared.keys()) { const h = k.slice(0, k.indexOf(":") + 1) || k; pfx[h] = (pfx[h] ?? 0) + 1; }
  return { day, boss: w.boss, weather: w.weather, env: w.env, season, tick: shared.get("world")?.tickAt ?? null, kv: { k: shared.size, x: pfx, w: shared.get("world")?.kv ?? null } };
}
// job_key 必须是固定的一个："tick2"。平台按 job_key 记任务，**跑完也不删记录**，每个 app 只许 5 条：
// v43 改成一次性 `tick:<秒>` 之后三轮就把配额撑满，接着每个玩家请求（带 ensureTick 的 schedule.add）
// 都被 E_SCHEDULE_QUOTA 整批顶回去——全服两个多小时存不了档。同名再加是更新，不占新记录。
const tickKey = () => "tick2";
function ensureTick(shared, now, effects) {
  const w = shared.get("world");
  // onSchedule 在自己那轮里续加的同名任务会丢（平台先应用 effects 再把这条任务标成已跑完），
  // 所以正牌的十分钟节奏其实是玩家请求在这里续的：时钟一过十分钟就补一条（同名 = 更新，不占记录）。
  if (!w || now - (w.tickAt ?? 0) > TICK_SECONDS * 1000 + 30_000) {
    effects.push({ type: "schedule.add", job_key: tickKey(), in_seconds: 20 });
  }
}
// bot 的一轮活，onSchedule 与 miniTick 共用。budget 是本函数最多往 effects 里放的条数
// （平台单次调用 ~20 条限额是整批一起拒的），装不下的整件留给下一轮。
function botWork(shared, now, effects, budget, tickAt) {
  const base = effects.length;
  const room = () => budget - (effects.length - base) - 1; // 给 world 写入留 1 条
  // 配额顶满时只做两件事：往**已存在的**桶里折叠，然后把剩下的预算全给清扫。
  // 折叠不能跳 —— 正是它把散键变成「桶里已有一份」的冗余，清扫才有东西可删；
  // 跳掉折叠等于把清扫的货源掐断，键数只会一直钉在上限。
  // 结算/汇总/换季这一轮先欠着，腾开之后下一轮自然接上。
  const tight = shared.size >= JAN_KEY_CAP - 5;
  if (!tight) {
    botSettleAuctions(shared, now, effects, room());
    botAggregateSects(shared, effects, now, room());
    // 换季结果是个新键：共享区快满时先不写（清扫腾出地方后，下一轮自然补上）
    const cur = seasonOf(now);
    if (cur.n > 0 && room() >= 1 && sharedRoomFor(shared, `season:${cur.n - 1}:result`)) botRolloverSeason(shared, now, effects);
  }
  // 散键折叠：每人一键太奢侈（配额一共 100 键）。act 并成一个键，bd/wx 按天各一个键；
  // 散键由清扫当冗余删掉。折叠键只有 bot 写（单写者），玩家侧「散键优先、折叠兜底」。
  const day0 = dayKey(now);
  const actSingles = byPrefix(shared, "act:");
  if (actSingles.length && room() >= 1) {
    const fold = { ...(shared.get("act")?.d ?? {}) };
    for (const k of Object.keys(fold)) if (fold[k] < day0) delete fold[k]; // 昨天的用完即弃
    let changed = false;
    for (const e of actSingles) { const u = e.key.slice(4); const d = e.value?.day ?? 0; if (d >= day0 && (fold[u] ?? 0) < d) { fold[u] = d; changed = true; } }
    if (changed) { setShared(effects, "act", { d: fold }); shared.set("act", { d: fold }); }
  }
  const foldDay = (pfx, foldKey, field) => {
    if (room() < 1) return;
    const singles = byPrefix(shared, pfx);
    if (!singles.length) return;
    const next = { ...(shared.get(foldKey)?.d ?? {}) };
    let changed = false;
    for (const e of singles) {
      const v = e.value;
      if (!v || v.uid === undefined) continue;
      const u = String(v.uid);
      if (!next[u] || (v[field] ?? 0) > (next[u][field] ?? 0)) { next[u] = v; changed = true; }
    }
    if (changed) { setShared(effects, foldKey, { d: next }); shared.set(foldKey, { d: next }); }
  };
  foldDay(`bd:${day0}:`, `bdx:${day0}`, "d");
  foldDay(`bd:${day0 - 1}:`, `bdx:${day0 - 1}`, "d");
  foldDay(`wx:${day0}:`, `wxb:${day0}`, "sc");
  // 档案与来袭按 uid 分桶折叠（单值 8KB 上限，一个键装不下全服）。桶只有 bot 写；
  // 玩家侧「散键优先、桶兜底」（shared.js profileOf/atkOf），散键由清扫当冗余删。
  // 每个桶一条写入，装不下的桶留给下一轮；始终给清扫留 3 条余地。
  const leaders = new Set(byPrefix(shared, "sect:").map((e) => String(e.value?.leader ?? "")));
  const maxT = (rec) => Math.max(0, ...(rec?.list ?? []).map((x) => x.t ?? 0));
  // keep 返回该条目该留下的形态（原对象=没变、新对象=修剪过、null=请出桶）
  const keepProfile = (v, u) => (v.asc || leaders.has(u) || now - (v.t ?? 0) <= JAN_IDLE_DAYS * DAY) ? v : null;
  const keepAtk = (v) => {
    const list = (v.list ?? []).filter((x) => now - (x.t ?? 0) < ATK_KEEP);
    return !list.length ? null : list.length === (v.list ?? []).length ? v : { uid: v.uid, list };
  };
  let newBuckets = 0;
  // idOf：条目在桶里的键，默认按 uid；拍品按 aid
  const foldBucket = (bk, pfx, keyOf, keep, age, idOf = (v) => String(v.uid)) => {
    if (room() < 4) return;
    // 一批 effects 是单事务，新键太多会把整批（连同删除）一起顶回来，于是永远腾不出地方——死锁。
    // 但完全不建桶又更糟：桶不存在，它管的那批散键就永远删不掉（实测卡在 98 键下不来）。
    // 折中：吃紧时每轮只新建一个桶，配上排在前面的删除，整批净减一定为负。
    if (!shared.has(bk)) {
      // 99 键时开新桶也别赌：平台可能按整批「现有 + 新键」验配额而不是逐条应用，被拒就整轮白干。
      if (shared.size >= JAN_KEY_CAP - 3 || (tight && newBuckets >= 1)) return;
      newBuckets++;
    }
    const cur = shared.get(bk)?.d ?? {};
    const next = {};
    let changed = false;
    for (const u of Object.keys(cur)) {
      const kept = keep(cur[u], u);
      if (kept) next[u] = kept;
      if (kept !== cur[u]) changed = true;
    }
    for (const e of byPrefix(shared, pfx)) {
      const v = e.value;
      if (!v || v.uid === undefined || keyOf(v.uid) !== bk) continue;
      const u = idOf(v);
      const kv = keep(v, u);
      if (kv && (!next[u] || age(kv) > age(next[u]))) { next[u] = kv; changed = true; }
    }
    // 单值 8KB 硬顶：挤爆前先请走最久没动静的（仙籍与掌门不动）
    // v44：按 UTF-8 字节量，不按字符数——中文名一字三字节，按字符数量到 7400 时实际已超 8192 字节，
    // 整批 effects 被拒、tickAt 不动、bot 看着在跑其实每轮都白干（线上 08:23 那轮 15 条 effects「ok」却什么都没落下）。
    while (utf8Len(JSON.stringify({ d: next })) > BUCKET_BYTES) {
      let old = null;
      for (const u of Object.keys(next)) {
        if (next[u].asc || leaders.has(u)) continue;
        if (!old || age(next[u]) < age(next[old])) old = u;
      }
      if (!old) break;
      delete next[old];
      changed = true;
    }
    if (changed) { setShared(effects, bk, { d: next }); shared.set(bk, { d: next }); }
  };
  for (let b = 0; b < PX_BUCKETS; b++) foldBucket(`px:${b}`, "p:", pxKey, keepProfile, (v) => v.t ?? 0);
  for (let b = 0; b < AX_BUCKETS; b++) foldBucket(`ax:${b}`, "atk:", axKey, keepAtk, maxT);
  // 宗门贡献同理：每个弟子一个 sc: 键，实测 27 个，是共享区顶满的两个大头之一。
  // 贡献是长期账（退宗才清零），所以桶里的条目一律保留，只按时间挤 8KB。
  for (let b = 0; b < SX_BUCKETS; b++) foldBucket(`sx:${b}`, "sc:", sxKey, (v) => v, (v) => v.t ?? 0);
  // 已落槌的拍品折进 aux: 桶（按卖家 uid 分桶、按 aid 存），在拍的不动。桶里留到 PRUNE_DAYS，挤 8KB 时先请走落槌最早的。
  const keepAuc = (v) => (v.aid && v.settled && now <= (v.end ?? 0) + PRUNE_DAYS * DAY) ? v : null;
  for (let b = 0; b < AUX_BUCKETS; b++) foldBucket(`aux:${b}`, "auction:", auxKey, keepAuc, (v) => v.end ?? 0, (v) => String(v.aid));
  const jan = janitorSweep(shared, now, effects, undefined, undefined, Math.max(0, room()));
  // 删除排到写入之前：配额吃紧时先腾地方，后面的结算/汇总才落得下去
  const chunk = effects.splice(base);
  chunk.sort((a, x) => (a.type === "kv.shared.delete" ? 0 : 1) - (x.type === "kv.shared.delete" ? 0 : 1));
  effects.push(...chunk);
  setShared(effects, "world", { ...worldFor(dayKey(now)), tickAt, kv: { k: jan.keys, b: jan.bytes, d: jan.deleted, o: jan.over ? 1 : 0 } });
  return jan;
}
// 调度器彻底不响时的自愈：玩家的请求顺手替 bot 干一小截活。预算压得很低，
// 加上本次请求自身的 5-6 条写入也远在平台 ~20 条的限额之下。
// tickAt 故意写成「已经过去了一小会儿」：这样正牌 onSchedule 的新鲜度闸门不会被挡住，
// 调度器活着时它照常接手；死透了就由源源不断的玩家请求每 ~14 分钟推一步。
function miniTick(shared, now, effects) {
  const w = shared.get("world");
  if (w && now - (w.tickAt ?? 0) <= 2 * TICK_SECONDS * 1000) {
    // 时钟是新鲜的，但共享区已经顶满 —— 不能等下一轮 bot（那可能是十分钟后），
    // 立刻清一小把。janitorSweep 只发删除，永远不会因配额被整批拒。
    if (shared.size >= JAN_KEY_CAP - 1) janitorSweep(shared, now, effects, undefined, undefined, 6);
    return;
  }
  botWork(shared, now, effects, 8, now - Math.round(TICK_SECONDS * 0.6) * 1000);
}

const ART_VIEW = (c) => ({
  gongfa: GONGFA.filter((g) => c.gfs.includes(g.id)).map((g) => ({ ...g, basic: BOOK_BASIC.has(g.id), equipped: c.gf === g.id, locked: !!(g.path && g.path !== c.path) || !!(g.demon && c.path !== "xie" && c.r >= 1) })),
  arts: ARTS.filter((a) => c.arts.includes(a.id)).map((a) => ({ ...a, basic: BOOK_BASIC.has(a.id), equipped: c.eqArts.includes(a.id), locked: !!(a.path && a.path !== c.path) })),
  eqArts: c.eqArts,
});

// Post-load housekeeping shared by every authenticated call.
function housekeeping(c, legacy, shared, now, effects, notes) {
  const prevLast = c.last;
  const s = settle(c, now);
  // v6-hooks:B (farmTick / petTick — run right after settle)
  farmTick(c, now, notes, prevLast);
  petTick(c, now, notes);
  if (s.gained > 0 && s.hours >= 1) notes.push({ k: "xp", v: `闭关 ${s.hours.toFixed(1)} 小时，修为 +${s.gained}${s.capped ? "（已达离线上限）" : ""}` });
  if (s.died) notes.push({ k: "death", v: `${c.name}寿元耗尽，于${c.dead.age}岁坐化。` });
  const m = validateMembership(c, shared);
  if (m) notes.push({ k: "sect", v: m });
  // v6-hooks:C1 (ensureBountyDay) —— 必须排在 validateMembership 之后：
  // 抽悬赏读的是 c.sect，离线期间被解散/逐出的人否则会拿到一整天做不了的宗门悬赏。
  ensureBountyDay(c, now);
  const def = syncDefense(c, shared, now);
  for (const d of def.slice(0, 3)) notes.push({ k: "arena", v: `${d.n}向你论道，${d.w ? "你守住了" : "你败了"}（${d.dr >= 0 ? "+" : ""}${d.dr}）` });
  const season = settleSeason(c, shared, now);
  if (season && !season.pending) {
    if (season.rank) notes.push({ k: "season", v: `第${season.n + 1}赛季结算：你名列第 ${season.rank}，获 ${season.ls} 灵石` });
    const aw = seasonAward(legacy, season, now, effects);
    if (aw) notes.push({ k: "energy", v: `赛季奖励：能量 +${aw.amount}` });
    legacy._dirty = true;
  }
  for (const line of claimAuctions(c, shared, now, effects)) notes.push({ k: "auction", v: line });
  const br = claimBossReward(c, shared, now);
  if (br) notes.push({ k: "boss", v: `昨日讨伐${br.boss}名列第 ${br.rank}，获 ${br.ls} 灵石${br.drops.length ? "与" + br.drops.map((d) => d.name + "×" + d.n).join("、") : ""}` });
  if (!c.daily.login && !c.dead) {
    const ls = 20 + c.r * 30;
    c.ls += ls; c.daily.login = true;
    notes.push({ k: "login", v: `今日初次入定，洞府灵石 +${ls}` });
  }
  const act = shared.get(`act:${c.uid}`) ?? (shared.get("act")?.d?.[c.uid] !== undefined ? { day: shared.get("act").d[c.uid] } : null);
  if (act && act.day === dayKey(now) && !c.daily.forum) {
    c.daily.forum = true; c.wu += 1; c.ls += 30;
    notes.push({ k: "forum", v: "今日在论坛论道，悟性 +1，灵石 +30" });
  }
  // v6-hooks:C2 (claimSectWeek)
  const sw = claimSectWeek(c, shared, now, effects);
  if (sw) notes.push({ k: "sect", v: `上周宗务达成 ${sw.n}/3，宗门发下 ${sw.ls} 灵石，贡献 +${sw.pts}` });
  tutorialClaims(c, legacy, notes);
  // v6-hooks:C3 (checkAchievements)
  checkAchievements(c, legacy, shared, notes, now);
  const fp = flushPending(legacy, now, effects);
  if (fp) legacy._dirty = true;
  if (fp) { notes.push({ k: "energy", v: `里程碑奖励：能量 +${fp.amount}` }); legacy._dirty = true; }
  // 补偿礼包：一个账号一次，发放记录在 legacy 里跨转世保留
  const gift = claimGift(c, legacy, now);
  mentorSettle(c, shared, notes);
  // 会员每日礼：按等级与境界给灵石，一天一次（c.daily 跨日重置）
  const vg = vipMod(c).gift;
  if (vg && !c.daily.vg) { c.daily.vg = 1; const wk = dayEvent(now).dg > 0 ? vipMod(c).wk : 1; const amt = vg * ((c.r | 0) + 1) * wk; c.ls += amt; notes.push({ k: "vip", v: `${VIP[c.vip | 0][1]} 每日礼：灵石 +${amt}${wk > 1 ? "（周末双倍）" : ""}` }); }
  if (gift) {
    legacy._dirty = true;
    notes.push({ k: "gift", v: `${gift.title}：${gift.lines.join("，")}` });
  }
  return gift;
}

// First-day guide: three steps derived from existing state, each pays once; finishing pays a bonus.
const TUT_REWARD = 30, TUT_BONUS = 60;
function tutSteps(c) {
  return [
    { k: "breathe", name: "吐纳一次", hint: "洞府里按「吐纳」，每 10 分钟一次", done: (c.breathAt ?? 0) > 0 },
    { k: "explore", name: "去青山村游历一次", hint: "游历页 → 青山村，消耗 1 点体力", done: (c.stats?.explores ?? 0) > 0 },
    { k: "bt", name: "突破到炼气二层", hint: "修为满后按「突破」", done: c.r > 0 || c.s > 0 },
  ].map((s) => ({ ...s, paid: !!c.tut?.[s.k] }));
}
function tutorialClaims(c, legacy, notes) {
  if (c.tutDone || c.dead) return;
  if ((legacy?.lives ?? 0) > 0) { c.tutDone = true; return; } // reborn cultivators know the way
  c.tut ??= {};
  const steps = tutSteps(c);
  for (const s of steps) if (s.done && !s.paid) { c.tut[s.k] = 1; c.ls += TUT_REWARD; notes.push({ k: "tut", v: `初入仙途 · ${s.name}，灵石 +${TUT_REWARD}` }); }
  if (steps.every((s) => s.done)) { c.tutDone = true; c.ls += TUT_BONUS; notes.push({ k: "tut", v: `初入仙途圆满，灵石 +${TUT_BONUS}。此后：筑基渡劫后择道途，金丹后可兼修副业、开宗立派。` }); }
}
const shopReInfo = (c) => ({ left: Math.max(0, shopReLimit(c) - (c.daily.shopRe ?? 0)), cost: refreshCost(c) });
// 论坛能量余额。老平台/沙箱没给 points 读权限时当 0，界面自会说「读不到」。
const energyBalance = async (api) => { try { return (await api.points.balance()) | 0; } catch { return 0; } };

function homeView(c, shared, now) {
  const st = deriveStats(c);
  const s = sectOf(shared, c.sect);
  return {
    breathCd: Math.max(0, 10 * 60 * 1000 - (now - (c.breathAt ?? 0))),
    btChance: c.xp >= xpNeed(c) ? breakthroughChance(c, st) : null,
    major: isMajorStep(c.r, c.s), nextRealm: c.r >= ASCEND_REALM ? null : (isMajorStep(c.r, c.s) ? (c.r + 1 >= ASCEND_REALM ? "飞升" : REALMS[c.r + 1].name) : realmName(c.r, c.s + 1)),
    trib: tribView(c, st), role: roleOf(c, s), sectName: s?.name ?? null,
    canPath: c.r >= PATH_CHOOSE_REALM && !c.path, canSub: c.r >= SUB_CHOOSE_REALM && !c.sub, canRespec: !!c.path && c.r >= SUB_CHOOSE_REALM, respecCost: RESPEC_COST,
    tut: c.tutDone ? null : tutSteps(c), btStreak: c.btStreak ?? 0,
    paths: PATHS, subs: SUB_PATHS, defLog: c.defLog ?? [], gf: gongfaOf(c.gf), capHours: Math.round(offlineCapMs(c) / HOUR),
    farm: farmView(c, now),
    bounty: bountyHome(c),
    event: dayEvent(now), mentor: mentorView(c, shared), canRename: countOf(c, "x_gaiming") > 0,
    honors: profiles(shared).filter((p) => (p.vp | 0) >= 2 && p.vt).sort((a, b) => (b.vp - a.vp) * ((b.vp >= 9) !== (a.vp >= 9) ? 1 : 0) || b.vt - a.vt).slice(0, 5).map((p) => ({ n: p.n, lv: p.vp, t: p.vt })),
  };
}

function tabData(tab, c, shared, now, bio, legacy, sub) {
  switch (tab) {
    case "home": return { home: homeView(c, shared, now) };
    case "explore": return { regions: regionsView(c), event: eventView(c, deriveStats(c)), daily: exploreDaily(c), ev: dayEvent(now), ...(sub === "dg" ? { dg: dungeonView(c, shared, now) } : {}) };
    case "bag": return { inv: inventoryView(c), skills: ART_VIEW(c), recipes: recipesView(c), ...(sub === "pet" ? { pet: petView(c, deriveStats(c), now) } : {}), ...(String(sub ?? "").startsWith("ref_") ? { refine: refineView(c, Number(String(sub).slice(4))) } : {}) };
    case "market": return { shop: shopView(c, dayKey(now)), auctions: auctionsView(c, shared, now), shopRe: shopReInfo(c), vshop: { ...vshopView(c, dayKey(now)), vip: vipView(c, legacy) } };
    case "arena": return { arena: { list: candidates(c, shared, now), left: arenaDaily(c) - c.daily.arena, refresh: 3 - (c.daily.arenaRefresh ?? 0), season: c.season, standings: standings(shared, seasonOf(now).n).slice(0, 10) }, boss: { world: worldView(shared, now), board: bossBoard(shared, dayKey(now)).slice(0, 10), left: bossDaily(c) - c.daily.boss, mine: bossMine(shared, dayKey(now), c.uid)?.d ?? 0 }, ...(sub === "wx" ? { wx: wuxingView(c, shared, now) } : {}) };
    case "sect": return { sect: c.sect ? sectView(c, shared, c.sect, now) : null, list: sectList(shared).slice(0, 15), cost: 5000, sboss: c.sect ? sectBossBoard(shared, c.sect, weekKey(now)) : null };
    case "lb": return {};
    // v6-tabdata (each module may extend the cases above by editing them; keep this marker)
    case "bio": return { bio: bio.slice().reverse().slice(0, 30), legacy: { pts: legacy.pts, lives: legacy.lives, history: legacy.history ?? [] }, stats: c.stats, bounty: bountyView(c), ach: achView(c, legacy), ...(sub === "codex" ? { codex: codexView() } : {}) };
    default: return {};
  }
}

// ---------------------------------------------------------------- surfaces
// webview: the page calls community.call(method, params) on its global; the platform hands `result` back to it.
export async function onMessage(ctx, api) {
  const params = ctx.params && typeof ctx.params === "object" ? ctx.params : {};
  const { view, effects } = await core(ctx, api, String(ctx.method ?? "boot"), params);
  return { blocks: null, state: {}, result: view, effects };
}
// blocks: the whole game is also playable as a native component tree (no webview grant needed).
export async function render(ctx, api) {
  const ui = normalizeUi(ctx.state?.ui);
  const { view, effects } = await core(ctx, api, ui.tab === "lb" ? "lb" : tabMethod(ui.tab), { __tab: ui.tab, __sub: ui.sub, type: ui.lbType });
  return { blocks: renderBlocks(view, ui), state: { ui: trimUi(ui, view) }, effects };
}
export async function onAction(ctx, api) {
  const ui = normalizeUi(ctx.state?.ui);
  const { method, params } = mapAction(String(ctx.action_id ?? ""), ctx.inputs ?? {}, ui);
  const { view, effects } = await core(ctx, api, method, { ...params, __tab: ui.tab, __sub: ui.sub });
  return { blocks: renderBlocks(view, ui), state: { ui: trimUi(ui, view) }, effects };
}

// ---------------------------------------------------------------- core
async function core(ctx, api, method, params) {
  const now = nowOf(ctx);
  const effects = [];
  let shared;
  try {
    shared = indexShared(await api.kv.listPublic());
  } catch (e) {
    // An empty map would make every "the key is gone" cleanup fire (escrow refunds, sect orphaning): fail the turn instead.
    return reply({ ok: false, msg: "天道暂不可见，稍后再试", err: String(e?.message ?? e) });
  }
  const world = worldView(shared, now);
  if (!ctx.user) {
    if (method === "lb") return reply({ ok: true, guest: true, data: leaderboards(null, shared, String(params.type ?? "realm"), now), world });
    return reply({ ok: true, guest: true, world, data: leaderboards(null, shared, "realm") });
  }
  const uid = ctx.user.id;
  const notes = [];
  try {
    let c = await api.kv.get("c");
    // 法宝匣单独一个键：满匣 30 件带满词缀符纹时，整个存档能到 9.5KB，超过平台单值 8KB 的上限。
    // 分开存以后两边都富余。老档的法宝还在 c 里，第一次请求后自然迁移。
    const artsRec = await api.kv.get("arts");
    if (c && artsRec && Array.isArray(artsRec.list)) c.inv.arts = artsRec.list;
    let legacy = (await api.kv.get("legacy")) ?? { pts: 0, lives: 0, awards: {}, keep: {}, best: { r: 0, s: 0 }, history: [] };
    let bio = trimBio((await api.kv.get("bio")) ?? []);
    ensureTick(shared, now, effects);
    if (c) {
      // v52：v47 之前的供奉只留下次数 c.enN（没有点数），按 3 点/次估算补进 legacy.en，只补不扣，一次性
      if (!legacy.enMig) { legacy.enMig = 1; const est = 3 * (c.enN | 0); if (est > (legacy.en | 0)) legacy.en = est; legacy._dirty = true; }
      c.vip = vipLevel(legacy.en | 0); // 会员等级每次重算，各处权益只看 c.vip
      c.vt = legacy.vt ?? 0;
    }

    // ---- creation
    if (!c || c.v !== 1) {
      if (method === "create") {
        const name = String(params.name ?? "").trim();
        if (!validName(name)) return reply({ ok: false, msg: "道号需 2-8 个字（汉字/字母/数字）", need: "create", legacy, world });
        c = newCharacter({ uid, name, now, seed: `${uid}:${now}:${ctx.user.username ?? ""}`, legacy });
        c.av = ctx.user.avatar_url ?? null;
        bio = pushBio(bio, `${name}于${now ? "今日" : ""}踏上仙路，灵根：${c.root.e.join("")}`, now, "born");
        effects.push({ type: "kv.set", key: "c", value: c });
        effects.push({ type: "kv.set", key: "bio", value: bio });
        syncProfile(c, shared, now, effects);
        return reply({ ok: true, msg: "道号已定。", me: summary(c, now), data: { created: true, root: c.root, home: homeView(c, shared, now) }, world, notes }, effects);
      }
      return reply({ ok: true, need: "create", legacy: { pts: legacy.pts ?? 0, lives: legacy.lives ?? 0, history: legacy.history ?? [] }, world, data: leaderboards(null, shared, "realm") });
    }

    if (!c.sk) c.sk = secretKey(); // server-only entropy mixed into every seed so the page cannot pre-compute rolls
    const gift = housekeeping(c, legacy, shared, now, effects, notes);

    // ---- dead / ascended: only rebirth & reads
    if (c.dead || c.ascended) {
      if (method === "rebirth") {
        const name = String(params.name ?? c.name).trim();
        if (!validName(name)) return reply({ ok: false, msg: "道号需 2-8 个字", me: summary(c, now), world });
        const r = rebirth(c, legacy, now, `${uid}:${now}:rebirth`, name);
        bio = pushBio(bio, `${c.name}${c.ascended ? "飞升仙界" : "坐化"}，道统 ${r.summary.total}。${name}转世而来。`, now, "rebirth");
        c = r.c; legacy = r.legacy;
        effects.push({ type: "kv.set", key: "arts", value: { list: c.inv.arts ?? [] } }, { type: "kv.set", key: "c", value: c }, { type: "kv.set", key: "legacy", value: legacy }, { type: "kv.set", key: "bio", value: bio });
        syncProfile(c, shared, now, effects);
        return reply({ ok: true, msg: `道统相承。你是第 ${r.summary.lives} 世。`, me: summary(c, now), data: { rebirth: r.summary }, world, notes }, effects);
      }
      if (!["boot", "home", "lb", "bio", "legacy"].includes(method) && !(method.startsWith("dev.") && uid === DEV_UID)) {
        effects.push({ type: "kv.set", key: "c", value: c });
        if (legacy._dirty) { delete legacy._dirty; effects.push({ type: "kv.set", key: "legacy", value: legacy }); }
        return reply({ ok: false, msg: c.ascended ? "你已登仙籍，此生功德圆满。可转世再修。" : "此身已逝。可转世再修。", me: summary(c, now), data: { end: true, legacyPreview: legacyGain(c), legacy }, world, notes }, effects);
      }
    }

    const st = () => deriveStats(c);
    const rng = () => makeRng(`${uid}:${c.sk}:${now}:${c.ac++}:${method}`);
    let res = { ok: true };
    let data = null;
    let legacyDirty = !!legacy._dirty;
    delete legacy._dirty;

    switch (method) {
      case "boot":
      case "home":
        data = { home: homeView(c, shared, now), end: !!(c.dead || c.ascended), legacyPreview: (c.dead || c.ascended) ? legacyGain(c) : null, legacy: { pts: legacy.pts, lives: legacy.lives, history: legacy.history ?? [] } };
        break;
      case "reroll": {
        if (c.rerolls <= 0) { res = { ok: false, msg: "天命已定，不可再改" }; break; }
        if (c.stats.explores > 0 || c.r > 0 || c.s > 0) { res = { ok: false, msg: "已踏上仙路，灵根不可再改" }; break; }
        c.rerolls--;
        c.root = rollRoot(rng());
        bio = amendBorn(bio, `${c.name}于今日踏上仙路，灵根：${c.root.e.join("")}`);
        res = { ok: true, msg: `天命重定：${c.root.e.join("")}` };
        data = { root: c.root, rerolls: c.rerolls };
        break;
      }
      case "breathe": res = breathe(c, now); data = { home: homeView(c, shared, now) }; break;
      case "bt": {
        res = breakthrough(c, now, rng());
        if (res.ok && res.success) { bio = pushBio(bio, `突破至${realmName(c.r, c.s)}`, now, "bt"); apprenticeBreak(c, notes); }
        if (res.ok && !res.success) bio = pushBio(bio, `突破失败，走火入魔`, now, "btfail");
        data = { home: homeView(c, shared, now) };
        break;
      }
      case "trib.start": res = startTribulation(c, now, `${uid}:${c.sk}:${now}`); data = { home: homeView(c, shared, now) }; break;
      case "trib.step": {
        res = tribStep(c, String(params.act ?? ""), now);
        if (res.ok && res.done) {
          if (res.success) {
            bio = pushBio(bio, res.target >= ASCEND_REALM ? "九重雷劫散尽，飞升。" : `渡劫成功，晋入${REALMS[res.target].name}`, now, "trib");
            const aw = milestoneAward(legacy, res.target, now, effects);
            if (aw) { notes.push({ k: "energy", v: `里程碑奖励：能量 +${aw.amount}` }); }
            legacyDirty = true;
            if (res.target === 1) notes.push({ k: "path", v: "筑基已成，可在洞府择一道途。" });
          } else bio = pushBio(bio, `渡劫失败，重伤跌境`, now, "tribfail");
        }
        data = { home: homeView(c, shared, now), tribLog: res.log ?? null };
        break;
      }
      case "trib.flee": res = abandonTribulation(c, now); bio = pushBio(bio, "临劫而逃", now, "tribfail"); data = { home: homeView(c, shared, now) }; break;
      case "path": {
        res = choosePath(c, String(params.id ?? ""));
        if (res.ok) bio = pushBio(bio, `择道：${pathOf(c.path)?.name}`, now, "path");
        data = { home: homeView(c, shared, now), skills: ART_VIEW(c) };
        break;
      }
      case "sub": {
        res = chooseSub(c, String(params.id ?? ""));
        if (res.ok) bio = pushBio(bio, `兼修副业：${subOf(c.sub)?.name}`, now, "path");
        data = { home: homeView(c, shared, now) };
        break;
      }
      // ---- explore
      case "regions": data = { regions: regionsView(c), event: eventView(c, st()), daily: exploreDaily(c), ev: dayEvent(now) }; break;
      case "explore": {
        res = explore(c, String(params.region ?? ""), now, `${uid}:${c.sk}:${now}`);
        data = { regions: regionsView(c), event: res.ok ? res.event : eventView(c, st()) };
        break;
      }
      case "choose": {
        res = choose(c, String(params.opt ?? ""), now, `${uid}:${c.sk}:${now}`);
        if (res.ok && res.result?.bio) for (const b of res.result.bio) bio = pushBio(bio, b, now, "event");
        if (res.ok && res.result?.battle) bio = bio; // battles are not biography-worthy unless the event says so
        data = { regions: regionsView(c), result: res.result ?? null, event: res.result?.nextEvent ?? eventView(c, st()) };
        break;
      }
      // ---- inventory / skills
      case "bag": data = { inv: inventoryView(c), skills: ART_VIEW(c) }; break;
      case "use": res = useItem(c, String(params.id ?? ""), now, st(), { confirm: params.confirm === true || params.confirm === "1" }); data = { inv: inventoryView(c) }; break;
      case "equip": res = equip(c, Number(params.iid)); data = { inv: inventoryView(c) }; break;
      case "unequip": res = unequip(c, String(params.slot ?? "")); data = { inv: inventoryView(c) }; break;
      case "sell": res = sell(c, String(params.id ?? ""), params.n); data = { inv: inventoryView(c) }; break;
      case "sellArt": res = sellArtifact(c, Number(params.iid)); data = { inv: inventoryView(c) }; break;
      case "gongfa": res = setGongfa(c, String(params.id ?? "")); data = { skills: ART_VIEW(c) }; break;
      case "book.seal": res = sealBook(c, params.id); data = { skills: ART_VIEW(c), inv: inventoryView(c) }; break;
      case "arts": res = setArts(c, Array.isArray(params.ids) ? params.ids : []); data = { skills: ART_VIEW(c) }; break;
      case "arts.toggle": {
        const id = String(params.id ?? "");
        const cur = c.eqArts.slice();
        const i = cur.indexOf(id);
        if (i >= 0) { if (cur.length <= 1) { res = { ok: false, msg: "至少保留一个神通" }; break; } cur.splice(i, 1); }
        else { if (cur.length >= 3) { res = { ok: false, msg: "最多三个神通" }; break; } cur.push(id); }
        res = setArts(c, cur); data = { skills: ART_VIEW(c) };
        break;
      }
      case "recipes": data = { recipes: recipesView(c), inv: inventoryView(c) }; break;
      case "craft": res = craft(c, String(params.id ?? ""), rng()); data = { recipes: recipesView(c), inv: inventoryView(c) }; break;
      // ---- market
      case "shop": data = { shop: shopView(c, dayKey(now)), auctions: auctionsView(c, shared, now), shopRe: shopReInfo(c), vshop: { ...vshopView(c, dayKey(now)), vip: vipView(c, legacy) } }; break;
      case "buy": res = buy(c, params.idx, dayKey(now), rng()); data = { shop: shopView(c, dayKey(now)) }; break;
      case "shop.refresh": res = shopRefresh(c); data = { shop: shopView(c, dayKey(now)), auctions: auctionsView(c, shared, now), shopRe: shopReInfo(c), vshop: { ...vshopView(c, dayKey(now)), vip: vipView(c, legacy) } }; break;
      case "energy": data = { energy: { ...energyView(c, await energyBalance(api)), vip: vipView(c, legacy) } }; break;
      case "energy.offer": {
        const bal = await energyBalance(api);
        const lv0 = c.vip | 0;
        res = offerEnergy(c, bal, params.n, legacy);
        if (res.ok) {
          legacyDirty = true; c.vip = vipLevel(legacy.en | 0);
          if (c.vip > lv0) { legacy.vt = now; c.vt = now; notes.push({ k: "vip", v: `供奉有成，晋升 ${VIP[c.vip][1]}` }); bio = pushBio(bio, `${c.name}供奉有成，晋升 ${VIP[c.vip][1]}`, now, "vip"); }
        }
        if (res.effect) effects.push(res.effect); // 负数 award = 扣能量；被平台拒收则整批回滚，灵石也不会入账
        data = { energy: { ...energyView(c, bal - (res.ok ? Math.max(1, Math.floor(Number(params.n) || 0)) : 0)), vip: vipView(c, legacy) } };
        break;
      }
      case "auction.create": res = createAuction(c, shared, now, params.item, params.min, effects); data = { auctions: auctionsView(c, shared, now), inv: inventoryView(c) }; break;
      case "auction.bid": res = bid(c, shared, now, String(params.aid ?? ""), params.amt, effects); data = { auctions: auctionsView(c, shared, now) }; break;
      case "auctions": data = { auctions: auctionsView(c, shared, now) }; break;
      case "vshop": data = { vshop: { ...vshopView(c, dayKey(now)), vip: vipView(c, legacy) } }; break;
      case "mentor.apply": res = mentorApply(c, shared, params.name, now); data = { home: homeView(c, shared, now) }; break;
      case "rename": {
        const nm = String(params.name ?? "").trim();
        if (countOf(c, "x_gaiming") < 1) { res = { ok: false, msg: "没有改名玉牒" }; break; }
        if (!validName(nm)) { res = { ok: false, msg: "道号需 2-8 个字" }; break; }
        if (nm === c.name) { res = { ok: false, msg: "和现在的道号一样" }; break; }
        removeItems(c, [["x_gaiming", 1]]);
        bio = pushBio(bio, `${c.name}改道号为${nm}`, now, "rename");
        c.name = nm;
        res = { ok: true, msg: `道号已改为「${nm}」` };
        data = { home: homeView(c, shared, now) };
        break;
      }
      case "vshop.buy": res = vshopBuy(c, params.idx, dayKey(now), rng()); data = { vshop: { ...vshopView(c, dayKey(now)), vip: vipView(c, legacy) }, inv: inventoryView(c) }; break;
      // ---- arena
      case "arena": data = { arena: { list: candidates(c, shared, now), left: arenaDaily(c) - c.daily.arena, refresh: 3 - (c.daily.arenaRefresh ?? 0), season: c.season, defLog: c.defLog ?? [], standings: standings(shared, seasonOf(now).n).slice(0, 20) } }; break;
      case "arena.refresh": res = refresh(c); data = { arena: { list: candidates(c, shared, now), left: arenaDaily(c) - c.daily.arena, refresh: 3 - (c.daily.arenaRefresh ?? 0), season: c.season } }; break;
      case "arena.fight": {
        res = fight(c, shared, now, params.uid, effects);
        data = { arena: { list: candidates(c, shared, now), left: arenaDaily(c) - c.daily.arena, refresh: 3 - (c.daily.arenaRefresh ?? 0), season: c.season }, battle: res.battle ?? null };
        break;
      }
      // ---- sect
      case "sect": data = { sect: c.sect ? sectView(c, shared, c.sect, now) : null, list: sectList(shared), cost: 5000, sboss: c.sect ? sectBossBoard(shared, c.sect, weekKey(now)) : null }; break;
      case "sect.view": data = { view: sectView(c, shared, String(params.sid ?? ""), now) }; break;
      case "sect.create": res = createSect(c, shared, now, params.name, params.desc, effects); if (res.ok) bio = pushBio(bio, `开宗立派：${params.name}`, now, "sect"); data = { sect: c.sect ? sectView(c, shared, c.sect, now) : null, list: sectList(shared) }; break;
      case "sect.join": res = joinSect(c, shared, String(params.sid ?? ""), effects); if (res.ok) bio = pushBio(bio, `拜入${sectOf(shared, c.sect)?.name}`, now, "sect"); data = { sect: c.sect ? sectView(c, shared, c.sect, now) : null, list: sectList(shared) }; break;
      case "sect.leave": res = leaveSect(c, shared, now, effects); data = { sect: null, list: sectList(shared) }; break;
      case "sect.donate": res = donate(c, shared, now, params.amt, effects); data = { sect: c.sect ? sectView(c, shared, c.sect, now) : null }; break;
      case "sect.manage": res = manage(c, shared, now, String(params.action ?? ""), params, effects); data = { sect: c.sect ? sectView(c, shared, c.sect, now) : null, list: sectList(shared) }; break;
      case "sect.boss": res = attackSectBoss(c, shared, now, effects, c.sectLv); data = { sboss: c.sect ? sectBossBoard(shared, c.sect, weekKey(now)) : null, battle: res.battle ?? null }; break;
      // ---- world boss
      case "boss": data = { boss: { world, board: bossBoard(shared, dayKey(now)), left: bossDaily(c) - c.daily.boss, mine: bossMine(shared, dayKey(now), uid)?.d ?? 0 } }; break;
      case "boss.attack": res = attackWorldBoss(c, shared, now, effects); data = { boss: { world, board: bossBoard(shared, dayKey(now)), left: bossDaily(c) - c.daily.boss, mine: (bossMine(shared, dayKey(now), uid)?.d ?? 0) + (res.dealt ?? 0) }, battle: res.battle ?? null }; break;
      // ---- boards / bio
      // ---- v6 cases:A (dungeon / wuxing)
      case "dg": data = { dg: dungeonView(c, shared, now) }; break;
      case "dg.enter": res = dgEnter(c, params.diff, now); data = { dg: dungeonView(c, shared, now) }; break;
      case "dg.pick": {
        res = dgPick(c, params.i, now);
        data = { dg: dungeonView(c, shared, now), battle: res.battle ?? null, bank: res.bank ?? null };
        if (res.bank?.done) bio = pushBio(bio, `独闯秘境 ${res.bank.depth} 层，全身而退`, now, "dg");
        break;
      }
      case "dg.leave": res = dgLeave(c, now); data = { dg: dungeonView(c, shared, now), bank: res.bank ?? null }; break;
      case "dg.use": res = dgUse(c, String(params.id ?? ""), now, st()); data = { dg: dungeonView(c, shared, now) }; break;
      case "wx": data = { wx: wuxingView(c, shared, now) }; break;
      case "wx.submit": res = wxSubmit(c, shared, now, params.moves, effects); data = { wx: wuxingView(c, shared, now), wxres: res.ok ? { score: res.score, ls: res.ls, wu: res.wu, drops: res.drops } : null }; break;
      // ---- v6 cases:B (refine / farm / pet)
      case "refine.view": {
        const iid = Number(params.iid);
        const rv = refineView(c, iid);
        if (!rv) { res = { ok: false, msg: "没有这件法宝" }; break; }
        data = { inv: inventoryView(c), refine: rv };
        break;
      }
      case "refine.reforge": res = refineReforge(c, Number(params.iid), params.slot, params.lock, rng()); data = { inv: inventoryView(c), refine: refineView(c, Number(params.iid)) }; break;
      case "refine.star": res = refineStar(c, Number(params.iid), params.withIid, rng()); data = { inv: inventoryView(c), refine: refineView(c, Number(params.iid)) }; break;
      case "refine.rune": res = refineRune(c, Number(params.iid), params.rune); data = { inv: inventoryView(c), refine: refineView(c, Number(params.iid)) }; break;
      case "refine.unrune": res = refineUnrune(c, Number(params.iid), params.k); data = { inv: inventoryView(c), refine: refineView(c, Number(params.iid)) }; break;
      case "farm": data = { farm: farmView(c, now) }; break;
      case "farm.plant": res = farmPlant(c, params.i, params.seed, now); data = { farm: farmView(c, now), inv: inventoryView(c) }; break;
      case "farm.tend": res = farmTend(c, params.i); data = { farm: farmView(c, now) }; break;
      case "farm.harvest": res = farmHarvest(c, params.i, now, rng()); data = { farm: farmView(c, now), inv: inventoryView(c), drops: res.drops ?? null }; break;
      case "farm.clear": res = farmClear(c, params.i); data = { farm: farmView(c, now) }; break;
      case "pet": data = { pet: petView(c, st(), now) }; break;
      case "pet.send": res = petSend(c, params.region, params.hours, now); data = { pet: petView(c, st(), now) }; break;
      case "pet.collect": res = petCollect(c, now); data = { pet: petView(c, st(), now), inv: inventoryView(c), drops: res.drops ?? null, result: res.ok ? { lines: res.lines ?? [], drops: res.drops ?? [] } : null }; break;
      case "pet.feed": res = petFeed(c, params.item); data = { pet: petView(c, st(), now), inv: inventoryView(c) }; break;
      case "pet.evolve": res = petEvolve(c); data = { pet: petView(c, st(), now), inv: inventoryView(c) }; break;
      case "pet.release": res = petRelease(c, params.confirm === true || params.confirm === "1"); data = { pet: petView(c, st(), now) }; break;
      // ---- v6 cases:C (bounty / ach / sect build)
      case "bounty": data = { bounty: bountyView(c) }; break;
      case "bounty.claim": {
        res = claimBounty(c, now, params.i, rng());
        data = { bounty: bountyView(c), home: homeView(c, shared, now), drops: res.drops ?? null };
        break;
      }
      case "ach": data = { ach: achView(c, legacy) }; break;
      case "codex": data = { codex: codexView() }; break;
      case "ach.title": res = setAchTitle(c, legacy, params.id ?? null); data = { ach: achView(c, legacy) }; break;
      case "sect.build": res = sectBuild(c, shared, now, params.b, effects); data = { sect: c.sect ? sectView(c, shared, c.sect, now) : null }; break;
      case "sect.wage": res = sectWage(c, shared, now); data = { sect: c.sect ? sectView(c, shared, c.sect, now) : null }; break;
      case "lb": data = { lb: leaderboards(c, shared, String(params.type ?? "realm"), now) }; break;
      case "bio": data = { bio: bio.slice().reverse(), legacy: { pts: legacy.pts, lives: legacy.lives, best: legacy.best, history: legacy.history ?? [] }, stats: c.stats }; break;
      case "legacy": data = { legacy }; break;
      default:
        if (method.startsWith("dev.")) {
          if (uid !== DEV_UID) { res = { ok: false, msg: "天机不可泄露" }; break; }
          res = devCheat(c, method, params, now, shared, effects);
          if (res.en !== undefined) { legacy.en = res.en; legacyDirty = true; c.vip = vipLevel(legacy.en | 0); } // dev.vip
          if (res.reset) {
            effects.push({ type: "kv.delete", key: "c" }, { type: "kv.delete", key: "arts" }, { type: "kv.delete", key: "legacy" }, { type: "kv.delete", key: "bio" }, { type: "kv.shared.delete", key: `p:${uid}` });
            if (shared.has(`sect:s${uid}`)) effects.push({ type: "kv.shared.delete", key: `sect:s${uid}` });
            for (const k of shared.keys()) if (k.startsWith(`auction:${uid}:`) || k === `atk:${uid}` || k === `act:${uid}` || k === `sc:${uid}` || (/^(wx|bd|sbd):/.test(k) && k.endsWith(":" + uid))) effects.push({ type: "kv.shared.delete", key: k });
            // 折叠桶里的这个人也请出去（dev 专用，正常时桶只有 bot 写）
            for (const bk of [pxKey(uid), axKey(uid), sxKey(uid)]) {
              const d = shared.get(bk)?.d;
              if (d && d[String(uid)] !== undefined) { const nd = { ...d }; delete nd[String(uid)]; effects.push({ type: "kv.shared.set", key: bk, value: { d: nd } }); }
            }
            return reply({ ok: true, msg: res.msg, need: "create", world }, effects);
          }
          data = { home: homeView(c, shared, now) };
          break;
        }
        res = { ok: false, msg: `未知指令 ${method}` };
    }

    // blocks surface: also return whatever the current tab needs, computed from the in-memory character
    if (params.__tab) data = { ...(tabData(params.__tab, c, shared, now, bio, legacy, params.__sub) ?? {}), ...(data ?? {}) };

    miniTick(shared, now, effects); // 世界时钟停摆时由玩家请求代跑一小步（见 ensureTick 旁注）
    // persist（法宝匣分家，见上）
    effects.push({ type: "kv.set", key: "arts", value: { list: c.inv.arts ?? [] } });
    effects.push({ type: "kv.set", key: "c", value: { ...c, inv: { ...c.inv, arts: [] } } });
    effects.push({ type: "kv.set", key: "bio", value: bio });
    if (legacyDirty) effects.push({ type: "kv.set", key: "legacy", value: legacy });
    syncProfile(c, shared, now, effects);
    const view = { ok: res.ok !== false, msg: res.msg ?? null, me: summary(c, now), data, notes, world, method };
    if (gift) view.gift = gift; // 补偿礼包：客户端弹一张「天降机缘」卡
    if (res.success !== undefined) view.success = res.success;
    if (res.win !== undefined) view.win = res.win;
    if (res.p !== undefined) view.p = res.p;
    if (res.confirm !== undefined) view.confirm = res.confirm;
    return reply(view, effects);
  } catch (e) {
    return reply({ ok: false, msg: `出了点岔子：${e && e.message ? e.message : String(e)}`, err: String(e && e.stack ? e.stack : e).slice(0, 400), world, notes }, []);
  }
}

// ---------------------------------------------------------------- bot tick
export async function onSchedule(ctx, api) {
  const now = nowOf(ctx);
  const effects = [];
  let shared;
  try { shared = indexShared(await api.kv.listPublic()); } catch { shared = new Map(); }
  // Several members may have bootstrapped a tick before the first one ran. If another tick finished
  // moments ago, this one retires without re-scheduling, so the population converges to a single job.
  const lastTick = shared.get("world")?.tickAt ?? 0;
  if (now - lastTick < TICK_SECONDS * 1000 * 0.5) return { blocks: null, state: null, effects: [] };
  // 平台单次调用只收 ~20 条 effects，超了整批拒收、这一轮什么都没发生（实测见 janitor.js 顶注）。
  // 所以给活儿记账：world + schedule 固定占 2 条，其余按「结算 > 汇总 > 换季 > 清扫」分剩下的额度，
  // 装不下的整件留给十分钟后的下一轮。清扫（janitor）兼任 wx/act/bd/sbd/atk 的日常到期删除。
  try {
    botWork(shared, now, effects, 14, now);
  } catch (e) {
    setShared(effects, "world", { ...worldFor(dayKey(now)), tickAt: now, err: String(e && e.message ? e.message : e).slice(0, 200) });
  }
  effects.push({ type: "schedule.add", job_key: tickKey(), in_seconds: TICK_SECONDS });
  return { blocks: null, state: null, effects };
}

// ---------------------------------------------------------------- forum activity
export async function onTrigger(ctx) {
  const now = nowOf(ctx);
  const uid = ctx.user?.id ?? ctx.post?.user_id ?? ctx.params?.user_id ?? null;
  if (uid === null || uid === undefined) return { blocks: null, state: null, effects: [] };
  return { blocks: null, state: null, effects: [{ type: "kv.shared.set", key: `act:${uid}`, value: { day: dayKey(now), t: now } }] };
}
