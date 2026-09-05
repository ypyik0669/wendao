// v54：种子与典籍不占行囊格、洞府显示真实离线上限（含会员/闭关符）、修炼速率文案标明已乘
import test from "node:test";
import assert from "node:assert/strict";
import { Site } from "./harness.mjs";
import { addStack, bagUsed, bagFree, STACK_CAP, inventoryView } from "../lib/game/inventory.js";
import { itemOf } from "../lib/data/items.js";

const setup = async (s, uid, name, fn) => { await s.call(uid, "boot", {}); await s.call(uid, "create", { name }); s.setChar(uid, (c) => { c.created = Date.UTC(2026, 8, 20); if (fn) fn(c); }); await s.call(uid, "home"); };
const setLegacy = (s, uid, patch) => { const m = s.kv.get(uid); m.set("legacy", { ...(m.get("legacy") ?? {}), ...patch }); };

test("行囊：种子与典籍不占格；60 种材料塞满后种子、秘籍照收，材料不收", async () => {
  assert.ok(bagFree(itemOf("s_lingcao")) && bagFree(itemOf("b_g_xuemo")) && !bagFree(itemOf("m_lingcao")) && !bagFree(itemOf("p_huiqi")));
  const s = new Site();
  await setup(s, 1, "囤货");
  const c = s.char(1);
  c.inv.stack = {};
  let n = 0;
  for (const it of (await import("../lib/data/items.js")).ITEMS) { if (n >= STACK_CAP) break; if (bagFree(it) || it.k === "art" || it.k === "egg") continue; if (addStack(c, it.id, 1)) n++; }
  assert.equal(bagUsed(c), STACK_CAP, `塞满 ${n}`);
  assert.equal(addStack(c, "s_lingcao", 5), true, "种子照收");
  assert.equal(addStack(c, "b_g_xuemo", 1), true, "秘籍照收");
  assert.equal(bagUsed(c), STACK_CAP, "占格数不变");
  const v = inventoryView(c);
  assert.equal(v.used, STACK_CAP); assert.equal(v.stack.length, STACK_CAP + 2);
});

test("洞府：离线上限显示的是真实值（阵法 + 会员 + 闭关符），修炼速率文案标明已乘", async () => {
  const s = new Site();
  await setup(s, 2, "看数", (c) => { c.r = 4; c.array = 2; });
  let v = await s.call(2, "home");
  assert.equal(v.data.home.capHours, 36);
  setLegacy(s, 2, { en: 1200 }); // VIP9 +72h
  v = await s.call(2, "home");
  assert.equal(v.data.home.capHours, 36 + 72);
  s.setChar(2, (c) => { c.biguan = s.now + 3600_000 * 5; });
  v = await s.call(2, "home");
  assert.equal(v.data.home.capHours, 36 + 72 + 12);
  const st = v.me.stats ?? v.data.stats;
  assert.ok(st && Math.round(st.ratePerHour / st.rate) === 1500, "化神基础 1500/时");
});
