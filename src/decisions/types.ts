// The decisions loop (founder 2026-10-24). A transcript is scored against every category, each
// 0..1 with no importance weighting; a decision tree trained on the founder's case studies turns
// the scores into a decision (the tree learns which parameters matter); a second pass finds what
// the transcript says that no category covers, and a person reviews those in /admin. An approved
// candidate becomes a category, so the next transcript is scored on it and the next training
// run can split on it. No fs and no network here: server and client both import this file.

/** Where a category comes from. The yaml groups mirror disciplines/mvp.yaml; `other` is for reviewed categories that fit none. */
export const CATEGORY_GROUPS = ["condition", "population", "approach", "manner", "human_fit", "constraint", "other"] as const;
export type CategoryGroup = (typeof CATEGORY_GROUPS)[number];

export const GROUP_LABELS: Record<CategoryGroup, string> = {
  condition: "Condition",
  population: "Who it is for",
  approach: "Approach",
  manner: "Manner",
  human_fit: "Human fit",
  constraint: "Practical need",
  other: "Other",
};

export interface Category {
  /** `${group}__${id}`: the property name in the classifier's output schema and the tree's feature name. */
  key: string;
  group: CategoryGroup;
  id: string;
  label: string;
  description: string;
  /** `vocabulary` comes from disciplines/mvp.yaml (edited there); `reviewed` was approved in /admin. */
  origin: "vocabulary" | "reviewed";
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/** Category key → 0..1. Every active category has a score; nothing is weighted. */
export type Scores = Record<string, number>;

export type CandidateStatus = "pending" | "approved" | "rejected";

/** Something a transcript said that no category covers, waiting for a person. */
export interface Candidate {
  id: string;
  /** Normalised label, so the same idea proposed twice is counted once. */
  slug: string;
  label: string;
  group: CategoryGroup;
  description: string;
  /** Short quotes (under 25 words each) from the transcripts that raised it, at most five. */
  evidence: string[];
  /** How many transcripts raised it. */
  seen: number;
  status: CandidateStatus;
  /** Set on approval: the category it became. */
  categoryKey?: string;
  createdAt: string;
  updatedAt: string;
}

/** A worked example the tree learns from: what was said, and what was decided. */
export interface CaseStudy {
  id: string;
  title: string;
  /** The case as written (a meeting-note summary or a transcript). Stored server side only, never committed. */
  text: string;
  /** The decision the case reached, in the founder's words ("refer to psychiatrist", "GP assessment"...). */
  decision: string;
  source: "granola" | "manual" | "import";
  /** Where it came from: the Granola note id or title. */
  sourceRef?: string;
  /** The classifier's scores for this case, cached against `scoredWith`. */
  scores?: Scores;
  /** `${model}|${categories hash}`: scores are recomputed when either changes. */
  scoredWith?: string;
  createdAt: string;
}

export type TreeNode =
  | { kind: "leaf"; n: number; counts: Record<string, number>; label: string }
  | { kind: "split"; n: number; counts: Record<string, number>; feature: string; threshold: number; gain: number; left: TreeNode; right: TreeNode };

export interface TreeModel {
  version: number;
  trainedAt: string;
  /** The classifier model and category set the training scores came from. */
  scoredWith: string;
  features: string[];
  labels: string[];
  root: TreeNode;
  /** Feature → share of the total impurity reduction (sums to 1 when the tree has a split). */
  importance: Record<string, number>;
  /** Case studies the tree saw, and how many it gets right with each one left out in turn. */
  cases: number;
  trainingAccuracy: number;
  leaveOneOutAccuracy: number | null;
  params: { maxDepth: number; minLeaf: number };
}

export interface DecisionResult {
  decision: string | null;
  /** Share of the training cases in the leaf that reached this decision. */
  confidence: number;
  /** The splits taken, in words: "ADHD ≥ 0.55", "Prefers telehealth < 0.30". */
  path: string[];
  leaf: Record<string, number>;
}

/** "Lived experience!" → "lived-experience". */
export function slugOf(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function keyOf(group: CategoryGroup, id: string): string {
  return `${group}__${id.replace(/[^a-z0-9_-]/gi, "_")}`;
}
