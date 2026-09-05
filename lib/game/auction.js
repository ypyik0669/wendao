import { itemOf } from "../data/items.js";
import { subOf } from "../data/paths.js";
import { byPrefix, setShared, delShared, sharedRoomFor, auctionOf, auctionsAll } from "./shared.js";
import { artifactOf, countOf, removeItems, addStack, ART_CAP } from "./inventory.js";
import { DAY, HOUR } from "./time.js";
import { vipMod } from "./vipmod.js";

export const AUCTION_HOURS = 24;
export const MAX_ACTIVE = 5;
// 全站在拍上限。共享区一共 100 个键，拍卖是唯一「一件一个键」且随热度线性涨的东西：
// v34 把个人名额放宽到 5 件之后，实测半天就吃掉 30 个键，直接把配额顶穿、新玩家建不了角色。
// 个人名额管公平，这个闸门管配额；满了就礼貌拒绝，等有货落槌再上。
export const AUC_GLOBAL_CAP = 20;
export const FEE = 0.05;

function bidsFor(shared, aid) {
  return byPrefix(shared, `bid:${aid}:`).map((e) => e.value).filter((b) => b && typeof b.amt === "number");
}
export function winnerOf(auction, shared) {
  if (auction.settled) return auction.settled;
  const bids = bidsFor(shared, auction.aid).sort((a, b) => b.amt - a.amt || a.t - b.t);
  if (!bids.length) return { winner: null, price: 0 };
  return { winner: bids[0].uid, wname: bids[0].n, price: bids[0].amt };
}

// 全站在拍数量不设上限时，market 的响应会随人数线性膨胀：180 件就到 59 KB，
// 直接把这一次请求顶穿平台的单次大小限制 —— 玩家看到的是「通讯失败」，而且是从某一刻起
// 所有带 auctions 的调用（含 auction.create）一起失败。列表页只需要认得出是什么东西，
// 词缀与符纹的完整数组留在共享记录里（结算 giveBack 要用），视图只带一个符纹数目。
export const AUC_PAGE = 40;
// 列表页也得看得见「这件到底什么属性」（玩家原话：看不到拍卖物品的属性）：词缀与符纹照带，
// 说明文字从物品表现取；真正占地方的是别的字段，这几样一件不到 200 字节。
const slimItem = (it) => ({ k: it.k, id: it.id, name: it.name, n: it.n, t: it.t, q: it.q, rn: (it.rn ?? []).length, af: it.af ?? null, rns: (it.rn ?? []).map((r) => r.st), desc: itemOf(it.id)?.desc ?? null, st: itemOf(it.id)?.st ?? null });

export function auctionsView(c, shared, now) {
  const all = auctionsAll(shared);
  const mine = [];
  const open = [];
  const ended = [];
  for (const a of all) {
    const bids = bidsFor(shared, a.aid);
    const top = bids.slice().sort((x, y) => y.amt - x.amt || x.t - y.t)[0];
    const myBid = bids.find((b) => b.uid === c.uid);
    const v = {
      aid: a.aid, seller: a.n, sellerUid: a.uid, item: a.item, min: a.min, end: a.end, t: a.t,
      top: top ? { amt: top.amt, n: top.n } : null, bids: bids.length, myBid: myBid?.amt ?? null,
      settled: a.settled ?? null, ended: now >= a.end, claimed: !!c.aucDone?.[a.aid],
    };
    if (a.uid === c.uid) mine.push(v);
    else if (now < a.end) open.push(v);
    else if (myBid) ended.push(v);
  }
  open.sort((x, y) => x.end - y.end);
  ended.sort((x, y) => y.end - x.end);
  const openTotal = open.length;
  const slim = (v) => ({ ...v, item: slimItem(v.item) });
  return {
    mine: mine.map(slim), open: open.slice(0, AUC_PAGE).map(slim), ended: ended.slice(0, 20).map(slim),
    openTotal, escrow: c.escrow ?? {},
  };
}

