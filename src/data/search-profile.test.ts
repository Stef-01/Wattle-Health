// Not a gate: skipped unless PROFILE=1. Times getDoctors and three searches on the full roster.
// Run: PROFILE=1 pnpm exec vitest run src/data/search-profile.test.ts (a CPU profile: bundle qa/bench/profile-search.ts with esbuild --format=cjs and run node --cpu-prof).
import { it } from "vitest";
import { getDoctors, mvpDiscipline } from "./providers";
import { searchWith } from "./search-core";

it.skipIf(!process.env.PROFILE)("profiles a search", async () => {
  let t = performance.now();
  const docs = await getDoctors();
  console.log("getDoctors", Math.round(performance.now() - t), "ms", docs.length, "doctors");
  const disc = mvpDiscipline();
  for (const s of ["ADHD, lived experience", "Menopause, longer appointments", "ADHD, lived experience"]) {
    t = performance.now();
    const r = searchWith(docs, disc, { sentence: s });
    console.log("searchWith", JSON.stringify(s), Math.round(performance.now() - t), "ms", r.cards.length, "cards");
  }
}, 120000);
