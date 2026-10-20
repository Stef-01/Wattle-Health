import { chromium, devices } from "@playwright/test";
const b = await chromium.launch();
const p = await (await b.newContext({ ...devices["iPhone 15"] })).newPage();
await p.goto("http://localhost:3300/"); await p.evaluate(() => localStorage.setItem("wattle.splash.seen", "true"));
for (const r of ["/", "/saved", "/me", "/doctor/general-practice:sian-hebron", "/me/openings", "/me/openings"]) {
  await p.goto("http://localhost:3300" + r); await p.waitForTimeout(2500);
  await p.screenshot({ path: `C:/Users/stefa/AppData/Local/Temp/claude/C--Users-stefa/22d513a9-69eb-42c5-a44c-56e728922dd4/scratchpad/nav${r.replace(/[/:]/g, "_")}.png` });
  console.log(r, await p.locator('nav[aria-label="Primary"]').count());
}
await b.close();
