// The four home-screen "Try" searches through the real UI: results + first profile each.
import { chromium } from "@playwright/test";
import { throughNarrow } from "./narrow-helper.mjs";
import path from "node:path";
const BASE = (process.env.BASE ?? "http://localhost:3300").replace(/\/$/, "");
const OUT = path.resolve(process.env.OUT ?? "qa/figma/demos");

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2 })).newPage();
await page.goto(`${BASE}/`); await page.evaluate(() => localStorage.setItem("wattle.splash.seen", "true"));
const EXAMPLES = ["Endometriosis, someone who listens", "ADHD, lived experience", "Menopause, longer appointments", "Fibromyalgia, whole-person care"];
for (const [i, ex] of EXAMPLES.entries()) {
  await page.goto(`${BASE}/`); await page.getByRole("button", { name: ex }).click(); await throughNarrow(page); await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, `${i + 1}a-results.png`) });
  const names = await page.locator("section[aria-label] span.truncate").allTextContents(); console.log(ex, "->", names.join(" | "));
  const first = (await page.locator("a[href*='/doctor/']").first().getAttribute("href")).replace(/\/$/, "");
  await page.goto(`${BASE}${first}`); await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, `${i + 1}b-profile.png`) });
  await page.evaluate(() => window.scrollBy(0, 760)); await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, `${i + 1}c-profile-more.png`) });
}
await browser.close();
