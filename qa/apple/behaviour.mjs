// Apple pass: checks the behaviour ported from Apple's web code (docs/apple/REA.md) in a real browser.
// 1) pinned nav: back stays on screen and the scroll edge turns on once content scrolls under it;
// 2) collapse title appears only after scrolling; 3) sheet: page locked while open, Escape closes it,
// the page unlocks at the same offset and focus returns to the opener.
import { chromium, devices } from "@playwright/test";
import { throughNarrow } from "../figma/narrow-helper.mjs";
const BASE = (process.env.BASE ?? "http://localhost:3300").replace(/\/$/, "");
const b = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
const page = await (await b.newContext({ ...devices["iPhone 15"] })).newPage();
const out = {};
await page.goto(`${BASE}/`);
await page.evaluate(() => localStorage.setItem("wattle.splash.seen", "true"));
await page.goto(`${BASE}/doctor/general-practice~sian-hebron`, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
const edge = () => page.$eval(".scroll-edge", (e) => e.getAttribute("data-on"));
out.edgeAtTop = await edge();
await page.mouse.wheel(0, 900); await page.waitForTimeout(500);
out.edgeScrolled = await edge();
out.backVisibleScrolled = await page.getByRole("button", { name: "Back" }).first().evaluate((e) => { const r = e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; });
await page.goto(`${BASE}/me`, { waitUntil: "networkidle" }); await page.waitForTimeout(500);
const inline = () => page.$eval("[aria-hidden] ~ div .text-headline, .sticky .text-headline", (e) => getComputedStyle(e).opacity);
out.titleOpacityTop = await inline();
await page.mouse.wheel(0, 400); await page.waitForTimeout(500);
out.titleOpacityScrolled = await inline();
// sheet on results
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await page.fill("textarea", "Endometriosis, someone who listens");
await page.locator("button[type=submit]").first().click();
try { await throughNarrow(page, { pick: 1 }); } catch { if (/narrow/.test(page.url())) await throughNarrow(page, { pick: 1 }); }
await page.waitForTimeout(1500);
await page.mouse.wheel(0, 300); await page.waitForTimeout(300);
const refine = page.getByRole("button", { name: "Refine" });
await refine.scrollIntoViewIfNeeded(); await page.evaluate(() => scrollBy(0, 40)); await page.waitForTimeout(200);
const y0 = await page.evaluate(() => scrollY);
out.y0 = y0;
await refine.click(); await page.waitForTimeout(600);
out.sheetOpen = await page.getByRole("dialog", { name: "Refine" }).isVisible();
out.bodyLocked = await page.evaluate(() => getComputedStyle(document.body).position);
out.focusInSheet = await page.evaluate(() => !!document.activeElement?.closest("[role=dialog]"));
await page.keyboard.press("Escape"); await page.waitForTimeout(500);
out.sheetClosedByEscape = !(await page.getByRole("dialog", { name: "Refine" }).isVisible().catch(() => false));
out.bodyUnlocked = await page.evaluate(() => getComputedStyle(document.body).position);
out.yAfter = await page.evaluate(() => scrollY);
out.scrollRestored = Math.abs(out.yAfter - y0) <= 2;
out.focusBackOnRefine = await page.evaluate(() => document.activeElement?.textContent?.trim());
console.log(JSON.stringify(out, null, 1));
await b.close();
