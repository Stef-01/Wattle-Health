import { describe, expect, it } from "vitest";
import { getDoctors } from "./providers";
import { demoReviewsFor } from "./demo-reviews";
import { reviewCommentary, reviewThemes } from "./review-themes";

describe("demo reviews", () => {
  it("are deterministic, flagged demo, 4-9 per published doctor, none for others", async () => {
    const all = await getDoctors();
    const published = all.filter((d) => d.personal && d.personal.status !== "draft");
    expect(published.length).toBeGreaterThan(0);
    for (const d of published) {
      const a = demoReviewsFor(d);
      expect(a).toEqual(demoReviewsFor(d));
      expect(a.length).toBeGreaterThanOrEqual(4);
      expect(a.length).toBeLessThanOrEqual(9);
      for (const r of a) {
        expect(r.demo).toBe(true);
        expect(r.rating).toBeGreaterThanOrEqual(4);
        expect(r.body).not.toMatch(/cured|fixed my|best doctor/i);
      }
    }
    const plain = all.find((d) => !d.personal);
    if (plain) expect(demoReviewsFor(plain)).toEqual([]);
  });
});

describe("review commentary", () => {
  it("only names themes the reviews mention, with counts", () => {
    const rows = [
      { rating: 5, body: "They listened and explained things clearly." },
      { rating: 5, body: "Really listened to me." },
      { rating: 4, body: "Telehealth from home was easy." },
    ];
    const themes = reviewThemes(rows);
    expect(themes[0]).toMatchObject({ id: "listens", count: 2 });
    expect(themes.find((t) => t.id === "warm")).toBeUndefined();
    expect(reviewCommentary(rows, "Dr Erin Wilson")).toMatch(/^Most reviewers say Dr Erin Wilson listens properly/);
    expect(reviewCommentary([], "Dr X")).toBeNull();
  });
});
