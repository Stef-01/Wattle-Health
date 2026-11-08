// Vertical rhythm of a screen: every gap between consecutive visible blocks, with the words on each side,
// and whether it sits on the 4 px grid. Pass routes; BASE for the server.
import { chromium, devices } from "@playwright/test";
const BASE = process.env.BASE ?? "http://localhost:3300";
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices["iPhone 13"] });
const page = await ctx.newPage();
await page.addInitScript(() => localStorage.setItem("wattle.splash.seen", "true"));
for (const r of process.argv.slice(2)) {
  await page.goto(`${BASE}${r}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const rows = await page.evaluate(() => {
    const vis = (el) => { const cs = getComputedStyle(el); const b = el.getBoundingClientRect(); return cs.display !== "none" && cs.visibility !== "hidden" && b.width > 0 && b.height > 0 && !el.closest("nav,[aria-hidden=true]"); };
    // leaf blocks: elements with direct text, or images/buttons without text children
    const leaves = [];
    for (const el of document.querySelectorAll("main *")) {
      if (!vis(el)) continue;
      const direct = [...el.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim());
      const isImg = el.tagName === "IMG" && el.width > 20;
      if (!direct && !isImg) continue;
      const b = el.getBoundingClientRect();
      leaves.push({ top: Math.round(b.top + scrollY), bottom: Math.round(b.bottom + scrollY), left: Math.round(b.left), text: (el.alt || el.textContent || el.tagName).trim().replace(/\s+/g, " ").slice(0, 28), fs: getComputedStyle(el).fontSize });
    }
    leaves.sort((a, b) => a.top - b.top || a.left - b.left);
    // merge leaves on the same line
    const lines = [];
    for (const l of leaves) { const p = lines[lines.length - 1]; if (p && Math.abs(p.top - l.top) < 6) { p.bottom = Math.max(p.bottom, l.bottom); p.text += " | " + l.text; } else lines.push({ ...l }); }
    const out = [];
    for (let i = 1; i < lines.length; i++) { const g = lines[i].top - lines[i - 1].bottom; out.push({ gap: g, from: lines[i - 1].text, to: lines[i].text, fs: lines[i].fs }); }
    return out;
  });
  console.log(`\n## ${r}`);
  for (const g of rows) console.log(`${String(g.gap).padStart(5)} ${g.gap % 4 ? "·off" : "    "}  ${g.from.slice(0, 26).padEnd(26)} → ${g.to.slice(0, 26).padEnd(26)} ${g.fs}`);
}
await browser.close();
