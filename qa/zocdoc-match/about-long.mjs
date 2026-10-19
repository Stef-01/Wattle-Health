import { chromium, devices } from "@playwright/test";
const BASE = (process.env.BASE ?? "http://localhost:3300").replace(/\/$/, "");
const b = await chromium.launch();
for (const slug of ["obstetrics-gynaecology~erin-wilson", "general-practice~sian-hebron"]) {
  const page = await (await b.newContext({ ...devices["iPhone 15"] })).newPage();
  await page.goto(`${BASE}/doctor/${slug}`);
  await page.getByRole("tab", { name: "About" }).click();
  await page.waitForTimeout(700);
  const panel = page.locator("[role=tabpanel]");
  await panel.screenshot({ path: `qa/zocdoc-match/about-${slug.split("~")[1]}.png` });
  const words = (await panel.innerText()).split(/\s+/).length;
  const main = await page.locator("main").innerText();
  const dup = main.split("Outside the clinic").length - 1;
  console.log(slug, JSON.stringify({ words, outsideHeadings: dup, hasMore: (await panel.getByRole("button", { name: "More" }).count()) }));
}
await b.close();
