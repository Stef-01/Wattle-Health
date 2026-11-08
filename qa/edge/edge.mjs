// The patient UI at its edges (docs/design-appraisal.md, 2026-11-08), ported from Med-OS's scripts/e2e/edge.mjs:
//   - every patient route at 320, 390 and 1280 px (320 with reduced motion), audited on screen: nothing runs off
//     the right edge, every control has a 44 px hit area (measured with elementFromPoint, so a .hit ::after counts
//     and a clipped one does not), every word of text meets WCAG AA against the colour actually under it;
//   - the keyboard alone on Home and a profile: every stop it reaches shows a focus ring;
//   - a 180-character search and a search in a language the matcher does not know: no overflow, no blank screen;
//   - the browser console: no error on any route.
// Exit 1 when anything fails. Run against a built server:  pnpm start & node qa/edge/edge.mjs
//   BASE=https://wattlehealth.vercel.app node qa/edge/edge.mjs   checks production.
import { chromium } from "@playwright/test";

const BASE = (process.env.BASE ?? "http://localhost:3300").replace(/\/$/, "");
const ROUTES = ["/", "/narrow", "/results", "/results/none", "/recent", "/saved", "/me", "/me/openings", "/me/discover", "/me/context", "/healthspan", "/about", "/about/coverage", "/compare", "/join", "/doctor/general-practice~sian-hebron"];
const WIDTHS = [320, 390, 1280];
const LONG = "I have had endometriosis for eleven years and I am looking for a gynaecologist in Brisbane who listens, explains the options without rushing, and is happy to work alongside my GP and my psychologist";

/* what is wrong on the screen right now, measured in the page */
const AUDIT = () => {
  const W = innerWidth;
  const out = { wide: document.documentElement.scrollWidth > W + 1, small: [], low: [], words: 0 };
  const name = (el) => `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""} "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 28)}"`;
  const shown = (el) => {
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity === 0) return false;
      if (e.getAttribute("aria-hidden") === "true") return false;
    }
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight;
  };
  /* hit areas: a 44 px square centred on the control must land on the control (or something inside it) */
  for (const el of document.querySelectorAll("a[href], button, [role=button], [role=tab], [role=radio], [role=switch], input, textarea, select, summary")) {
    if (!shown(el) || el.closest("nextjs-portal")) continue;
    if (getComputedStyle(el).display === "inline" && el.closest("p")) continue; // a link in a sentence (WCAG 2.5.8)
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const hits = (x, y) => { const t = document.elementFromPoint(x, y); return !!t && (t === el || el.contains(t) || t.contains(el) && t.closest("a[href],button,[role=button]") === el); };
    let w = r.width, h = r.height;
    if (w < 44 || h < 44) {
      // the .hit ::after extension: probe 22 px out from the centre
      const okV = hits(cx, cy - 21) && hits(cx, cy + 21), okH = hits(cx - 21, cy) && hits(cx + 21, cy);
      if (okV) h = 44;
      if (okH) w = 44;
    }
    if (w < 44 || h < 44) out.small.push(`${name(el)} ${Math.round(r.width)}x${Math.round(r.height)}`);
  }
  /* contrast: every text node against the first opaque background under it */
  const cv = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  const rgba = (c) => { cv.clearRect(0, 0, 1, 1); cv.fillStyle = "#010203"; cv.fillStyle = c; if (cv.fillStyle === "#010203" && c !== "#010203") return null; cv.fillRect(0, 0, 1, 1); const d = cv.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const L = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  /* the colour under the first word: sampled at the text node's own box, so a dot or an icon beside it is not mistaken for its background */
  const under = (el) => {
    const node = [...el.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
    const range = document.createRange(); range.selectNodeContents(node);
    const r = range.getBoundingClientRect();
    if (!r.width || r.top < 0 || r.bottom > innerHeight) return null; // off screen, or partly: not what the reader sees
    // chrome pinned over scrolling content draws its own material (.scroll-edge, pointer-events none, so no hit test sees it)
    const bar = el.closest(".sticky, .fixed, .frame-fixed");
    if (bar && bar.querySelector(".scroll-edge")) { const main = el.closest("main"); return rgba(getComputedStyle(main ?? document.body).backgroundColor) ?? [255, 255, 255, 1]; }
    const x = Math.min(innerWidth - 1, Math.max(0, r.left + Math.min(4, r.width / 2))), y = Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2));
    const stack = document.elementsFromPoint(x, y);
    if (stack[0] && stack[0] !== el && !el.contains(stack[0]) && !stack[0].contains(el)) return null; // covered by chrome (a bar over scrolled text): not read
    const acc = [255, 255, 255];
    const layers = [];
    for (const e of stack) { const c = rgba(getComputedStyle(e).backgroundColor); if (c === null) return null; if (c[3] > 0) layers.push(c); if (e.tagName === "IMG" || getComputedStyle(e).backgroundImage !== "none") return null; }
    for (const c of layers.reverse()) for (let i = 0; i < 3; i++) acc[i] = c[i] * c[3] + acc[i] * (1 - c[3]);
    return acc;
  };
  /* the opacity the text is really drawn at (an arriving .rise is skipped until it has arrived) */
  const drawnAt = (el) => { let o = 1; for (let e = el; e && e !== document.documentElement; e = e.parentElement) o *= +getComputedStyle(e).opacity; return o; };
  for (const el of document.querySelectorAll("body *")) {
    if (el.closest("nextjs-portal, [aria-hidden=true]") || !shown(el)) continue;
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    const cs = getComputedStyle(el);
    out.words += (el.textContent.trim().match(/\S+/g) ?? []).length;
    if (drawnAt(el) < 0.99) continue; // still arriving, or dimmed by a press
    const bg = under(el);
    if (!bg) continue; // text over a photo or a gradient sits on its own dimming layer
    const fg = rgba(cs.color);
    if (!fg) continue;
    const blended = fg.map((v, i) => (i < 3 ? v * fg[3] + bg[i] * (1 - fg[3]) : 1));
    const ratio = (Math.max(L(blended), L(bg)) + 0.05) / (Math.min(L(blended), L(bg)) + 0.05);
    const px = parseFloat(cs.fontSize), large = px >= 24 || (px >= 18.66 && +cs.fontWeight >= 700);
    if (ratio < (large ? 3 : 4.5) && !(el instanceof HTMLButtonElement && el.disabled) && !el.closest("[aria-disabled=true]")) out.low.push(`"${el.textContent.trim().slice(0, 30)}" ${ratio.toFixed(2)}`);
  }
  return out;
};

