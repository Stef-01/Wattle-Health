// Copy rules from CLAUDE.md, checked over every screen's own words (JSX text and string literals in
// src/ui and app, with class attributes removed so utility names such as `leading-read` do not count):
// no superlatives, no medicine brand names, no "specialist" as a claim. Doctors' own profile words live
// in data/, not here, and are theirs. Allowed spots are listed with the reason.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, sep } from "node:path";
import { describe, expect, it } from "vitest";

function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx$/.test(f) && !/\.test\.tsx$/.test(f)) out.push(p);
  }
  return out;
}
const rel = (f: string) => f.split(sep).join("/");
const files = [...walk("src/ui"), ...walk("app")];
const words = (src: string) => src.replace(/className=\{[^}]*\}|className="[^"]*"|class="[^"]*"/g, "").replace(/\bcx\([^)]*\)/g, "");

const SUPERLATIVES = /\b(best|leading|top[- ]rated|world[- ]class|premier|#1|number one|award[- ]winning|trusted by|life[- ]changing|cutting[- ]edge|unrivalled|unmatched|finest)\b/i;
const BRANDS = /\b(ritalin|vyvanse|concerta|dexamfetamine|ozempic|wegovy|mounjaro|saxenda|zoloft|lexapro|prozac|valium|xanax|endone|panadol|nurofen|viagra|cialis)\b/i;
const SPECIALIST = /\bspecialists?\b/i;
// A practice-name placeholder in the join form, not a claim about anyone.
const SPECIALIST_ALLOWED = new Set(["src/ui/screens/clinician/Practice.tsx"]);

describe("copy rules in screens", () => {
  it("reads at least the screens", () => expect(files.length).toBeGreaterThan(20));
  for (const f of files) {
    const name = rel(f);
    const text = words(readFileSync(f, "utf8"));
    it(`${name} has no superlatives`, () => expect(text.match(SUPERLATIVES)?.[0] ?? null).toBeNull());
    it(`${name} names no medicine brand`, () => expect(text.match(BRANDS)?.[0] ?? null).toBeNull());
    if (!SPECIALIST_ALLOWED.has(name)) it(`${name} does not call anyone a specialist`, () => expect(text.match(SPECIALIST)?.[0] ?? null).toBeNull());
  }
});
