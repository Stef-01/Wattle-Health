// Spacing census of a mobile page: side margins, row heights, vertical paddings, text sizes, gaps between blocks.
import { chromium, devices } from "@playwright/test";
const urls = process.argv.slice(2);
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices["iPhone 13"], locale: "en-AU" });
const page = await ctx.newPage();
const CENSUS = () => {
  const W = innerWidth;
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && r.bottom > 0 && r.top < document.documentElement.scrollHeight; };
  const px = (v) => Math.round(parseFloat(v) || 0);
  const count = (m, k) => m.set(k, (m.get(k) ?? 0) + 1);
  const top = (m, n = 5) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${k}×${v}`).join(" ");
  const out = {};
  // side margin: the left edge of text nodes, mode
  const lefts = new Map(), rights = new Map();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n; const textRects = [];
  while ((n = walker.nextNode())) {
    if (!n.textContent.trim() || !n.parentElement || !vis(n.parentElement)) continue;
    const rg = document.createRange(); rg.selectNodeContents(n); const r = rg.getBoundingClientRect();
    if (r.width === 0) continue;
    textRects.push(r); count(lefts, Math.round(r.left)); count(rights, Math.round(W - r.right));
  }
  out.textLeftEdges = top(lefts); out.textRightEdges = top(rights);
  // font sizes and line heights in use
  const fs = new Map(), lh = new Map(), fsLh = new Map();
  for (const el of document.body.querySelectorAll("*")) {
    if (!vis(el)) continue;
    const has = [...el.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim());
    if (!has) continue;
    const cs = getComputedStyle(el);
    count(fs, px(cs.fontSize)); count(lh, px(cs.lineHeight)); count(fsLh, `${px(cs.fontSize)}/${px(cs.lineHeight)}`);
  }
  out.fontSizes = top(fs, 8); out.fontLine = top(fsLh, 8);
  // tappable rows/buttons: heights, vertical padding, horizontal padding
  const h = new Map(), py = new Map(), pxm = new Map(), rad = new Map();
  for (const el of document.body.querySelectorAll("a,button,[role=button],li,[role=listitem],[role=tab]")) {
    if (!vis(el)) continue;
    const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    if (r.width < 40 || r.height < 24 || r.height > 200) continue;
    count(h, Math.round(r.height)); count(py, `${px(cs.paddingTop)}/${px(cs.paddingBottom)}`); count(pxm, px(cs.paddingLeft)); count(rad, px(cs.borderRadius));
  }
  out.controlHeights = top(h, 8); out.controlPadY = top(py, 6); out.controlPadX = top(pxm, 6); out.radii = top(rad, 6);
  // vertical gaps between consecutive text blocks (the rhythm)
  const sorted = textRects.filter((r) => r.height < 120).sort((a, b) => a.top - b.top);
  const gaps = new Map();
  for (let i = 1; i < sorted.length; i++) { const g = Math.round(sorted[i].top - sorted[i - 1].bottom); if (g >= 0 && g <= 120) count(gaps, g); }
  out.gapsBetweenTextBlocks = top(gaps, 10);
  // card/container paddings
  const cp = new Map();
  for (const el of document.body.querySelectorAll("section,article,div")) {
    if (!vis(el)) continue; const cs = getComputedStyle(el);
    if ((cs.backgroundColor !== "rgba(0, 0, 0, 0)" || px(cs.borderRadius) > 0) && px(cs.paddingLeft) > 0) count(cp, `${px(cs.paddingTop)}/${px(cs.paddingLeft)}`);
  }
  out.cardPadding = top(cp, 6);
  out.words = document.body.innerText.split(/\s+/).filter(Boolean).length;
  out.viewport = `${W}×${innerHeight}`;
  return out;
};
for (const u of urls) {
  try {
    await page.goto(u, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(3500);
    for (const sel of ["button:has-text('Accept')", "button:has-text('Agree')", "button:has-text('Got it')", "[aria-label='Close']"]) { const b = page.locator(sel).first(); if (await b.count()) { await b.click({ timeout: 1000 }).catch(() => {}); } }
    const c = await page.evaluate(CENSUS);
    console.log("\n## " + u + "  " + c.viewport + "  words " + c.words);
    for (const [k, v] of Object.entries(c)) if (k !== "viewport" && k !== "words") console.log(`  ${k.padEnd(22)} ${v}`);
    await page.screenshot({ path: `../bench/${u.replace(/[^a-z0-9]+/gi, "_").slice(0, 60)}.png`, fullPage: false });
  } catch (e) { console.log("\n## " + u + " FAILED " + e.message.slice(0, 80)); }
}
await browser.close();
