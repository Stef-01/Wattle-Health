// iPhone sweep: every patient route at SE (375), 15 (393) and Pro Max (430); flags horizontal
// overflow and any element wider than the viewport; screenshots each at 15 size.
import { chromium, devices } from "@playwright/test";
const BASE = (process.env.BASE ?? "http://localhost:3300").replace(/\/$/, "");
const ROUTES = ["/", "/recent", "/saved", "/me", "/me/openings", "/me/discover", "/me/context", "/healthspan", "/narrow", "/about"];
const SIZES = [["se", 375, 667], ["15", 393, 852], ["max", 430, 932]];
const b = await chromium.launch();
const issues = [];
for (const [tag, w, h] of SIZES) {
  const ctx = await b.newContext({ ...devices["iPhone 15"], viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`);
  await page.evaluate(() => {
    localStorage.setItem("wattle.splash.seen", "true");
    localStorage.setItem("wattle.saved.v1", JSON.stringify(["general-practice:sian-hebron", "obstetrics-gynaecology:tal-jacobson"]));
    localStorage.setItem("wattle.recent.v1", JSON.stringify([
      { id: "a", label: "Endometriosis, Brisbane", condition: "Endometriosis", matches: 3, at: "2026-10-18T10:00:00Z" },
      { id: "b", label: "ADHD, Brisbane", condition: "ADHD", matches: 3, at: "2026-10-17T10:00:00Z" },
      { id: "c", label: "Endometriosis, Gold Coast", condition: "Endometriosis", matches: 2, at: "2026-10-16T10:00:00Z" },
    ]));
  });
  for (const r of ROUTES) {
    await page.goto(`${BASE}${r}`, { waitUntil: "networkidle" }).catch(() => null);
    await page.waitForTimeout(400);
    const res = await page.evaluate(() => {
      const vw = window.innerWidth;
      const over = document.documentElement.scrollWidth - vw;
      const wide = [...document.querySelectorAll("body *")].filter((el) => { const x = el.getBoundingClientRect(); return x.width > 0 && (x.right > vw + 1 || x.left < -1) && getComputedStyle(el).position !== "fixed" && !el.closest("[class*=overflow-x-auto]"); }).slice(0, 3).map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 50)}`);
      const tiny = [...document.querySelectorAll("p,span,a,button,li")].filter((el) => el.childElementCount === 0 && el.textContent.trim() && parseFloat(getComputedStyle(el).fontSize) < 12).length;
      return { over, wide, tiny };
    });
    if (res.over > 0 || res.wide.length || res.tiny) issues.push({ tag, r, ...res });
    if (tag === "15") await page.screenshot({ path: `qa/iphone/${r === "/" ? "home" : r.slice(1).replace(/\//g, "-")}.png`, fullPage: true });
  }
  await ctx.close();
}
console.log(JSON.stringify(issues, null, 1));
await b.close();
