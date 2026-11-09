// Visible words per route at iPhone 15 (first screen and whole page). Gate: the first screen holds at most
// MAX words (CLAUDE.md text budget, 20 to 60 at 390 px; Headspace 26 to 60, Finch 19). Exit 1 over it.
// Empty states sit under 20 by nature and are not failures. BASE for the server, ROUTES=/a,/b to narrow.
import { chromium, devices } from "@playwright/test";
const BASE = (process.env.BASE ?? "http://localhost:3300").replace(/\/$/, "");
const ROUTES = process.env.ROUTES ? process.env.ROUTES.split(",") : ["/", "/recent", "/saved", "/me", "/me/openings", "/me/discover", "/me/context", "/healthspan", "/narrow", "/about", "/about/coverage", "/compare", "/join", "/join/verify"];
const MAX = Number(process.env.MAX ?? 60);
const over = [];
const b = await chromium.launch();
const page = await (await b.newContext({ ...devices["iPhone 15"] })).newPage();
await page.goto(`${BASE}/`);
await page.evaluate(() => { localStorage.setItem("wattle.splash.seen", "true"); localStorage.setItem("wattle.saved.v1", JSON.stringify(["general-practice:sian-hebron"])); });
for (const r of ROUTES) {
  await page.goto(`${BASE}${r}`, { waitUntil: "networkidle" }).catch(() => null);
  await page.waitForTimeout(400);
  const t = await page.evaluate(() => {
    const vis = (el) => { const x = el.getBoundingClientRect(); return x.top < innerHeight && x.bottom > 0; };
    const nodes = [...document.querySelectorAll("body *")].filter((e) => e.childElementCount === 0 && e.textContent.trim());
    const words = (a) => a.map((e) => e.textContent.trim()).join(" ").split(/\s+/).filter(Boolean).length;
    return { fold: words(nodes.filter(vis)), all: words(nodes), text: nodes.filter(vis).map((e) => e.textContent.trim()).join(" | ").slice(0, 700) };
  });
  if (t.fold > MAX) over.push(`${r} ${t.fold}`);
  console.log(`${r}  fold=${t.fold}${t.fold > MAX ? " OVER" : ""} all=${t.all}\n  ${t.text}\n`);
}
await b.close();
if (over.length) { console.log(`words: over ${MAX} on ${over.join(", ")}`); process.exit(1); }
console.log(`words: every first screen within ${MAX}`);
