import { describe, expect, it } from "vitest";
import { AREAS, EXAMPLES, readHealthspan } from "./healthspan";

describe("readHealthspan", () => {
  it("reads areas from the sentence", () => {
    expect(readHealthspan("My dad had a heart attack at 55").map((a) => a.id)).toEqual(["heart"]);
    expect(readHealthspan("Sleep better and stop crashing").map((a) => a.id)).toContain("sleep");
    expect(readHealthspan("Get ahead of perimenopause").map((a) => a.id)).toEqual(["hormones"]);
  });
  it("falls back to heart, fitness and metabolism for a vague goal", () => {
    expect(readHealthspan("live longer").map((a) => a.id)).toEqual(["heart", "fitness", "metabolic"]);
  });
  it("every example finds at least one area, every area has measures and a category", () => {
    for (const e of EXAMPLES) expect(readHealthspan(e).length).toBeGreaterThan(0);
    for (const a of AREAS) {
      expect(a.measure.length).toBeGreaterThan(0);
      expect(a.categories.length).toBeGreaterThan(0);
    }
  });
});