function itemPayload(c, item) {
  if (item.iid) {
    const a = artifactOf(c, Number(item.iid));
    if (!a) return { err: "无此法宝" };
    if (Object.values(c.eq).includes(a.iid)) return { err: "请先卸下" };
    const d = itemOf(a.id);
    // rn 是 v6 加的符纹；不带上的话上拍一趟（哪怕流拍退回）就把镶好的符纹吃掉了
    return { payload: { k: "art", id: a.id, name: d.name, q: a.q, af: a.af, rn: a.rn ?? [], t: d.t, slot: d.slot }, take: () => { c.inv.arts = c.inv.arts.filter((x) => x.iid !== a.iid); } };
  }
  const id = String(item.id ?? "");
  const n = Math.max(1, Math.floor(Number(item.n) || 1));
  const d = itemOf(id);
  if (!d || d.k === "art") return { err: "无此物品" };
  if (countOf(c, id) < n) return { err: "数量不足" };
  return { payload: { k: d.k, id, name: d.name, n, t: d.t }, take: () => removeItems(c, [[id, n]]) };
}

export function createAuction(c, shared, now, item, min, effects) {
  if (!sharedRoomFor(shared, `auction:${c.uid}:${(c.aucN ?? 0) + 1}`)) return { ok: false, msg: "坊市文书已满，天机阁正在清理旧卷，请稍后再上拍" };
  min = Math.floor(Number(min) || 0);
  if (min < 1 || min > 10_000_000) return { ok: false, msg: "起拍价无效" };
  if (c.r < 1) return { ok: false, msg: "筑基后方可上拍" };
  const live = byPrefix(shared, "auction:").filter((e) => e.value && !e.value.settled).length;
  if (live >= AUC_GLOBAL_CAP) return { ok: false, msg: `坊市摊位已满（全站同时在拍 ${AUC_GLOBAL_CAP} 件），等有货落槌再来` };
  // 占位的只算「还没了结的」：钱一领、货一收，位子当场就空出来。
  // 旧写法按「落槌后三天」算，于是三件拍完要等四天才能再上架 —— 玩家报的「刚上架几件就无法上架」就是这个。
  const mine = auctionsAll(shared).filter((a) => a.uid === c.uid && !c.aucDone?.[a.aid]);
  const cap = MAX_ACTIVE + vipMod(c).auc;
  if (mine.length >= cap) return { ok: false, msg: `最多同时 ${cap} 件在拍。先去坊市把已落槌的收了，位子就空出来` };
  const { payload, take, err } = itemPayload(c, item ?? {});
  if (err) return { ok: false, msg: err };
  const fee = (subOf(c.sub)?.mods?.fee ?? FEE) * ((c.vip | 0) >= 2 ? 0.5 : 1);
  const feeLs = Math.ceil(min * fee);
  if (c.ls < feeLs) return { ok: false, msg: `手续费 ${feeLs} 灵石不足` };
  c.ls -= feeLs;
  take();
  c.aucN = (c.aucN ?? 0) + 1;
  const aid = `${c.uid}:${c.aucN}`;
  const rec = { aid, uid: c.uid, n: c.name, item: payload, min, end: now + AUCTION_HOURS * HOUR, t: now };
  setShared(effects, `auction:${aid}`, rec);
  return { ok: true, msg: `已上拍 ${payload.name}${payload.n ? "×" + payload.n : ""}，起拍 ${min} 灵石，24 小时后落槌` };
}

export function bid(c, shared, now, aid, amt, effects) {
  if (!sharedRoomFor(shared, `bid:${String(aid ?? "")}:${c.uid}`)) return { ok: false, msg: "坊市文书已满，请稍后再出价" };
  amt = Math.floor(Number(amt) || 0);
  const a = auctionOf(shared, aid);
  if (!a) return { ok: false, msg: "拍品不存在" };
  if (a.uid === c.uid) return { ok: false, msg: "不能拍自己的东西" };
  if (a.settled || now >= a.end) return { ok: false, msg: "已落槌" };
  const bids = bidsFor(shared, aid).sort((x, y) => y.amt - x.amt || x.t - y.t);
  const top = bids[0];
  const floor = Math.max(a.min, top ? Math.ceil(top.amt * 1.05) : 0);
  if (amt < floor) return { ok: false, msg: `出价需不低于 ${floor}` };
  c.escrow = c.escrow ?? {};
  const prev = c.escrow[aid] ?? 0;
  const need = amt - prev;
  if (c.ls < need) return { ok: false, msg: "灵石不足" };
  c.ls -= need;
  c.escrow[aid] = amt;
  c.escrowEnd = c.escrowEnd ?? {}; c.escrowEnd[aid] = a.end;
  setShared(effects, `bid:${aid}:${c.uid}`, { uid: c.uid, n: c.name, amt, t: now });
  return { ok: true, msg: `出价 ${amt} 灵石（已托管）` };
}