const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
const failures = [];
const report = {};
const seed = async (page) => {
  await page.goto(`${BASE}/`);
  await page.evaluate(() => {
    localStorage.setItem("wattle.splash.seen", "true");
    localStorage.setItem("wattle.saved.v1", JSON.stringify(["general-practice:sian-hebron"]));
    localStorage.setItem("wattle.recent.v1", JSON.stringify([{ id: "a", label: "Endometriosis, Brisbane", condition: "Endometriosis", matches: 3, at: "2026-10-18T10:00:00Z" }]));
  });
};

for (const width of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width, height: width >= 1024 ? 800 : 844 }, deviceScaleFactor: width >= 1024 ? 1 : 3, isMobile: width < 1024, hasTouch: width < 1024, reducedMotion: width === 320 ? "reduce" : "no-preference" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 160)); });
  page.on("response", (r) => { if (r.status() >= 400 && !/\/_vercel\//.test(r.url())) errors.push(`${r.status()} ${r.url().replace(BASE, "")}`); });
  page.on("pageerror", (e) => errors.push(`pageerror ${e.message.slice(0, 160)}`));
  await seed(page);
  for (const r of ROUTES) {
    await page.goto(`${BASE}${r}`, { waitUntil: "networkidle" }).catch((e) => failures.push(`${width} ${r}: ${e.message.slice(0, 80)}`));
    await page.waitForTimeout(500);
    const a = await page.evaluate(AUDIT);
    report[`${width} ${r}`] = { words: a.words, small: a.small.length, low: a.low.length, wide: a.wide };
    if (a.wide) failures.push(`${width} ${r}: runs off the right edge`);
    for (const s of a.small) failures.push(`${width} ${r}: small target ${s}`);
    for (const l of a.low) failures.push(`${width} ${r}: low contrast ${l}`);
    // scrolled to the foot: the dock and the tab bar over the last content
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(300);
    const b = await page.evaluate(AUDIT);
    for (const s of b.small) if (!a.small.includes(s)) failures.push(`${width} ${r} (foot): small target ${s}`);
    for (const l of b.low) if (!a.low.includes(l)) failures.push(`${width} ${r} (foot): low contrast ${l}`);
  }
  // the long search and the unknown one
  for (const q of [LONG, "Ich suche einen Arzt der zuhört"]) {
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.fill("textarea", q);
    await page.locator("button[type=submit]").first().click();
    await page.waitForTimeout(2500);
    const a = await page.evaluate(AUDIT);
    const url = page.url().replace(BASE, "");
    report[`${width} search "${q.slice(0, 18)}…"`] = { landed: url.split("?")[0], words: a.words, wide: a.wide };
    if (a.wide) failures.push(`${width} search "${q.slice(0, 18)}…": runs off the right edge on ${url}`);
    if (a.words < 5) failures.push(`${width} search "${q.slice(0, 18)}…": blank screen on ${url}`);
    for (const s of a.small) failures.push(`${width} search "${q.slice(0, 18)}…": small target ${s}`);
  }
  if (errors.length) failures.push(`${width}: console errors: ${[...new Set(errors)].slice(0, 5).join(" | ")}`);
  await ctx.close();
}

// the keyboard alone: every stop shows a ring (an outline or a box-shadow) and sits on screen
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await seed(page);
  for (const r of ["/", "/doctor/general-practice~sian-hebron", "/me"]) {
    await page.goto(`${BASE}${r}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    const seen = new Set();
    let stops = 0, noRing = [];
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press("Tab");
      const f = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        if (!el.dataset.edgeStop) el.dataset.edgeStop = String(Object.keys(document.querySelectorAll("[data-edge-stop]")).length + 1);
        const cs = getComputedStyle(el);
        const ring = (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== "none";
        const r = el.getBoundingClientRect();
        return { key: `#${el.dataset.edgeStop} ${el.tagName}:${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 24)}`, ring, onScreen: r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth, field: /^(INPUT|TEXTAREA)$/.test(el.tagName) };
      });
      if (!f) break;
      if (seen.has(f.key)) break;
      seen.add(f.key);
      stops++;
      if (!f.ring && !f.field) noRing.push(f.key);
      if (!f.onScreen) failures.push(`keyboard ${r}: focus moved off screen at ${f.key}`);
    }
    report[`keyboard ${r}`] = { stops, noRing: noRing.length };
    for (const k of noRing) failures.push(`keyboard ${r}: no focus ring on ${k}`);
  }
  await ctx.close();
}

await browser.close();
console.log(JSON.stringify({ base: BASE, report, failures }, null, 1));
if (failures.length) { console.error(`\n${failures.length} edge failure(s)`); process.exit(1); }
console.log("\nedge: clean");
