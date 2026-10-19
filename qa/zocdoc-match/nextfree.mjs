import { chromium, devices } from "@playwright/test";
const BASE = (process.env.BASE ?? "http://localhost:3300").replace(/\/$/, "");
const b = await chromium.launch();
for (const [tag, opts] of [["iphone", devices["iPhone 15"]], ["desktop", { viewport: { width: 1600, height: 800 }, deviceScaleFactor: 1.5 }]]) {
  const page = await (await b.newContext(opts)).newPage();
  await page.goto(`${BASE}/doctor/general-practice~sian-hebron`);
  const btn = page.locator("a:has-text('Next free')").filter({ visible: true }).first();
  await btn.waitFor({ timeout: 20000 });
  await btn.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `qa/zocdoc-match/nextfree-${tag}.png` });
  console.log(tag, (await btn.innerText()).replace(/\n/g, " | "), await btn.getAttribute("href"));
}
await b.close();
