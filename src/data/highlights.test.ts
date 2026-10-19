// Highlights are ranked on the server per request: what the person asked for first, never invented.
import { describe, expect, it } from "vitest";
import { buildRoster, mvpDiscipline } from "./providers";
import { searchWith } from "./search-core";
import { applyRefine, readRefine } from "@/src/ui/screens/patient-a/Refine";

describe("highlights", () => {
  const roster = buildRoster();
  const disc = mvpDiscipline();

  it("every card carries highlights, matched ones first, no duplicate labels", () => {
    const r = searchWith(roster, disc, { sentence: "Endometriosis, someone who really listens", suburb: "Brisbane" });
    expect(r.cards.length).toBeGreaterThan(0);
    for (const c of r.cards) {
      const h = c.highlights ?? [];
      expect(h.length).toBeGreaterThan(0);
      expect(new Set(h.map((x) => x.label)).size).toBe(h.length);
      const firstUnmatched = h.findIndex((x) => !x.matched);
      if (firstUnmatched >= 0) expect(h.slice(firstUnmatched).every((x) => !x.matched)).toBe(true);
      expect(h[0]!.label).toMatch(/endometriosis/i);
    }
  });

  it("a personal line is present for doctors with a published profile", () => {
    const r = searchWith(roster, disc, { sentence: "Menopause, longer appointments", suburb: "Brisbane" });
    const withHobbies = r.cards.filter((c) => c.doctor.personal?.hobbies);
    for (const c of withHobbies) expect(c.highlights?.some((h) => h.kind === "personal")).toBe(true);
  });
});

describe("refine", () => {
  it("round-trips switches through the sentence", () => {
    const s = applyRefine("Endometriosis, someone who listens", { telehealth: true, anywhere: false, woman: true, child: false });
    expect(s).toBe("Endometriosis, someone who listens, telehealth only, a woman doctor");
    expect(readRefine(s, false)).toEqual({ telehealth: true, anywhere: false, woman: true, child: false });
    expect(applyRefine(s, { telehealth: false, anywhere: false, woman: false, child: false })).toBe("Endometriosis, someone who listens");
  });

  it("a woman doctor reaches the matcher as a gender preference", () => {
    const r = searchWith(buildRoster(), mvpDiscipline(), { sentence: "Endometriosis, a woman doctor", suburb: "Brisbane" });
    expect(r.chips.some((c) => /woman/i.test(c.label))).toBe(true);
  });
});
