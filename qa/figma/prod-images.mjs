import { chromium } from "@playwright/test";
const BASE = (process.env.BASE ?? "https://wattlehealth.vercel.app").replace(/\/$/, "");
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 430, height: 932 } })).newPage();
await page.goto(`${BASE}/`); await page.evaluate(() => localStorage.setItem("wattle.splash.seen", "true"));
let ok = 0, bad = [];
for (const ex of ["Endometriosis, someone who listens", "ADHD, lived experience", "Menopause, longer appointments", "Fibromyalgia, whole-person care"]) {
  await page.goto(`${BASE}/`); await page.getByRole("button", { name: ex }).click(); await page.waitForURL(/\/results/); await page.waitForTimeout(2500);
  const imgs = await page.$$eval("article img", (els) => els.map((e) => ({ src: e.src, w: e.naturalWidth })));
  for (const im of imgs) (im.w > 0 ? ok++ : bad.push(im.src));
}
console.log("loaded", ok, "broken", bad.length, bad.join(" "));
await browser.close();
