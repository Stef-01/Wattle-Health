// A CART decision tree over the classifier's 0..1 scores, trained on the case studies. Pure and
// deterministic (no randomness, ties broken by feature order then threshold), so the same cases
// and scores always give the same tree. Gini impurity; thresholds at midpoints between the values
// the cases actually took. Small on purpose: a few dozen case studies support a shallow tree, and
// a shallow tree can be read out as rules in the admin dashboard.
import type { DecisionResult, Scores, TreeModel, TreeNode } from "./types";

export interface Row {
  features: number[];
  label: string;
}

const gini = (counts: Record<string, number>, n: number): number => {
  if (n === 0) return 0;
  let s = 0;
  for (const c of Object.values(counts)) s += (c / n) ** 2;
  return 1 - s;
};

function countsOf(rows: readonly Row[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) out[r.label] = (out[r.label] ?? 0) + 1;
  return out;
}

/** The majority label; ties go to the label that sorts first, so training is deterministic. */
function majority(counts: Record<string, number>): string {
  return Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? "";
}

function leaf(rows: readonly Row[]): TreeNode {
  const counts = countsOf(rows);
  return { kind: "leaf", n: rows.length, counts, label: majority(counts) };
}

function grow(rows: readonly Row[], names: readonly string[], depth: number, maxDepth: number, minLeaf: number, gains: number[]): TreeNode {
  const counts = countsOf(rows);
  const n = rows.length;
  const parent = gini(counts, n);
  if (depth >= maxDepth || parent === 0 || n < 2 * minLeaf) return leaf(rows);
  let best: { f: number; t: number; gain: number } | null = null;
  for (let f = 0; f < names.length; f++) {
    const values = [...new Set(rows.map((r) => r.features[f]!))].sort((a, b) => a - b);
    for (let i = 0; i + 1 < values.length; i++) {
      const t = (values[i]! + values[i + 1]!) / 2;
      const left = rows.filter((r) => r.features[f]! <= t);
      const right = rows.filter((r) => r.features[f]! > t);
      if (left.length < minLeaf || right.length < minLeaf) continue;
      const gain = parent - (left.length / n) * gini(countsOf(left), left.length) - (right.length / n) * gini(countsOf(right), right.length);
      if (!best || gain > best.gain + 1e-12) best = { f, t, gain };
    }
  }
  if (!best || best.gain <= 1e-9) return leaf(rows);
  gains[best.f]! += best.gain * n;
  const left = rows.filter((r) => r.features[best.f]! <= best.t);
  const right = rows.filter((r) => r.features[best.f]! > best.t);
  return {
    kind: "split",
    n,
    counts,
    feature: names[best.f]!,
    threshold: Math.round(best.t * 1000) / 1000,
    gain: Math.round(best.gain * 10000) / 10000,
    left: grow(left, names, depth + 1, maxDepth, minLeaf, gains),
    right: grow(right, names, depth + 1, maxDepth, minLeaf, gains),
  };
}

export function fit(rows: readonly Row[], names: readonly string[], params = { maxDepth: 4, minLeaf: 1 }): { root: TreeNode; importance: Record<string, number> } {
  const gains = names.map(() => 0);
  const root = rows.length ? grow(rows, names, 0, params.maxDepth, params.minLeaf, gains) : { kind: "leaf" as const, n: 0, counts: {}, label: "" };
  const total = gains.reduce((a, b) => a + b, 0);
  const importance: Record<string, number> = {};
  names.forEach((name, i) => {
    if (gains[i]! > 0) importance[name] = Math.round((gains[i]! / total) * 1000) / 1000;
  });
  return { root, importance };
}

function walk(root: TreeNode, scores: Scores, label: (feature: string) => string): DecisionResult {
  const path: string[] = [];
  let node = root;
  while (node.kind === "split") {
    const v = scores[node.feature] ?? 0;
    const goLeft = v <= node.threshold;
    path.push(`${label(node.feature)} ${goLeft ? "≤" : ">"} ${node.threshold.toFixed(2)}`);
    node = goLeft ? node.left : node.right;
  }
  const confidence = node.n ? (node.counts[node.label] ?? 0) / node.n : 0;
  return { decision: node.label || null, confidence: Math.round(confidence * 100) / 100, path, leaf: node.counts };
}

export function predict(model: Pick<TreeModel, "root">, scores: Scores, label: (feature: string) => string = (f) => f): DecisionResult {
  return walk(model.root, scores, label);
}

/** Train on the rows, then score each case with it held out. Null below three cases (nothing to hold out against). */
export function evaluate(rows: readonly Row[], names: readonly string[], params = { maxDepth: 4, minLeaf: 1 }): { training: number; leaveOneOut: number | null } {
  if (rows.length === 0) return { training: 0, leaveOneOut: null };
  const asScores = (r: Row): Scores => Object.fromEntries(names.map((n, i) => [n, r.features[i]!]));
  const { root } = fit(rows, names, params);
  const training = rows.filter((r) => walk(root, asScores(r), (f) => f).decision === r.label).length / rows.length;
  if (rows.length < 3) return { training, leaveOneOut: null };
  let right = 0;
  rows.forEach((held, i) => {
    const rest = rows.filter((_, j) => j !== i);
    const m = fit(rest, names, params);
    if (walk(m.root, asScores(held), (f) => f).decision === held.label) right += 1;
  });
  return { training: Math.round(training * 1000) / 1000, leaveOneOut: Math.round((right / rows.length) * 1000) / 1000 };
}

/** The tree as rules, one per leaf, for the dashboard. */
export function rules(root: TreeNode, label: (feature: string) => string = (f) => f): { when: string[]; then: string; n: number; purity: number }[] {
  const out: { when: string[]; then: string; n: number; purity: number }[] = [];
  const go = (node: TreeNode, when: string[]) => {
    if (node.kind === "leaf") {
      out.push({ when, then: node.label, n: node.n, purity: node.n ? Math.round(((node.counts[node.label] ?? 0) / node.n) * 100) / 100 : 0 });
      return;
    }
    go(node.left, [...when, `${label(node.feature)} ≤ ${node.threshold.toFixed(2)}`]);
    go(node.right, [...when, `${label(node.feature)} > ${node.threshold.toFixed(2)}`]);
  };
  go(root, []);
  return out;
}
