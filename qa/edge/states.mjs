// States the route sweep cannot reach: each profile tab panel, Saved with doctors, the Refine sheet,
// the interview question and draft screens, a claim page, matches 1 to 3.
import { chromium } from "@playwright/test";
import fs from "node:fs";
const BASE = process.env.BASE ?? "http://localhost:3300";
const OUT = process.env.OUT ?? "shots";
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
await page.addInitScript(() => localStorage.setItem("wattle.splash.seen", "true"));
const shot = (n, full = false) => page.screenshot({ path: `${OUT}/${n}.png`, fullPage: full });
// profile tab panels
await page.goto(`${BASE}/doctor/general-practice~sian-hebron`, { waitUntil: "networkidle" });
for (const t of ["About", "Location", "Reviews", "FAQs"]) {
  const tab = page.getByRole("tab", { name: t });
  await tab.click();
  await page.waitForTimeout(500);
  const b = await tab.boundingBox();
  await page.evaluate((y) => scrollTo(0, scrollY + y - 80), b.y);
  await page.waitForTimeout(300);
  await shot(`tab-${t}`);
  await page.screenshot({ path: `${OUT}/tab-${t}.full.png`, fullPage: true });
}
// save the doctor, then Saved
await page.evaluate(() => scrollTo(0, 0));
const heart = page.getByRole("button", { name: /save/i }).first();
if (await heart.count()) { await heart.click(); await page.waitForTimeout(400); await shot("saved-heart"); }
await page.goto(`${BASE}/saved`, { waitUntil: "networkidle" }); await page.waitForTimeout(1200);
await shot("saved-with-doctor", true);
// a search, then the Refine sheet on results
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await page.getByText("Menopause, longer appointments").click();
await page.waitForURL(/narrow/); await page.waitForTimeout(500);
await shot("narrow-q1");
const skip = page.getByText(/Skip to my picks/).first(); if (await skip.count()) await skip.click();
await page.waitForURL(/results/, { timeout: 20000 }).catch(() => {}); await page.waitForTimeout(1500);
const refine = page.getByRole("button", { name: /Refine/ }).first();
if (await refine.count()) { await refine.click(); await page.waitForTimeout(700); await shot("refine-sheet"); await page.keyboard.press("Escape"); await page.waitForTimeout(500); }
for (const r of [1, 2, 3]) { await page.goto(`${BASE}/match/${r}`, { waitUntil: "load" }); await page.waitForTimeout(1000); await shot(`match-${r}`); }
// join: a question and a draft
for (const r of ["/join/interview/1", "/join/interview/4", "/join/draft/1"]) {
  await page.goto(`${BASE}${r}`, { waitUntil: "networkidle" }); await page.waitForTimeout(800);
  await shot(r.replace(/\//g, "_").slice(1));
}
// a claim page for a real doctor id
const id = await page.evaluate(async () => { const r = await fetch("/api/doctors?limit=1").catch(() => null); if (!r || !r.ok) return null; const j = await r.json(); return j?.doctors?.[0]?.id ?? j?.[0]?.id ?? null; });
await page.goto(`${BASE}/claim/${id ?? "general-practice~sian-hebron"}`, { waitUntil: "networkidle" }).catch(() => {}); await page.waitForTimeout(800);
await shot("claim", true);
console.log("done", id);
await browser.close();
