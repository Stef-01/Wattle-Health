// Three searches, then Home and Recent with the rows that result (face stacks beside titles).
import { chromium } from "@playwright/test";
const BASE = process.env.BASE ?? "http://localhost:3300";
const OUT = process.env.OUT ?? "shots";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
await page.addInitScript(() => localStorage.setItem("wattle.splash.seen", "true"));
for (const ex of ["ADHD, lived experience", "Menopause, longer appointments", "Fibromyalgia, whole-person care"]) {
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.getByText(ex).click();
  await page.waitForURL(/narrow/);
  await page.waitForTimeout(600);
  const skip = page.getByText(/Skip to my picks/).first();
  if (await skip.count()) await skip.click();
  await page.waitForURL(/results/, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
}
await page.goto(`${BASE}/`, { waitUntil: "networkidle" }); await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/home-recent.png`, fullPage: true });
await page.goto(`${BASE}/recent`, { waitUntil: "networkidle" }); await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/recent.png` });
await page.goto(`${BASE}/saved`, { waitUntil: "networkidle" }); await page.waitForTimeout(800);
await browser.close();