// Claim results of ended auctions I am involved in. Only reads `settled` written by the bot.
export const PRUNE_DAYS = 30; // settled auctions stay claimable this long before the bot prunes them

export function claimAuctions(c, shared, now, effects) {
  const lines = [];
  c.aucDone = c.aucDone ?? {};
  c.escrow = c.escrow ?? {};
  const all = auctionsAll(shared).filter((a) => now >= a.end);
  for (const a of all) {
    if (c.aucDone[a.aid]) continue;
    if (!a.settled) continue; // bot settles within minutes of the end
    const s = a.settled;
    if (a.uid === c.uid) {
      if (s.winner) { c.ls += s.price; lines.push(`${a.item.name} 以 ${s.price} 灵石成交。`); }
      else if (!giveBack(c, a.item, lines, "流拍退回")) continue; // bag full: leave unclaimed, retry next time
      c.aucDone[a.aid] = 1; // the key itself is pruned by the bot only
    } else if (a.aid in c.escrow) {
      const esc = c.escrow[a.aid];
      if (s.winner === c.uid) { if (!giveBack(c, a.item, lines, "拍得")) continue; if (esc > s.price) c.ls += esc - s.price; }
      else { c.ls += esc; lines.push(`${a.item.name} 未拍中，退回 ${esc} 灵石。`); }
      delete c.escrow[a.aid]; if (c.escrowEnd) delete c.escrowEnd[a.aid];
      c.aucDone[a.aid] = 1;
    }
  }
  // forget bookkeeping for auctions that no longer exist
  for (const aid of Object.keys(c.aucDone)) if (!auctionOf(shared, aid)) delete c.aucDone[aid];
  // A missing key means the bot pruned a settled auction the player never claimed (≥ PRUNE_DAYS after the end).
  // Refunding here would mint money for colluding accounts (the seller was already paid), so the escrow is forfeited.
  for (const aid of Object.keys(c.escrow)) if (!auctionOf(shared, aid) && now > (c.escrowEnd?.[aid] ?? 0) + PRUNE_DAYS * DAY) { delete c.escrow[aid]; if (c.escrowEnd) delete c.escrowEnd[aid]; lines.push("一笔逾期未领的托管灵石归于天道。"); }
  return lines;
}

function giveBack(c, item, lines, verb) {
  if (item.k === "art") {
    if (c.inv.arts.length >= ART_CAP) { lines.push(`${verb} ${item.name}，但法宝匣已满，暂存于天地间…（腾出位置后再来领取）`); c.aucDone = c.aucDone ?? {}; return false; }
    c.ic = (c.ic ?? 0) + 1;
    c.inv.arts.push({ iid: c.ic, id: item.id, q: item.q ?? 1, af: item.af ?? [], ...(item.rn?.length ? { rn: item.rn } : {}) });
  } else if (!addStack(c, item.id, item.n ?? 1)) { lines.push(`${verb} ${item.name}，但行囊已满。`); return false; }
  lines.push(`${verb} ${item.name}${item.n ? "×" + item.n : ""}。`);
  return true;
}

// Bot: settle ended auctions and prune old keys. Mutates effects.
// budget：这一轮最多往 effects 里放几条（平台单次调用 ~20 条的限额是整批一起拒的）。
// 一件拍品的结算是原子的（改写 + 清竞价），装不下就整件留到下一轮。
export function botSettleAuctions(shared, now, effects, budget = Infinity) {
  let n = 0, used = 0;
  for (const e of byPrefix(shared, "auction:")) {
    const a = e.value;
    if (!a || !a.aid) continue;
    if (now >= a.end && !a.settled) {
      const bids = byPrefix(shared, `bid:${a.aid}:`);
      if (used + 1 + bids.length > budget) continue;
      const w = winnerOf(a, shared);
      setShared(effects, e.key, { ...a, settled: { winner: w.winner ?? null, wname: w.wname ?? null, price: w.price ?? 0 } });
      for (const b of bids) delShared(effects, b.key);
      used += 1 + bids.length;
      n++;
    } else if (now > a.end + PRUNE_DAYS * DAY) {
      if (used + 1 > budget) continue;
      delShared(effects, e.key);
      used++;
    }
  }
  return n;
}
