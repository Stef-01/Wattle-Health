// Saved at iPhone 15: three doctors in two groups; open a group, switch one off, check Openings skips them.
import { chromium, devices } from "@playwright/test";
const BASE = (process.env.BASE ?? "http://localhost:3300").replace(/\/$/, "");
const b = await chromium.launch();
const page = await (await b.newContext({ ...devices["iPhone 15"] })).newPage();
await page.goto(`${BASE}/`);
await page.evaluate(() => {
  localStorage.setItem("wattle.splash.seen", "true");
  localStorage.setItem("wattle.saved.v1", JSON.stringify(["general-practice:sian-hebron", "obstetrics-gynaecology:tal-jacobson", "general-practice:joshua-hatch"]));
  localStorage.setItem("wattle.saved.ctx.v1", JSON.stringify({ "general-practice:sian-hebron": "Endometriosis", "obstetrics-gynaecology:tal-jacobson": "Endometriosis", "general-practice:joshua-hatch": "Healthspan" }));
});
await page.goto(`${BASE}/saved`);
await page.waitForSelector("text=Watching", { timeout: 20000 });
await page.screenshot({ path: "qa/iphone/saved-groups.png", fullPage: true });
await page.getByRole("button", { name: /^Endometriosis/ }).last().click();
await page.waitForTimeout(500);
await page.getByRole("button", { name: /Watch Dr Tal Jacobson/ }).click().catch(async () => page.getByLabel(/Watch Dr Tal Jacobson/).click());
await page.waitForTimeout(600);
await page.screenshot({ path: "qa/iphone/saved-open.png", fullPage: true });
await page.goto(`${BASE}/me/openings`);
await page.waitForSelector("text=/fit your next two weeks|Nothing fits/", { timeout: 20000 });
const watching = await page.locator("text=/^Watching/").first().innerText();
console.log(JSON.stringify({ watching }));
await b.close();
