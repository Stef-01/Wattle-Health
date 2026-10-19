import { describe, expect, it } from "vitest";
import { completeness, deprioritiseThin, isThin } from "./completeness";
import { getDoctors } from "./providers";

describe("completeness and deprioritising thin profiles", () => {
  it("scores 0 to 1 and gives one question per gap", async () => {
    for (const d of (await getDoctors()).slice(0, 200)) {
      const c = completeness(d);
      expect(c.score).toBeGreaterThanOrEqual(0);
      expect(c.score).toBeLessThanOrEqual(1);
      expect(new Set(c.missing.map((m) => m.question)).size).toBe(c.missing.length);
    }
  });

  it("only reorders inside a clinical band, and puts thin after full there", async () => {
    const all = await getDoctors();
    const thin = all.filter(isThin).slice(0, 3);
    const full = all.filter((d) => !isThin(d)).slice(0, 3);
    const cards = [
      { doctor: thin[0]!, clinicalFit: { band: "strong" } },
      { doctor: full[0]!, clinicalFit: { band: "strong" } },
      { doctor: thin[1]!, clinicalFit: { band: "listed" } },
      { doctor: full[1]!, clinicalFit: { band: "listed" } },
    ];
    const out = deprioritiseThin(cards);
    expect(out.map((c) => c.clinicalFit.band)).toEqual(["strong", "strong", "listed", "listed"]);
    expect(out.map((c) => c.doctor.id)).toEqual([full[0]!.id, thin[0]!.id, full[1]!.id, thin[1]!.id]);
    expect(deprioritiseThin(out)).toEqual(out);
  });
});
