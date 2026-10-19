// Results summary card, Saved groups, and the app-name switch (Me) flipping to ADHDme.
import { chromium, devices } from "@playwright/test";
import { throughNarrow } from "../figma/narrow-helper.mjs";
const BASE = (process.env.BASE ?? "http://localhost:3300").replace(/\/$/, "");
const b = await chromium.launch();
for (const [tag, opts] of [["iphone", devices["iPhone 15"]], ["desktop", { viewport: { width: 1600, height: 800 }, deviceScaleFactor: 1.5 }]]) {
  const page = await (await b.newContext(opts)).newPage();
  await page.goto(`${BASE}/`);
  await page.evaluate(() => localStorage.setItem("wattle.splash.seen", "true"));
  await page.goto(`${BASE}/`);
  await page.locator("textarea, input[type=text]").first().fill("ADHD, a doctor with lived experience");
  await page.getByText("Find my provider").click();
  await throughNarrow(page).catch(() => null);
  await page.waitForSelector("text=Your top pick", { timeout: 30000 });
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `qa/iphone/summary-${tag}.png` });
}
const page = await (await b.newContext({ ...devices["iPhone 15"] })).newPage();
await page.goto(`${BASE}/me`);
await page.getByRole("radio", { name: "ADHDme" }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: "qa/iphone/brand-me.png", fullPage: true });
const about = await page.locator("h2:has-text('About')").innerText();
await page.goto(`${BASE}/splash`);
await page.waitForTimeout(800);
await page.screenshot({ path: "qa/iphone/brand-splash.png" });
console.log(JSON.stringify({ about, title: await page.title() }));
await b.close();
