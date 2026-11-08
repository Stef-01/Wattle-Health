// Tab-bar hops on production, timed to the moment the new screen's title is on screen.
import { chromium } from "@playwright/test";
const BASE = process.env.BASE ?? "http://localhost:3300";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
await page.addInitScript(() => localStorage.setItem("wattle.splash.seen", "true"));
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
const HOPS = [["Recent", "Recent"], ["Saved", "Saved"], ["Profile", "Profile"], ["Home", "Who do you need?"], ["Recent", "Recent"], ["Home", "Who do you need?"], ["Saved", "Saved"], ["Home", "Who do you need?"]];
for (const [name, h1] of HOPS) {
  const t0 = performance.now();
  await page.getByRole("link", { name }).first().click();
  await page.waitForFunction((h) => document.querySelector("h1")?.innerText?.trim() === h, h1);
  const painted = Math.round(performance.now() - t0);
  const rsc = await page.evaluate(() => performance.getEntriesByType("resource").filter((e) => /_rsc=|\?_rsc/.test(e.name)).slice(-1).map((e) => Math.round(e.duration))[0]);
  console.log(`${name.padEnd(8)} title on screen ${String(painted).padStart(5)} ms   last RSC fetch ${rsc ?? "-"} ms`);
  await page.waitForTimeout(600);
}
await browser.close();
