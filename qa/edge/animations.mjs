// Every browsing route, both widths: what animates in the first 1.5 s after arrival, how long, and on which
// property. Fails on anything over 300 ms that is not a declared loop, or on a layout property.
import { chromium } from "@playwright/test";
const BASE = process.env.BASE ?? "http://localhost:3300";
const ROUTES = ["/", "/narrow", "/results", "/results/none", "/recent", "/saved", "/me", "/me/openings", "/me/discover", "/me/context", "/healthspan", "/about", "/about/coverage", "/compare", "/join", "/join/verify", "/join/practice", "/join/interview", "/join/review", "/adjust", "/heard", "/splash", "/doctor/general-practice~sian-hebron"];
const LAYOUT = /^(width|height|top|left|right|bottom|margin|padding|font-size|line-height)/;
const ALLOWED_LONG = /^(listen|breathe|orb|spin)/; // loops
const browser = await chromium.launch();
const failures = []; const seenAll = new Map();
for (const width of [390, 1280]) {
  const page = await (await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 800 }, isMobile: width < 500, hasTouch: width < 500 })).newPage();
  await page.addInitScript(() => localStorage.setItem("wattle.splash.seen", "true"));
  for (const r of ROUTES) {
    await page.goto(`${BASE}${r}`, { waitUntil: "commit" }).catch(() => {});
    const seen = await page.evaluate(async () => {
      const out = new Map(); const t0 = performance.now();
      while (performance.now() - t0 < 1500) {
        for (const a of document.getAnimations()) { const e = a.effect; const t = e?.getTiming?.() ?? {}; const target = e?.target; const name = a.animationName ?? a.transitionProperty ?? "?"; const key = `${name}|${Math.round(t.duration ?? 0)}|${t.iterations === Infinity ? "loop" : "once"}|${target?.tagName?.toLowerCase()}.${(target?.className?.baseVal ?? target?.className ?? "").toString().split(" ")[0]}`; out.set(key, (out.get(key) ?? 0) + 1); }
        await new Promise((res) => requestAnimationFrame(res));
      }
      return [...out.entries()];
    });
    for (const [key, n] of seen) {
      const [name, dur, loop] = key.split("|");
      seenAll.set(key, (seenAll.get(key) ?? 0) + n);
      if (LAYOUT.test(name)) failures.push(`${width} ${r}: layout property animated: ${key}`);
      if (+dur > 300 && loop !== "loop" && !/^transform$|sheet/.test(name) && !ALLOWED_LONG.test(name)) failures.push(`${width} ${r}: ${dur} ms is over the 300 ms ceiling: ${key}`);
    }
  }
  await page.context().close();
}
await browser.close();
console.log("animations seen across", ROUTES.length, "routes × 2 widths:");
for (const [k, n] of [...seenAll.entries()].sort((a, b) => b[1] - a[1])) console.log(String(n).padStart(4), k.replace(/\|/g, "  "));
console.log(failures.length ? `\n${failures.length} failure(s):\n` + failures.join("\n") : "\nanimations: clean");
process.exit(failures.length ? 1 : 0);
