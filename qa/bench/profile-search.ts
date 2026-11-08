import { getDoctors, mvpDiscipline } from "../../src/data/providers";
import { searchWith } from "../../src/data/search-core";
(async () => { const docs = await getDoctors();
const disc = mvpDiscipline();
for (const s of ["ADHD, lived experience", "Menopause, longer appointments", "Endometriosis, someone who listens", "ADHD, lived experience"]) {
  const t = performance.now();
  const r = searchWith(docs, disc, { sentence: s });
  console.log("searchWith", JSON.stringify(s), Math.round(performance.now() - t), "ms", r.cards.length);
}
})();
