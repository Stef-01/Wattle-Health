// The real journey, timed: Home → example search → narrow → results → profile tabs → Recent → tab bar hops.
import { chromium } from "@playwright/test";
const BASE = process.env.BASE ?? "http://localhost:3300";
const OUT = process.env.OUT ?? "shots";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const t = () => performance.now();
const log = (...a) => console.log(...a);
await page.addInitScript(() => localStorage.setItem("wattle.splash.seen", "true"));
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
// 1. example search
let t0 = t();
await page.getByText("ADHD, lived experience").click();
await page.waitForURL(/narrow/);
log("home→narrow url", Math.round(t() - t0), "ms");
await page.waitForLoadState("networkidle");
log("narrow settled", Math.round(t() - t0), "ms");
await page.screenshot({ path: `${OUT}/01-narrow.png` });
// answer whatever /narrow asks by pressing the first visible primary action until results
for (let i = 0; i < 6 && !/results/.test(page.url()); i++) {
  const btn = page.locator("button, a").filter({ hasText: /Show|See|Find|Continue|Skip|picks|matches/i }).first();
  if (!(await btn.count())) break;
  t0 = t();
  await btn.click().catch(() => {});
  await page.waitForTimeout(400);
  log(" step", i, (await btn.textContent())?.trim().slice(0, 30), "→", page.url().replace(BASE, ""), Math.round(t() - t0), "ms");
  await page.screenshot({ path: `${OUT}/02-step${i}.png` });
}
await page.waitForLoadState("networkidle");
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/03-results.png` });
await page.screenshot({ path: `${OUT}/03-results.full.png`, fullPage: true });
// 2. profile tabs timing
const tabs = page.locator("[role=tab]");
log("tabs:", await tabs.count());
for (const name of ["About", "Location", "Reviews", "FAQs", "Highlights"]) {
  const tab = page.locator("[role=tab]", { hasText: name }).first();
  if (!(await tab.count())) continue;
  t0 = t();
  await tab.click();
  await page.waitForFunction((n) => document.querySelector(`[role=tab][aria-selected="true"]`)?.textContent?.includes(n), name);
  const sel = Math.round(t() - t0);
  await page.waitForTimeout(500);
  log(" tab", name, "selected after", sel, "ms");
}
await page.screenshot({ path: `${OUT}/04-tab-faqs.png` });
// 3. Recent
t0 = t();
await page.getByRole("link", { name: "Recent" }).first().click();
await page.waitForURL(/recent/);
log("results→recent url", Math.round(t() - t0), "ms");
await page.waitForLoadState("networkidle"); await page.waitForTimeout(800);
log("recent settled", Math.round(t() - t0), "ms");
await page.screenshot({ path: `${OUT}/05-recent.png` });
await page.screenshot({ path: `${OUT}/05-recent.full.png`, fullPage: true });
// 4. tab bar hops
for (const name of ["Saved", "Profile", "Home", "Recent"]) {
  t0 = t();
  await page.getByRole("link", { name }).first().click();
  await page.waitForFunction((n) => document.querySelector("h1")?.innerText?.trim().length > 0 && location.pathname !== undefined, name);
  const u = Math.round(t() - t0);
  await page.waitForLoadState("networkidle");
  log(" hop", name, "h1 painted", u, "ms, settled", Math.round(t() - t0), "ms", page.url().replace(BASE, ""));
}
await page.screenshot({ path: `${OUT}/06-home-with-recent.png` });
// 5. tap→press feedback latency and navigation timing entries
const nav = await page.evaluate(() => JSON.stringify(performance.getEntriesByType("navigation")[0]?.toJSON?.() ?? {}, ["domContentLoadedEventEnd","loadEventEnd","responseEnd","transferSize"]));
log("nav timing", nav);
await browser.close();
