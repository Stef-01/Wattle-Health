// Apple pass: the laptop (1280) and tablet (820) frames for the main screens, into qa/apple/<OUT>/.
import { chromium } from "@playwright/test";
import path from "node:path";
const BASE = (process.env.BASE ?? "http://localhost:3300").replace(/\/$/, "");
const OUT = path.resolve("qa/apple", process.env.OUT ?? "after");
const b = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
for (const [tag, w, h] of [["laptop", 1280, 860], ["tablet", 820, 1000]]) {
  const page = await (await b.newContext({ viewport: { width: w, height: h } })).newPage();
  await page.goto(`${BASE}/`);
  await page.evaluate(() => localStorage.setItem("wattle.splash.seen", "true"));
  for (const [name, r] of [["home", "/"], ["doctor", "/doctor/general-practice~sian-hebron"], ["me", "/me"]]) {
    await page.goto(`${BASE}${r}`, { waitUntil: "networkidle" }).catch(() => null);
    await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => null);
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT, `${tag}-${name}.png`) });
  }
}
await b.close();
console.log("wrote", OUT);
