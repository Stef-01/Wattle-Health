// Motion, frame by frame: the tab-bar lens sliding, a segmented thumb, the profile tabs, and a push.
import { chromium } from "@playwright/test";
import fs from "node:fs";
const BASE = process.env.BASE ?? "http://localhost:3300";
const OUT = process.env.OUT ?? "shots";
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
await page.addInitScript(() => localStorage.setItem("wattle.splash.seen", "true"));
const frames = async (name, act, clip) => {
  await act();
  for (const t of [0, 60, 120, 200, 320]) {
    await page.waitForTimeout(t === 0 ? 16 : t - [0, 60, 120, 200, 320][[0, 60, 120, 200, 320].indexOf(t) - 1]);
    await page.screenshot({ path: `${OUT}/${name}-${String(t).padStart(3, "0")}.png`, clip });
  }
};
await page.goto(`${BASE}/me`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
// tab bar lens: Profile → Recent
await frames("tabbar", () => page.getByRole("link", { name: "Recent" }).first().click(), { x: 0, y: 760, width: 390, height: 84 });
// segmented on /me: Wattle → ADHDme → back
await page.goto(`${BASE}/me`, { waitUntil: "networkidle" });
await page.waitForTimeout(500);
const seg = page.getByRole("radio", { name: "ADHDme" });
const sb = await seg.boundingBox();
await page.evaluate((y) => scrollTo(0, y - 300), sb.y);
await page.waitForTimeout(300);
const sb2 = await seg.boundingBox();
await frames("segmented", () => seg.click(), { x: 0, y: sb2.y - 20, width: 390, height: 80 });
await page.getByRole("radio", { name: "Wattle" }).click();
await page.waitForTimeout(400);
// profile tabs: Highlights → Reviews
await page.goto(`${BASE}/doctor/general-practice~sian-hebron`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
const tab = page.getByRole("tab", { name: "Reviews" });
const tb = await tab.boundingBox();
await page.evaluate((y) => scrollTo(0, y - 200), tb.y);
await page.waitForTimeout(300);
const tb2 = await tab.boundingBox();
await frames("tabs", () => tab.click(), { x: 0, y: tb2.y - 24, width: 390, height: 120 });
// push: Profile → Openings
await page.goto(`${BASE}/me`, { waitUntil: "networkidle" });
await page.waitForTimeout(500);
await frames("push", () => page.getByText("Openings", { exact: true }).first().click(), { x: 0, y: 0, width: 390, height: 300 });
console.log("done");
await browser.close();
