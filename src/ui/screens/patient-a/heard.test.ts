// The "You searched" line says each wish once (2026-11-08: it read "a doctor with longer appointment and with long appointments").
import { describe, expect, it } from "vitest";
import { heardSentence } from "./Matches";

const req = (chips: Array<{ kind: string; label: string }>, extra: Record<string, unknown> = {}) =>
  ({ id: "r", at: "", sentence: "menopause, longer appointments", suburb: "", v: 1, response: { chips, place: {}, cards: [] }, ...extra }) as never;

describe("heardSentence", () => {
  it("merges two chips for one wish", () => {
    const s = heardSentence(req([{ kind: "condition", label: "Menopause and perimenopause" }, { kind: "preference", label: "longer appointment" }, { kind: "personal", label: "long appointments" }]));
    expect(s).toBe("Menopause and perimenopause, a doctor with longer appointment.");
  });
  it("keeps wishes that differ", () => {
    const s = heardSentence(req([{ kind: "condition", label: "ADHD" }, { kind: "personal", label: "lived experience" }, { kind: "personal", label: "listens" }]));
    expect(s).toBe("ADHD, a doctor with lived experience and who listens.");
  });
  it("names no place when none was given", () => {
    expect(heardSentence(req([{ kind: "condition", label: "ADHD" }]))).toBe("ADHD.");
  });
});
