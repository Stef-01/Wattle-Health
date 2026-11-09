// Recent across every way a search starts (example row, typed sentence, a re-opened recent, ADHDme mode) and
// at 320, 390 and 1280: every row's face stack must end before its title, titles share one left edge. Exit 1 otherwise.
import { chromium } from "@playwright/test";
const BASE = process.env.BASE ?? "http://localhost:3300";
const browser = await chromium.launch();
const failures = []; const seen = [];
const search = async (page, how) => {
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" }); await page.waitForTimeout(600);
  if (how.example) await page.getByText(how.example).click();
  else { await page.getByPlaceholder(/going on|Assessment/).fill(how.typed); await page.getByRole("button", { name: /Find my provider/ }).click(); }
  await page.waitForURL(/narrow/); await page.waitForTimeout(800);
  const skip = page.getByText(/Skip to my picks/).first(); if (await skip.count()) await skip.click();
  await page.waitForURL(/results/, { timeout: 30000 }).catch(() => {}); await page.waitForTimeout(1500);
};
const measure = async (page, label) => {
  for (const r of ["/recent", "/"]) {
    await page.goto(`${BASE}${r}`, { waitUntil: "networkidle" }); await page.waitForTimeout(900);
    const rows = await page.evaluate(() => [...document.querySelectorAll("main .ios-group > *")].map((row) => {
      const stack = row.querySelector("span.flex.shrink-0"); const title = row.querySelector("span.text-body"); const sub = row.querySelector("span.text-subhead");
      if (!stack || !title) return null;
      const s = stack.getBoundingClientRect(), t = title.getBoundingClientRect(), u = sub?.getBoundingClientRect();
      return { title: title.innerText.trim(), gap: Math.round(t.left - s.right), overlap: s.right > t.left + 0.5, titleLeft: Math.round(t.left), subLeft: u ? Math.round(u.left) : null, scrollW: document.documentElement.scrollWidth, innerW: innerWidth };
    }).filter(Boolean));
    for (const row of rows) {
      seen.push(`${label} ${r} "${row.title}" gap=${row.gap}`);
      if (row.overlap) failures.push(`${label} ${r}: "${row.title}" faces overlap the title (gap ${row.gap})`);
      if (row.subLeft !== null && row.subLeft !== row.titleLeft) failures.push(`${label} ${r}: "${row.title}" title and subtitle left edges differ`);
      if (row.scrollW > row.innerW + 1) failures.push(`${label} ${r}: page scrolls sideways`);
    }
    const lefts = new Set(rows.map((x) => x.titleLeft)); if (lefts.size > 1) failures.push(`${label} ${r}: titles do not share one left edge (${[...lefts].join(",")})`);
  }
};
for (const [w, h, mobile] of [[320, 568, true], [390, 844, true], [1280, 800, false]]) {
  for (const mode of ["wattle", "adhdme"]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile });
    await ctx.addCookies([{ name: "wattle.mode", value: mode, domain: new URL(BASE).hostname, path: "/" }]);
    const page = await ctx.newPage();
    await page.addInitScript(() => localStorage.setItem("wattle.splash.seen", "true"));
    const label = `${w} ${mode}`;
    if (mode === "wattle") { await search(page, { example: "Endometriosis, someone who listens" }); await search(page, { typed: "a psychiatrist for adult ADHD in Brisbane who explains things" }); await search(page, { example: "Menopause, longer appointments" }); }
    else { await search(page, { example: "ADHD assessment as an adult" }); await search(page, { typed: "medication review for my son" }); }
    // re-open a recent search, then measure again
    await page.goto(`${BASE}/recent`, { waitUntil: "networkidle" }); await page.waitForTimeout(700);
    const first = page.locator("main .ios-group > *").first(); if (await first.count()) { await first.click(); await page.waitForURL(/results/, { timeout: 20000 }).catch(() => {}); await page.waitForTimeout(1000); }
    await measure(page, label);
    await ctx.close();
  }
}
await browser.close();
console.log(seen.join("\n"));
console.log(failures.length ? `\n${failures.length} failure(s):\n` + failures.join("\n") : "\nrecent geometry: clean");
process.exit(failures.length ? 1 : 0);
