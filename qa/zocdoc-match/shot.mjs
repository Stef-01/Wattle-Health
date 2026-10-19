// Top match at the Zocdoc reference size (1600x800 CSS, DPR 1.5) and iPhone 15, for side-by-side review.
import { chromium, devices } from "@playwright/test";
import { throughNarrow } from "../figma/narrow-helper.mjs";
const BASE = (process.env.BASE ?? "http://localhost:3300").replace(/\/$/, "");
const b = await chromium.launch();
for (const [tag, opts] of [["desktop", { viewport: { width: 1600, height: 800 }, deviceScaleFactor: 1.5 }], ["iphone", devices["iPhone 15"]]]) {
  const page = await (await b.newContext(opts)).newPage();
  await page.goto(`${BASE}/`);
  await page.evaluate(() => localStorage.setItem("wattle.splash.seen", "true"));
  await page.goto(`${BASE}/`);
  await page.locator("textarea, input[type=text]").first().fill("Endometriosis, someone who listens");
  await page.getByText("Find my provider").click();
  await throughNarrow(page).catch(() => null);
  await page.waitForSelector("text=Your top pick", { timeout: 30000 });
  await page.waitForSelector("text=/See all \d+ reviews/", { timeout: 15000 }).catch(() => null);
  await page.waitForTimeout(800);
  await page.locator("section[data-match='0']").scrollIntoViewIfNeeded();
  await page.evaluate(() => { const s = document.querySelector("section[data-match='0']"); window.scrollTo(0, s.getBoundingClientRect().top + window.scrollY - 70); });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `qa/zocdoc-match/${tag}.png` });
  if (tag === "desktop") {
    const m = await page.evaluate(() => {
      const q = (s) => document.querySelector(s);
      const r = (el) => el ? el.getBoundingClientRect() : null;
      const sec = q("section[data-match='0']");
      const h2 = sec.querySelector("[role=heading]"), img = sec.querySelector("img"), aside = sec.querySelector("aside");
      const cs = getComputedStyle(h2);
      return { name: { size: cs.fontSize, weight: cs.fontWeight }, img: r(img)?.width, left: r(sec.querySelector("header")).width, aside: r(aside)?.width, gap: r(aside).left - r(sec.querySelector("header")).right };
    });
    console.log(JSON.stringify(m));
  }
}
await b.close();
