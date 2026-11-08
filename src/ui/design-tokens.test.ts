// Design round 1 (2026-11-08, docs/design-appraisal.md): the lenses' findings, kept as a gate.
// Every colour, shadow, corner and duration a screen uses is a token in app/globals.css; a screen never
// names a value. The gate reads the source, so it runs without a browser and fails on the line that broke it.
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../..");
const walk = (dir: string, out: string[] = []): string[] => {
  for (const f of readdirSync(dir)) {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f)) out.push(p);
  }
  return out;
};
const SCREENS = [...walk(path.join(ROOT, "app")), ...walk(path.join(ROOT, "src/ui"))];
const rel = (p: string) => path.relative(ROOT, p).replace(/\\/g, "/");
const lines = (p: string) => readFileSync(p, "utf8").split("\n").map((text, i) => ({ text, line: i + 1 }));
const code = (t: string) => t.replace(/\/\*.*?\*\//g, "").replace(/^\s*\/\/.*$/, "").replace(/\/\*\*.*$/, "");

/** Where a literal is the thing itself, not a design value. */
const ALLOWED: Record<string, RegExp[]> = {
  // the browser-chrome colour for each page, a platform value with no CSS context
  "*": [/themeColor:\s*"#[0-9a-f]{6}"/i, /(background|theme)_color:\s*"#[0-9a-f]{6}"/i],
  // the calendar providers' own marks (Google, Apple, Outlook), drawn in their brand colours
  "src/ui/screens/patient-b/CalendarConnect.tsx": [/<(rect|path|circle|text)\b/],
};
const allowed = (file: string, text: string) => [...(ALLOWED["*"] ?? []), ...(ALLOWED[file] ?? [])].some((re) => re.test(text));

const offenders = (re: RegExp, note: string) => {
  const out: string[] = [];
  for (const p of SCREENS) {
    const file = rel(p);
    for (const { text, line } of lines(p)) {
      const t = code(text);
      if (re.test(t) && !allowed(file, t)) out.push(`${file}:${line} ${note}: ${t.trim().match(re)?.[0]}`);
    }
  }
  return out;
};

describe("screens name no raw design values (docs/design-appraisal.md, hallmark 48, impeccable theming)", () => {
  it("no colour literal in a class or a style", () => {
    expect(offenders(/#[0-9a-fA-F]{3,8}\b|rgba?\(/, "colour literal")).toEqual([]);
  });
  it("no arbitrary shadow: shadow-float, shadow-knob, shadow-tag, shadow-glass, drop-shadow-pill", () => {
    expect(offenders(/\b(drop-)?shadow-\[/, "arbitrary shadow")).toEqual([]);
  });
  it("no arbitrary corner: rounded-card, -control, -field, -icon, -sheet, -pill, -full", () => {
    expect(offenders(/\brounded(-[trbl]{1,2})?-\[/, "arbitrary radius")).toEqual([]);
  });
  it("no arbitrary type size: the iOS ramp, text-quote, text-hero, text-monogram, text-wordmark", () => {
    expect(offenders(/\btext-\[\d/, "arbitrary font size")).toEqual([]);
  });
  it("no literal duration: duration-(--duration-press|fast|base|slow|sheet)", () => {
    expect(offenders(/\bduration-\d|\bduration-\[/, "literal duration")).toEqual([]);
  });
  it("no transition on a layout property (ui-skills: never animate layout; hallmark 10a)", () => {
    expect(offenders(/\btransition-\[[^\]]*\b(width|height|top|left|right|bottom|margin|padding)\b/, "layout transition")).toEqual([]);
  });
  it("no transition-all", () => {
    expect(offenders(/\btransition-all\b/, "transition-all")).toEqual([]);
  });
  it("no h-screen or 100vh (ui-skills: dvh)", () => {
    expect(offenders(/\b(min-)?h-screen\b|100vh/, "vh")).toEqual([]);
  });
  it("no uppercase label or hand-set tracking (Apple pass)", () => {
    expect(offenders(/\buppercase\b|\btracking-/, "uppercase or tracking")).toEqual([]);
  });
  it("a .hit control never clips its own extension (truncate or overflow-hidden on the same element)", () => {
    // overflow: hidden on the control is the containing block of its ::after, so the 44 px extension was clipped
    // and a tap 5 px off a 32 px segment did nothing (edge test, 2026-11-08). Truncate the label inside instead.
    expect(offenders(/className=\{?[`"][^`"]*hit[^`"]*(truncate|overflow-hidden|overflow-clip)|className=\{?[`"][^`"]*(truncate|overflow-hidden|overflow-clip)[^`"]*hit/, "hit clipped")).toEqual([]);
  });
  it("a transform transition carries a reduced-motion variant (hallmark 27, ui-skills)", () => {
    const out: string[] = [];
    for (const p of SCREENS) for (const { text, line } of lines(p)) if (/transition-transform/.test(text) && !/motion-reduce:/.test(text)) out.push(`${rel(p)}:${line}`);
    expect(out).toEqual([]);
  });
});

describe("app/globals.css is the one place a value lives", () => {
  const css = readFileSync(path.join(ROOT, "app/globals.css"), "utf8");
  const theme = css.slice(css.indexOf("@theme {"), css.indexOf("\n}\n", css.indexOf("@theme {")) + 3);
  const rest = css.slice(theme.length + css.indexOf("@theme {"));
  const restLines = rest.split("\n").map((text, i) => ({ text: text.replace(/\/\*.*?\*\//g, ""), line: i + 1 + theme.split("\n").length }));
  it("no colour literal outside @theme (mask-image, which is coverage not colour, excepted)", () => {
    const hits = restLines.filter(({ text }) => /#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(text) && !/mask-image/.test(text)).map(({ text, line }) => `globals.css:${line} ${text.trim()}`);
    expect(hits).toEqual([]);
  });
  it("no literal duration outside @theme (a loop of a second or more excepted)", () => {
    const hits = restLines.filter(({ text }) => /\b\d+(\.\d+)?m?s\b/.test(text) && !/\b\d+(\.\d+)?s\s+[a-z-]+\s+infinite/.test(text) && !/\b0m?s\b/.test(text) && !/--/.test(text) && !/calc\(/.test(text)).map(({ text, line }) => `globals.css:${line} ${text.trim()}`);
    expect(hits).toEqual([]);
  });
  it("the five durations exist and an exit is never slower than its entrance", () => {
    const ms = (k: string) => Number(theme.match(new RegExp(`--duration-${k}: (\\d+)ms`))?.[1]);
    const d = { press: ms("press"), fast: ms("fast"), base: ms("base"), slow: ms("slow"), sheet: ms("sheet") };
    expect(Object.values(d).every(Number.isFinite)).toBe(true);
    expect(d.press < d.fast && d.fast < d.base && d.base < d.slow && d.slow < d.sheet).toBe(true);
    // the sheet leaves on --duration-slow, the scrim on --duration-base: both quicker than their entrances
    expect(/\.sheet-closing \.sheet-panel \{[^}]*var\(--duration-slow\)/.test(css)).toBe(true);
    expect(/\.sheet-closing \.sheet-scrim \{[^}]*var\(--duration-base\)/.test(css)).toBe(true);
  });
  it("every token a screen names exists", () => {
    const names = new Set([...theme.matchAll(/--([a-z0-9-]+):/g)].map((m) => m[1]));
    const missing: string[] = [];
    for (const p of SCREENS) for (const { text, line } of lines(p)) for (const m of text.matchAll(/var\(--([a-z0-9-]+)\)/g)) {
      if (!names.has(m[1]!) && !/^(page-bg|nav-h|tab-gap|dock-pb|hairline|i|sep)$/.test(m[1]!)) missing.push(`${rel(p)}:${line} --${m[1]}`);
    }
    for (const p of SCREENS) for (const { text, line } of lines(p)) for (const m of text.matchAll(/duration-\(--([a-z-]+)\)/g)) if (!names.has(m[1]!)) missing.push(`${rel(p)}:${line} --${m[1]}`);
    expect(missing).toEqual([]);
  });
  it("html and body clip sideways scroll (hallmark 34)", () => {
    expect(/html \{[^}]*overflow-x: clip/.test(css) && /body \{[^}]*overflow-x: clip/.test(css)).toBe(true);
  });
  it("a portrait is visible at rest (hallmark 62, impeccable buried-raster)", () => {
    expect(/\.img-fade \{\s*opacity: 1/.test(css)).toBe(true);
  });
});
