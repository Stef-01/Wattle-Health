// The loop end to end with the model stubbed (no network in tests): a transcript is scored on
// every category, an uncovered idea is queued once however often it comes up, approving it makes
// it a category the next scoring includes, and training re-scores the cases and decides with it.
import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.DECISIONS_STORE = "memory";

vi.mock("./openai", () => {
  class DecisionsUnavailable extends Error {}
  return {
    DecisionsUnavailable,
    openaiModel: () => "stub-model",
    openaiConfigured: () => true,
    // Scores 0.9 when a category's label appears in the text, else 0.05. Finds "school refusal" when it is mentioned.
    structured: vi.fn(async (name: string, schema: { required?: string[]; properties?: Record<string, { description?: string }> }, _dev: string, user: string) => {
      const text = user.toLowerCase();
      if (name === "category_scores") {
        return Object.fromEntries((schema.required ?? []).map((k) => {
          const label = (schema.properties?.[k]?.description ?? "").split(":")[0]!.toLowerCase();
          return [k, label && text.includes(label) ? 0.9 : 0.05];
        }));
      }
      return { candidates: text.includes("school refusal") ? [{ label: "School refusal", group: "other", description: "Won't go to school.", evidence: "he won't go to school at all" }] : [] };
    }),
  };
});

const engine = await import("./engine");

describe("decisions loop", () => {
  beforeEach(async () => {
    const store = await import("./store");
    for (const col of ["candidates", "categories", "cases", "models", "runs"] as const) for (const d of await store.list(col)) await store.remove(col, d.id);
  });

  it("scores every active category, each 0..1", async () => {
    const res = await engine.classify("ADHD, and telehealth would help", { discover: false });
    const cats = await engine.activeCategories();
    expect(Object.keys(res.scores).sort()).toEqual(cats.map((c) => c.key).sort());
    for (const v of Object.values(res.scores)) expect(v >= 0 && v <= 1).toBe(true);
    expect(res.scores.condition__adhd).toBe(0.9);
    expect(res.decision).toBeNull();
  });

  it("queues an uncovered idea once, counts it, and never re-proposes an existing category", async () => {
    await engine.classify("ADHD and school refusal for weeks");
    await engine.classify("school refusal again this term");
    const queue = await engine.listCandidates();
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({ label: "School refusal", seen: 2, status: "pending" });
    const found = await engine.queueCandidates([{ label: "ADHD", group: "condition", description: "dup", evidence: "" }], await engine.activeCategories());
    expect(found.created).toHaveLength(0);
  });

  it("approval feeds back: the reviewed category is scored next time and the tree can split on it", async () => {
    await engine.classify("school refusal");
    const [cand] = await engine.listCandidates();
    const { category } = await engine.reviewCandidate(cand!.id, { action: "approve", label: "School refusal", description: "A child who will not attend school.", group: "population" });
    expect(category?.key).toBe("population__school-refusal");
    expect((await engine.activeCategories()).some((c) => c.key === category!.key)).toBe(true);

    await engine.addCases([
      { title: "A", text: "ADHD, school refusal, nine year old", decision: "Child psychologist" },
      { title: "B", text: "ADHD, school refusal", decision: "Child psychologist" },
      { title: "C", text: "ADHD, wants it looked at properly", decision: "GP assessment" },
      { title: "D", text: "ADHD, assessment please", decision: "GP assessment" },
    ]);
    const model = await engine.train();
    expect(model.cases).toBe(4);
    expect(model.trainingAccuracy).toBe(1);
    expect(Object.keys(model.importance)).toContain("population__school-refusal");
    const res = await engine.classify("my son has school refusal and maybe ADHD", { discover: false });
    expect(res.decision).toMatchObject({ decision: "Child psychologist", stale: false });
    expect(res.decision!.path.join(" ")).toMatch(/School refusal/);
  });

  it("a rejected idea stays rejected when it comes up again", async () => {
    await engine.classify("school refusal");
    const [cand] = await engine.listCandidates();
    await engine.reviewCandidate(cand!.id, { action: "reject" });
    await engine.classify("school refusal");
    const [again] = await engine.listCandidates();
    expect(again).toMatchObject({ status: "rejected", seen: 2 });
  });
});
