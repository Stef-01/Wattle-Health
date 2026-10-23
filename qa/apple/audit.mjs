// Apple pass audit (2026-10-23): reads computed styles from the rendered DOM of every patient
// screen at iPhone 15 size and reports what an Apple design review would count: distinct font
// sizes, weights, text colours and corner radii in use; text below 4.5:1 contrast; tap targets
// under 44 px; uppercase labels; hand-set letter-spacing. Run before and after a change:
//   CHROME=/opt/pw-browsers/chromium node qa/apple/audit.mjs > qa/apple/audit-after.json
import { chromium, devices } from "@playwright/test";
const BASE = (process.env.BASE ?? "http://localhost:3300").replace(/\/$/, "");
const ROUTES = ["/", "/recent", "/saved", "/me", "/me/openings", "/me/discover", "/me/context", "/healthspan", "/about", "/doctor/general-practice~sian-hebron", "/join"];
const b = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
const page = await (await b.newContext({ ...devices["iPhone 15"] })).newPage();
await page.goto(`${BASE}/`);
await page.evaluate(() => {
  localStorage.setItem("wattle.splash.seen", "true");
  localStorage.setItem("wattle.saved.v1", JSON.stringify(["general-practice:sian-hebron", "obstetrics-gynaecology:tal-jacobson"]));
  localStorage.setItem("wattle.recent.v1", JSON.stringify([{ id: "a", label: "Endometriosis, Brisbane", condition: "Endometriosis", matches: 3, at: "2026-10-18T10:00:00Z" }, { id: "b", label: "ADHD, Brisbane", condition: "ADHD", matches: 3, at: "2026-10-17T10:00:00Z" }]));
});
const total = { sizes: new Set(), weights: new Set(), colors: new Set(), radii: new Set() };
const report = {};
for (const r of ROUTES) {
  await page.goto(`${BASE}${r}`, { waitUntil: "networkidle" }).catch(() => null);
  await page.waitForTimeout(700);
  const res = await page.evaluate(() => {
    // Tailwind 4 computes some colours as oklab()/color-mix(); a canvas normalises any CSS colour to RGBA.
    const cv = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
    const rgba = (c) => { cv.clearRect(0, 0, 1, 1); cv.fillStyle = "#000"; cv.fillStyle = c; cv.fillRect(0, 0, 1, 1); const d = cv.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
    const lum = (c) => {
      const m = rgba(c);
      const [r, g, bl] = m.slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
      return { L: 0.2126 * r + 0.7152 * g + 0.0722 * bl, a: m[3] ?? 1, rgb: m.slice(0, 3) };
    };
    // Effective background: walk up until an opaque background is found (white page assumed).
    const bgOf = (el) => {
      for (let e = el; e; e = e.parentElement) {
        const c = getComputedStyle(e).backgroundColor;
        const p = lum(c);
        if (p.a >= 0.99) return p;
      }
      return lum("rgb(255,255,255)");
    };
    const blend = (fg, bg) => {
      const a = fg.a;
      const rgb = fg.rgb.map((v, i) => v * a + bg.rgb[i] * (1 - a));
      return lum(`rgb(${rgb.join(",")})`);
    };
    const ratio = (x, y) => (Math.max(x.L, y.L) + 0.05) / (Math.min(x.L, y.L) + 0.05);
    const vis = (el) => { const x = el.getBoundingClientRect(); return x.width > 0 && x.height > 0 && getComputedStyle(el).visibility !== "hidden" && getComputedStyle(el).opacity !== "0"; };
    const out = { sizes: {}, weights: {}, colors: {}, radii: {}, lowContrast: [], smallTargets: [], uppercase: 0, tracking: {} };
    const texts = [...document.querySelectorAll("body *")].filter((e) => vis(e) && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && !e.closest("nextjs-portal"));
    for (const e of texts) {
      const s = getComputedStyle(e);
      out.sizes[s.fontSize] = (out.sizes[s.fontSize] ?? 0) + 1;
      out.weights[s.fontWeight] = (out.weights[s.fontWeight] ?? 0) + 1;
      out.colors[s.color] = (out.colors[s.color] ?? 0) + 1;
      if (s.textTransform === "uppercase") out.uppercase++;
      if (s.letterSpacing !== "normal") out.tracking[s.letterSpacing] = (out.tracking[s.letterSpacing] ?? 0) + 1;
      const bg = bgOf(e);
      const fg = blend(lum(s.color), bg);
      const cr = ratio(fg, bg);
      const large = parseFloat(s.fontSize) >= 24 || (parseFloat(s.fontSize) >= 18.66 && Number(s.fontWeight) >= 700);
      if (cr < (large ? 3 : 4.5) && !e.closest("[aria-hidden=true]") && !(e instanceof HTMLButtonElement && e.disabled)) out.lowContrast.push(`${e.textContent.trim().slice(0, 32)} (${cr.toFixed(2)})`);
    }
    for (const e of document.querySelectorAll("body *")) {
      if (!vis(e) || e.closest("nextjs-portal")) continue;
      const rad = getComputedStyle(e).borderTopLeftRadius;
      if (rad !== "0px") out.radii[rad] = (out.radii[rad] ?? 0) + 1;
    }
    for (const e of document.querySelectorAll("a[href], button, [role=button], [role=tab], [role=switch], input, textarea")) {
      if (!vis(e) || e.closest("nextjs-portal") || e.closest("[aria-hidden=true]")) continue;
      const x = e.getBoundingClientRect();
      if (x.width < 44 && x.height < 44) out.smallTargets.push(`${(e.getAttribute("aria-label") ?? e.textContent ?? "").trim().slice(0, 24)} ${Math.round(x.width)}x${Math.round(x.height)}`);
      else if (Math.min(x.width, x.height) < 28) out.smallTargets.push(`${(e.getAttribute("aria-label") ?? e.textContent ?? "").trim().slice(0, 24)} ${Math.round(x.width)}x${Math.round(x.height)}`);
    }
    return out;
  });
  for (const k of ["sizes", "weights", "colors", "radii"]) Object.keys(res[k]).forEach((v) => total[k].add(v));
  report[r] = { sizes: Object.keys(res.sizes).length, weights: Object.keys(res.weights), colors: Object.keys(res.colors).length, radii: Object.keys(res.radii).length, uppercase: res.uppercase, tracking: res.tracking, lowContrast: res.lowContrast.slice(0, 8), smallTargets: res.smallTargets.slice(0, 8) };
}
const sortPx = (s) => [...s].sort((a, b) => parseFloat(a) - parseFloat(b));
console.log(JSON.stringify({ totals: { sizes: sortPx(total.sizes), weights: [...total.weights].sort(), colors: total.colors.size, colorList: [...total.colors], radii: sortPx(total.radii) }, routes: report }, null, 1));
await b.close();
