import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { evaluate, fit, predict, rules, type Row } from "./tree";

const names = ["condition__adhd", "approach__medication-led", "constraint__telehealth_preferred"];
const rows: Row[] = [
  { features: [0.9, 0.9, 0.1], label: "psychiatrist" },
  { features: [0.8, 0.8, 0.2], label: "psychiatrist" },
  { features: [0.9, 0.1, 0.2], label: "psychologist" },
  { features: [0.85, 0.05, 0.9], label: "psychologist" },
  { features: [0.1, 0.1, 0.1], label: "gp" },
  { features: [0.05, 0.2, 0.3], label: "gp" },
];

describe("decision tree", () => {
  it("separates the cases on the parameters that matter, and says which those are", () => {
    const { root, importance } = fit(rows, names);
    const at = (f: number[]) => predict({ root }, Object.fromEntries(names.map((n, i) => [n, f[i]!]))).decision;
    expect(at([0.9, 0.9, 0.1])).toBe("psychiatrist");
    expect(at([0.9, 0.1, 0.1])).toBe("psychologist");
    expect(at([0.1, 0.1, 0.1])).toBe("gp");
    expect(Object.keys(importance).sort()).toEqual(["approach__medication-led", "condition__adhd"]);
    expect(Object.values(importance).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 2);
  });

  it("is deterministic", () => {
    expect(JSON.stringify(fit(rows, names))).toBe(JSON.stringify(fit([...rows], [...names])));
  });

  it("reads out as one rule per leaf, covering every case", () => {
    const { root } = fit(rows, names);
    const r = rules(root);
    expect(r.reduce((a, b) => a + b.n, 0)).toBe(rows.length);
    for (const rule of r) expect(rule.purity).toBe(1);
  });

  it("reports leave-one-out accuracy, and none below three cases", () => {
    expect(evaluate(rows, names).training).toBe(1);
    expect(evaluate(rows, names).leaveOneOut).not.toBeNull();
    expect(evaluate(rows.slice(0, 2), names).leaveOneOut).toBeNull();
  });

  it("always answers with a label it was trained on, for any scores", () => {
    const { root } = fit(rows, names);
    const labels = new Set(rows.map((r) => r.label));
    fc.assert(
      fc.property(fc.array(fc.double({ min: 0, max: 1, noNaN: true }), { minLength: 3, maxLength: 3 }), (f) => {
        const res = predict({ root }, Object.fromEntries(names.map((n, i) => [n, f[i]!])));
        expect(labels.has(res.decision!)).toBe(true);
        expect(res.confidence).toBeGreaterThan(0);
        expect(res.confidence).toBeLessThanOrEqual(1);
      }),
    );
  });
});
