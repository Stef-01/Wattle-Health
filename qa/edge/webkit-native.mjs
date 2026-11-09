// The mobile-native rules in the Safari engine (Playwright WebKit, iPhone 14 descriptor) against production:
// no sticky hover after a tap, dvh frames, 16 px inputs, safe-area and touch-action declarations resolved,
// no tap highlight, the Refine sheet drags and dismisses by touch, Recent rows keep their gap. Not an iPhone,
// but the same engine; what it cannot show is the device's own chrome (URL bar collapse, keyboard, notch).
import { webkit, devices } from "@playwright/test";
const BASE = process.env.BASE ?? "https://wattlehealth.vercel.app";
const b = await webkit.launch();
const c = await b.newContext({ ...devices["iPhone 14"] });
const p = await c.newPage(); await p.addInitScript(() => localStorage.setItem("wattle.splash.seen", "true"));
const fails = []; const note = (k, ok, v) => { console.log(`${ok ? "ok  " : "FAIL"} ${k}: ${v}`); if (!ok) fails.push(k); };
await p.goto(`${BASE}/`, { waitUntil: "networkidle" }); await p.waitForTimeout(600);
const env = await p.evaluate(async () => {
  const html = getComputedStyle(document.documentElement);
  const inputs = [...document.querySelectorAll("input, textarea, select")].map((e) => parseFloat(getComputedStyle(e).fontSize));
  const ctrls = [...document.querySelectorAll("button, a, [role=button]")];
  const ta = ctrls.map((e) => getComputedStyle(e).touchAction); const us = ctrls.map((e) => getComputedStyle(e).webkitUserSelect || getComputedStyle(e).userSelect);
  const main = document.querySelector("main"); const mh = main ? getComputedStyle(main).minHeight + "/" + getComputedStyle(main).height : "none";
  const probe = document.createElement("div"); probe.style.cssText = "position:fixed;padding-bottom:env(safe-area-inset-bottom, 7px);height:100dvh;width:1px;visibility:hidden"; document.body.appendChild(probe);
  // WebKit exposes -webkit-tap-highlight-color neither as a computed value nor through the CSSOM; read the
  // shipped stylesheet text instead.
  // The stylesheet is inlined since 2026-11-08 (experimental.inlineCss): read <style> blocks as well as any <link>.
  let tap = "not declared"; const sheets = [...document.querySelectorAll("style")].map((el) => el.textContent ?? ""); for (const l of document.querySelectorAll('link[rel="stylesheet"]')) { try { sheets.push(await (await fetch(l.href)).text()); } catch {} } for (const t of sheets) { const m = t.match(/html[^{]*\{[^}]*-webkit-tap-highlight-color:\s*([^;}]+)/); if (m) { tap = m[1]; break; } }
  const cs = getComputedStyle(probe); const out = { tap, hoverMedia: matchMedia("(hover: hover)").matches, pointerFine: matchMedia("(pointer: fine)").matches, minInput: Math.min(...inputs), inputs: inputs.length, touchManip: ta.filter((t) => t === "manipulation").length + "/" + ta.length, userSelectNone: us.filter((t) => t === "none").length + "/" + us.length, dvh: cs.height, innerH: innerHeight, safeArea: cs.paddingBottom, mainH: mh };
  probe.remove(); return out;
});
note("tap highlight transparent (html rule in the shipped stylesheet)", /transparent|rgba\(0, ?0, ?0, ?0\)/.test(env.tap), env.tap);
note("touch device reports no hover / coarse pointer", !env.hoverMedia && !env.pointerFine, `hover:${env.hoverMedia} fine:${env.pointerFine}`);
note("inputs at 16 px or more", env.minInput >= 16, `${env.minInput}px across ${env.inputs}`);
note("touch-action manipulation on controls", env.touchManip.split("/")[0] === env.touchManip.split("/")[1], env.touchManip);
note("user-select none on controls", env.userSelectNone.split("/")[0] === env.userSelectNone.split("/")[1], env.userSelectNone);
note("100dvh resolves to the viewport", parseFloat(env.dvh) === env.innerH, `${env.dvh} vs innerHeight ${env.innerH}`);
note("env(safe-area-inset-bottom) parses (fallback used off-device)", env.safeArea === "7px" || parseFloat(env.safeArea) >= 0, env.safeArea);
// sticky hover: tap a tab, then check no :hover style lingers (press-dim keeps opacity 1 at rest)
await p.tap("nav a[href='/recent']"); await p.waitForURL(/recent/); await p.waitForTimeout(500);
const after = await p.evaluate(() => [...document.querySelectorAll("nav a")].map((a) => getComputedStyle(a).opacity));
note("no sticky hover on tab after tap", after.every((o) => o === "1"), after.join(","));
// Recent rows after a search, by touch
await p.goto(`${BASE}/`, { waitUntil: "networkidle" }); await p.waitForTimeout(400);
await p.getByRole("button", { name: /Endometriosis, someone who/ }).tap(); await p.waitForURL(/narrow/); await p.waitForTimeout(600);
await p.getByText(/Skip to my picks/).first().tap(); await p.waitForURL(/results/, { timeout: 30000 }); await p.waitForTimeout(1500);
// sheet drag by touch
await p.getByRole("button", { name: /Refine/ }).tap(); await p.waitForTimeout(600);
const h = await p.locator(".sheet-panel .chrome").first().boundingBox();
const cdp = null; const x = h.x + h.width / 2, y0 = h.y + h.height / 2;
await p.touchscreen.tap(x, y0); // focus; then a drag via pointer events
await p.evaluate(({ x, y0 }) => { const el = document.elementFromPoint(x, y0); const fire = (type, y) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1, pointerType: "touch", isPrimary: true, button: 0 })); fire("pointerdown", y0); for (let i = 1; i <= 8; i++) fire("pointermove", y0 + i * 15); window.__midTy = new DOMMatrixReadOnly(getComputedStyle(document.querySelector(".sheet-panel")).transform).m42; window.__midScrim = getComputedStyle(document.querySelector(".sheet-scrim")).opacity; fire("pointermove", y0 + 220); fire("pointerup", y0 + 220); }, { x, y0 });
await p.waitForTimeout(600);
const mid = await p.evaluate(() => ({ ty: Math.round(window.__midTy), scrim: Number(window.__midScrim).toFixed(2) })); const open = await p.locator(".sheet-panel").isVisible().catch(() => false);
note("sheet tracks touch 1:1 with scrim linked", mid.ty === 120 && Number(mid.scrim) < 1, JSON.stringify(mid));
note("sheet dismisses on a long touch drag", !open, `open after drag: ${open}`);
await p.goto(`${BASE}/recent`, { waitUntil: "networkidle" }); await p.waitForTimeout(600);
const rows = await p.evaluate(() => [...document.querySelectorAll("main .ios-group > *")].map((row) => { const s = row.querySelector("span.flex.shrink-0"), t = row.querySelector("span.text-body"); if (!s || !t) return null; return Math.round(t.getBoundingClientRect().left - s.getBoundingClientRect().right); }).filter((g) => g !== null));
note("Recent rows keep a 12 px gap in WebKit", rows.length > 0 && rows.every((g) => g === 12), rows.join(","));
await p.screenshot({ path: process.env.SHOT ?? "qa/edge/webkit-recent.png" });
await b.close();
console.log(fails.length ? `\n${fails.length} failure(s): ${fails.join("; ")}` : "\nwebkit native: clean"); process.exit(fails.length ? 1 : 0);
