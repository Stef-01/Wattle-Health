import { chromium, devices } from "@playwright/test";
const BASE = (process.env.BASE ?? "http://localhost:3300").replace(/\/$/, "");
const SLUG = process.env.SLUG ?? "sian-hebron";
const b = await chromium.launch();
for (const [tag, opts] of [["profile-desktop", { viewport: { width: 1600, height: 800 }, deviceScaleFactor: 1.5 }], ["profile-iphone", devices["iPhone 15"]]]) {
  const page = await (await b.newContext(opts)).newPage();
  const res = await page.goto(`${BASE}/doctor/${SLUG}`);
  await page.waitForSelector("[role=heading]", { timeout: 20000 });
  await page.waitForSelector("text=/See all \d+ reviews/", { timeout: 15000 }).catch(() => null);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `qa/zocdoc-match/${tag}.png` });
  console.log(tag, res.status(), await page.locator("[role=heading]").first().innerText());
}
await b.close();
