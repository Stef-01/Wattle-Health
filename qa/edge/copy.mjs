// The copy rule as a gate (CLAUDE.md: no testimonials in marketing copy, no superlatives, "specialist" only as an
// Ahpra specialty, no medicine brand names). Reads the rendered text of every browsing route and a sample of
// doctor profiles on BASE, both modes, and exits 1 on a hit. Doctors' own published words are quoted, not
// Wattle's copy, so blockquote/quote text is excluded from the superlative check but not from the brand check.
import { chromium } from "@playwright/test";
const BASE = (process.env.BASE ?? "http://localhost:3300").replace(/\/$/, "");
const ROUTES = ["/", "/recent", "/saved", "/me", "/me/openings", "/me/discover", "/me/context", "/healthspan", "/about", "/about/coverage", "/compare", "/join", "/join/verify", "/results"];
const SUPERLATIVES = /\b(best|top[- ]rated|leading|world[- ]class|#1|number one|premier|unrivalled|unrivaled|finest|most trusted|guaranteed|cure[sd]?|miracle|revolutionary|award[- ]winning)\b/i;
// Ahpra-recognised specialties and specialist titles that may carry the word.
const SPECIALIST_OK = /\b(specialist (physician|psychiatrist|paediatrician|dermatologist|obstetrician|gynaecologist|surgeon|anaesthetist|general practitioner|GP)s?|pain medicine specialist|sexual health specialist|sports? and exercise medicine specialist|occupational and environmental medicine specialist|specialist (in )?(psychiatry|paediatrics|dermatology|obstetrics|gynaecology|general practice|anaesthesia|pain medicine|rehabilitation medicine|sexual health medicine))\b/i;
const BRANDS = /\b(Ritalin|Concerta|Vyvanse|Adderall|Strattera|Intuniv|Dexamfetamine|Prozac|Zoloft|Lexapro|Cipramil|Effexor|Pristiq|Valium|Xanax|Ozempic|Wegovy|Mounjaro|Saxenda|Duromine|Viagra|Cialis|Lyrica|Endone|OxyContin|Targin|Panadol|Nurofen|Mirena|Yaz|Yasmin|Visanne|Estrogel|Prometrium|Testogel|Androforte|Melatonin)\b/;
const browser = await chromium.launch();
const hits = [];
for (const mode of ["wattle", "adhdme"]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  await ctx.addCookies([{ name: "wattle.mode", value: mode, domain: new URL(BASE).hostname, path: "/" }]);
  const page = await ctx.newPage();
  await page.addInitScript(() => localStorage.setItem("wattle.splash.seen", "true"));
  const routes = [...ROUTES];
  if (mode === "wattle") {
    // a sample of profiles: the first eight links on Discover
    await page.goto(`${BASE}/me/discover`, { waitUntil: "networkidle" });
    const links = await page.evaluate(() => [...new Set([...document.querySelectorAll("a[href^='/doctor/']")].map((a) => a.getAttribute("href")))].slice(0, 8));
    routes.push(...links);
  }
  for (const r of routes) {
    await page.goto(`${BASE}${r}`, { waitUntil: "networkidle" }).catch(() => null);
    await page.waitForTimeout(300);
    const { copy, quoted } = await page.evaluate(() => {
      const isQuote = (el) => !!el.closest("blockquote, .text-quote, [data-quote], q");
      const nodes = [...document.querySelectorAll("main *, header *, nav *")].filter((e) => e.childElementCount === 0 && e.innerText && e.innerText.trim());
      return { copy: nodes.filter((e) => !isQuote(e)).map((e) => e.innerText.trim()).join(" \n "), quoted: nodes.filter(isQuote).map((e) => e.innerText.trim()).join(" \n ") };
    });
    const all = `${copy} \n ${quoted}`;
    const sup = copy.match(SUPERLATIVES); if (sup) hits.push(`${mode} ${r}: superlative "${sup[0]}" in: ${context(copy, sup.index)}`);
    for (const m of copy.matchAll(/\bspecialists?\b[^.\n]{0,40}/gi)) { const around = copy.slice(Math.max(0, m.index - 60), m.index + 60); if (!SPECIALIST_OK.test(around)) hits.push(`${mode} ${r}: "specialist" outside an Ahpra specialty: ${context(copy, m.index)}`); }
    const brand = all.match(BRANDS); if (brand) hits.push(`${mode} ${r}: medicine brand "${brand[0]}": ${context(all, brand.index)}`);
  }
  await ctx.close();
}
await browser.close();
function context(text, i) { return JSON.stringify(text.slice(Math.max(0, i - 50), i + 60).replace(/\s+/g, " ")); }
console.log(hits.length ? `${hits.length} copy hit(s):\n${hits.join("\n")}` : "copy: clean (superlatives, specialist, medicine brands) across both modes");
process.exit(hits.length ? 1 : 0);
