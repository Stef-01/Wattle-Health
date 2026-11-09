// Saved, Results and Compare before hydration: the static HTML carries the empty state and a skeleton; the head
// script picks one from the stores before paint; the hydrated screen replaces it with no blank frame. Checked
// with JS off (nothing shows), with empty stores (empty state visible at once) and with populated stores
// (skeleton, then real content, never blank). Exit 1 on any miss.
import { chromium } from "@playwright/test";
const BASE = process.env.BASE ?? "http://localhost:3300";
const b = await chromium.launch(); const fails = [];
const vp = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
const visible = (p, sel) => p.evaluate((s) => { const el = document.querySelector(s); return !!el && getComputedStyle(el).display !== "none" && el.getClientRects().length > 0; }, sel);
// JS off: nothing pre shows
{ const p = await (await b.newContext({ ...vp, javaScriptEnabled: false })).newPage(); await p.goto(`${BASE}/saved`);
  if (await visible(p, '[data-pre="saved-none"]') || await visible(p, '[data-pre="saved-some"]')) fails.push("JS off: a pre block is visible"); }
// empty stores
for (const [route, pre, text] of [["/saved", "saved-none", /Nothing saved yet/], ["/results", "search-none", /No search yet/], ["/compare", "compare-none", /Nothing to compare yet/]]) {
  const p = await (await b.newContext(vp)).newPage(); await p.addInitScript(() => localStorage.setItem("wattle.splash.seen", "true"));
  await p.goto(`${BASE}${route}`, { waitUntil: "commit" });
  const first = await p.evaluate(async (pre) => { for (let i = 0; i < 40; i++) { const el = document.querySelector(`[data-pre="${pre}"]`); if (el && getComputedStyle(el).display !== "none") return "pre"; if (document.body?.innerText.match(/Nothing|No search/)) return "real"; await new Promise(r => setTimeout(r, 25)); } return "none"; }, pre);
  await p.waitForLoadState("networkidle"); await p.waitForTimeout(600);
  const stillPre = (await p.locator(`[data-pre]`).count());
  const txt = await p.locator("main").innerText();
  console.log(`${route} empty: first paint shows ${first}; after hydration pre blocks left ${stillPre}; text ok ${text.test(txt)}`);
  if (first === "none") fails.push(`${route} empty store: nothing shown before hydration`);
  if (stillPre) fails.push(`${route}: pre blocks still mounted after hydration`);
  if (!text.test(txt)) fails.push(`${route}: empty state text missing after hydration`);
}
// populated stores: run a search, save one, compare two
{ const c = await b.newContext(vp); const p = await c.newPage(); await p.addInitScript(() => localStorage.setItem("wattle.splash.seen", "true"));
  const cdp = await c.newCDPSession(p); // a slow phone, so the window between paint and hydration is long enough to sample
  await p.goto(`${BASE}/`, { waitUntil: "networkidle" }); await p.getByRole("button", { name: /Endometriosis, someone who/ }).click(); await p.waitForURL(/narrow/); await p.waitForTimeout(500); await p.getByText(/Skip to my picks/).first().click(); await p.waitForURL(/results/, { timeout: 30000 }); await p.waitForTimeout(1500);
  // Saved holds ids (wattle.saved.v1) and Compare holds records (src/ui/store.ts); take two doctors from the search just run.
  await p.evaluate(() => { const id = JSON.parse(sessionStorage.getItem("wattle.req.current")); const req = JSON.parse(sessionStorage.getItem(`wattle.req.${id}`)); const ds = req.response.cards.slice(0, 2).map((c) => c.doctor); localStorage.setItem("wattle.saved.v1", JSON.stringify([ds[0].id])); localStorage.setItem("wattle.compare", JSON.stringify(ds)); });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });
  for (const [route, pre, real] of [["/results", "search-some", "You searched"], ["/saved", "saved-some", "Watching"], ["/compare", "compare-some", "Rooms"]]) {
    await p.goto(`${BASE}${route}`, { waitUntil: "commit" });
    const frames = await p.evaluate(async ({ pre, real }) => { const out = []; for (let i = 0; i < 120; i++) { const el = document.querySelector(`[data-pre="${pre}"]`); const sk = (!!el && getComputedStyle(el).display !== "none") || !!document.querySelector("main .shimmer"); const r = (document.querySelector("main")?.innerText || "").includes(real); out.push(r ? "C" : sk ? "S" : "-"); if (r) break; await new Promise(x => setTimeout(x, 50)); } return out.join(""); }, { pre, real });
    console.log(`${route} populated: ${frames}`);
    const painted = frames.replace(/^-+/, ""); // frames before <body> exists are the parser, not a paint
    if (!painted.startsWith("S")) fails.push(`${route} populated: no skeleton before hydration (${frames})`);
    if (painted.includes("-")) fails.push(`${route} populated: blank frame (${frames})`);
    if (!frames.endsWith("C")) fails.push(`${route} populated: real content never appeared (${frames})`);
  }
}
await b.close();
console.log(fails.length ? `\n${fails.length} failure(s):\n${fails.join("\n")}` : "\npre-state: clean");
process.exit(fails.length ? 1 : 0);
