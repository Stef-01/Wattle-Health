import { describe, expect, it } from "vitest";
import { getDoctors } from "./providers";
import { matchHealthspan } from "./healthspan-match";

describe("matchHealthspan", () => {
  it("only returns doctors with their own healthspan evidence, best first, with reasons", async () => {
    const all = await getDoctors();
    const m = matchHealthspan(all, { areas: ["metabolic", "heart"], device: "oura", bloodwork: true, telehealth: false });
    expect(m.length).toBeGreaterThan(0);
    for (const x of m) {
      expect(x.doctor.personal?.healthspan?.evidence).toBe(x.evidence);
      expect(x.evidence.length).toBeGreaterThan(10);
    }
    for (let i = 1; i < m.length; i++) expect(m[i - 1]!.score).toBeGreaterThanOrEqual(m[i]!.score);
    const wearableOk = m.filter((x) => x.doctor.personal!.healthspan!.opensTo.includes("wearables"));
    for (const x of wearableOk) expect(x.reasons).toContain("Welcomes your Oura data");
    for (const x of m.filter((y) => !y.doctor.personal!.healthspan!.opensTo.includes("wearables"))) expect(x.reasons.join()).not.toMatch(/Oura/);
  });
});
