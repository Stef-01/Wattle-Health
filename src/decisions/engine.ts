// The decisions loop, server side (founder 2026-10-24).
//
//   classify(transcript)
//     1. score   every active category 0..1 (one strict-schema call; every key required, so
//                every parameter is scored, and none is weighted: the tree decides what matters)
//     2. decide  the current tree reads the scores and returns a decision and the rule it took
//     3. find    a second call reads the same transcript for what no category covers; each
//                new idea joins the review queue (and the external webhook, when one is set)
//   review in /admin (or PATCH /api/decisions/candidates/:id from an external validator)
//     approve    the candidate becomes a category: the next transcript is scored on it
//   train()
//     re-scores any case study scored under an older category set, then fits the tree, so an
//     approved category becomes something the tree can split on
//
// The transcript is sent to OpenAI (store: false) and never stored here: a run keeps its SHA-256,
// its length and the outcome. Candidate evidence is a short quote, capped, for the reviewer.
import { createHash } from "node:crypto";
import { mvpDiscipline } from "@/src/data/providers";
import { DecisionsUnavailable, openaiModel, structured } from "./openai";
import { get, list, newId, put, remove } from "./store";
import { evaluate, fit, predict, type Row } from "./tree";
import { CATEGORY_GROUPS, keyOf, slugOf, type Candidate, type CaseStudy, type Category, type CategoryGroup, type DecisionResult, type Scores, type TreeModel } from "./types";
import { vocabularyCategories } from "./vocabulary";

export { DecisionsUnavailable };

const MAX_TRANSCRIPT = 40_000;
const MAX_EVIDENCE = 5;
const TREE_PARAMS = { maxDepth: 4, minLeaf: 1 };

/* ------------------------------------------------------------- categories */

export async function allCategories(): Promise<Category[]> {
  const base = vocabularyCategories(mvpDiscipline());
  const keys = new Set(base.map((c) => c.key));
  const reviewed = (await list<Category & { id: string }>("categories")).filter((c) => !keys.has(c.key));
  return [...base, ...reviewed.sort((a, b) => a.label.localeCompare(b.label))];
}

export async function activeCategories(): Promise<Category[]> {
  return (await allCategories()).filter((c) => c.active);
}

/** Short hash of the active category keys: case scores are recomputed when it changes. */
export function categoriesHash(categories: readonly Category[]): string {
  return createHash("sha256").update(categories.map((c) => c.key).sort().join("|")).digest("hex").slice(0, 12);
}

export function scoredWithKey(categories: readonly Category[]): string {
  return `${openaiModel()}|${categoriesHash(categories)}`;
}

export async function updateCategory(key: string, patch: { label?: string; description?: string; active?: boolean }): Promise<Category> {
  const existing = (await list<Category & { id: string }>("categories")).find((c) => c.key === key);
  if (!existing) throw new Error("Only reviewed categories are edited here; vocabulary categories live in disciplines/mvp.yaml.");
  const next: Category & { id: string } = {
    ...existing,
    ...(patch.label?.trim() ? { label: patch.label.trim() } : {}),
    ...(typeof patch.description === "string" ? { description: patch.description.trim() } : {}),
    ...(typeof patch.active === "boolean" ? { active: patch.active } : {}),
    updatedAt: new Date().toISOString(),
  };
  return put("categories", next);
}

/* ------------------------------------------------------------- scoring */

const clamp = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.round(Math.min(1, Math.max(0, v)) * 100) / 100 : 0);

const SCORE_BRIEF = `You score a transcript from an Australian health-access service against a fixed list of categories.
For EVERY category, return how strongly the transcript supports it, from 0 to 1:
0 = absent or contradicted; 0.2-0.4 = hinted at; 0.5-0.7 = stated but not central; 0.8-1 = explicit and central.
Use the full range; do not round to 0 or 1 unless the evidence is that clear. Score what the transcript says, not what is usual.
A refusal ("not medication") scores that category 0. Treat every category independently: none is more important than another.`;

export async function scoreTranscript(text: string, categories: readonly Category[]): Promise<Scores> {
  const properties = Object.fromEntries(categories.map((c) => [c.key, { type: "number", description: `${c.label}: ${c.description}`.slice(0, 300) }]));
  const schema = { type: "object", additionalProperties: false, required: categories.map((c) => c.key), properties };
  const catalogue = categories.map((c) => `- ${c.key} — ${c.label}: ${c.description}`).join("\n");
  const raw = await structured<Record<string, unknown>>("category_scores", schema, `${SCORE_BRIEF}\n\nCategories:\n${catalogue}`, text.slice(0, MAX_TRANSCRIPT));
  return Object.fromEntries(categories.map((c) => [c.key, clamp(raw[c.key])]));
}

/* ------------------------------------------------------------- out-of-category pass */

const FIND_BRIEF = `You read a transcript from an Australian health-access service and list what it says that the existing categories do NOT cover.
Only propose a candidate when it is clearly present, would help decide what care or support someone needs, and is not a synonym, subset or rewording of an existing category.
Name each candidate as a short, reusable category (2-5 words) that could apply to other people, never to this person. Give a one-sentence description of what the category means.
"evidence" is the shortest quote from the transcript that shows it, under 25 words, with names and other identifying details removed.
Return an empty list when everything is covered. At most 6 candidates.`;

type Found = { label: string; group: CategoryGroup; description: string; evidence: string };

export async function findCandidates(text: string, categories: readonly Category[]): Promise<Found[]> {
  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["candidates"],
    properties: {
      candidates: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["label", "group", "description", "evidence"],
          properties: {
            label: { type: "string" },
            group: { type: "string", enum: [...CATEGORY_GROUPS] },
            description: { type: "string" },
            evidence: { type: "string" },
          },
        },
      },
    },
  };
  const existing = categories.map((c) => `- ${c.label} (${c.group}): ${c.description}`).join("\n");
  const out = await structured<{ candidates: Found[] }>("new_categories", schema, `${FIND_BRIEF}\n\nExisting categories:\n${existing}`, text.slice(0, MAX_TRANSCRIPT));
  return (out.candidates ?? []).slice(0, 6);
}

const words = (s: string, n: number) => s.trim().split(/\s+/).slice(0, n).join(" ");

/** Merge what the model found into the queue: one candidate per idea, however often it is raised. */
export async function queueCandidates(found: readonly Found[], categories: readonly Category[]): Promise<{ touched: Candidate[]; created: Candidate[] }> {
  const taken = new Set(categories.flatMap((c) => [slugOf(c.label), slugOf(c.id)]));
  const queue = await list<Candidate & { id: string }>("candidates");
  const bySlug = new Map(queue.map((c) => [c.slug, c]));
  const now = new Date().toISOString();
  const touched: Candidate[] = [];
  const created: Candidate[] = [];
  for (const f of found) {
    const slug = slugOf(f.label);
    if (!slug || taken.has(slug)) continue;
    const evidence = words(f.evidence ?? "", 25);
    const prior = bySlug.get(slug);
    if (prior) {
      const next: Candidate & { id: string } = { ...prior, seen: prior.seen + 1, evidence: evidence && !prior.evidence.includes(evidence) ? [...prior.evidence, evidence].slice(-MAX_EVIDENCE) : prior.evidence, updatedAt: now };
      touched.push(await put("candidates", next));
      continue;
    }
    const group: CategoryGroup = (CATEGORY_GROUPS as readonly string[]).includes(f.group) ? f.group : "other";
    const fresh: Candidate & { id: string } = { id: newId("cand"), slug, label: f.label.trim(), group, description: f.description.trim(), evidence: evidence ? [evidence] : [], seen: 1, status: "pending", createdAt: now, updatedAt: now };
    bySlug.set(slug, fresh);
    created.push(await put("candidates", fresh));
    touched.push(fresh);
  }
  if (created.length) void notifyReviewers(created);
  return { touched, created };
}

/**
 * The external validation hook: new candidates are POSTed to DECISIONS_REVIEW_WEBHOOK_URL (with a
 * bearer token when DECISIONS_REVIEW_WEBHOOK_TOKEN is set). The validator answers by PATCHing
 * /api/decisions/candidates/:id with DECISIONS_API_KEY, the same call /admin makes.
 */
async function notifyReviewers(created: readonly Candidate[]): Promise<void> {
  const url = process.env.DECISIONS_REVIEW_WEBHOOK_URL?.trim();
  if (!url) return;
  const token = process.env.DECISIONS_REVIEW_WEBHOOK_TOKEN?.trim();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "https://wattlehealth.vercel.app";
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({
        event: "candidates.created",
        review_url: `${origin}/admin/review`,
        respond: { method: "PATCH", url: `${origin}/api/decisions/candidates/{id}`, body: { action: "approve | reject | update", label: "string", description: "string", group: CATEGORY_GROUPS } },
        candidates: created.map((c) => ({ id: c.id, label: c.label, group: c.group, description: c.description, evidence: c.evidence })),
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    // The queue in /admin is the record; a webhook that is down loses nothing.
  }
}

/* ------------------------------------------------------------- review */

export async function listCandidates(): Promise<Candidate[]> {
  const all = await list<Candidate & { id: string }>("candidates");
  const order = { pending: 0, approved: 1, rejected: 2 } as const;
  return all.sort((a, b) => order[a.status] - order[b.status] || b.seen - a.seen || b.updatedAt.localeCompare(a.updatedAt));
}

export async function reviewCandidate(id: string, input: { action: "approve" | "reject" | "update"; label?: string; description?: string; group?: string }): Promise<{ candidate: Candidate; category?: Category }> {
  const c = await get<Candidate & { id: string }>("candidates", id);
  if (!c) throw new Error("No such candidate");
  const now = new Date().toISOString();
  const group: CategoryGroup = input.group && (CATEGORY_GROUPS as readonly string[]).includes(input.group) ? (input.group as CategoryGroup) : c.group;
  const label = input.label?.trim() || c.label;
  const description = typeof input.description === "string" ? input.description.trim() : c.description;
  if (input.action === "reject") return { candidate: await put<Candidate & { id: string }>("candidates", { ...c, label, description, group, status: "rejected", updatedAt: now }) };
  if (input.action === "update") return { candidate: await put<Candidate & { id: string }>("candidates", { ...c, label, description, group, slug: slugOf(label) || c.slug, updatedAt: now }) };
  const id2 = slugOf(label);
  if (!id2) throw new Error("A category needs a name");
  const key = keyOf(group, id2);
  const clash = (await allCategories()).find((x) => x.key === key || slugOf(x.label) === id2);
  if (clash && clash.origin === "vocabulary") throw new Error(`“${label}” is already a category (${clash.label}).`);
  const category: Category & { id: string } = { key, group, id: id2, label, description: description || label, origin: "reviewed", active: true, createdAt: now, updatedAt: now };
  // Stored under its key, so a later approval of the same idea updates it rather than duplicating it.
  await put<Category & { id: string }>("categories", { ...category, id: key });
  return { candidate: await put<Candidate & { id: string }>("candidates", { ...c, label, description, group, status: "approved", categoryKey: key, updatedAt: now }), category };
}

/* ------------------------------------------------------------- case studies and training */

export async function listCases(): Promise<CaseStudy[]> {
  return (await list<CaseStudy & { id: string }>("cases")).sort((a, b) => a.title.localeCompare(b.title));
}

export async function addCases(input: readonly { title: string; text: string; decision: string; source?: CaseStudy["source"]; sourceRef?: string }[]): Promise<CaseStudy[]> {
  const existing = await listCases();
  const out: CaseStudy[] = [];
  for (const c of input) {
    if (!c.text?.trim() || !c.decision?.trim()) continue;
    const same = existing.find((e) => (c.sourceRef && e.sourceRef === c.sourceRef) || e.title === c.title.trim());
    const doc: CaseStudy & { id: string } = {
      id: same?.id ?? newId("case"),
      title: c.title.trim() || "Untitled case",
      text: c.text.trim(),
      decision: c.decision.trim(),
      source: c.source ?? "manual",
      ...(c.sourceRef ? { sourceRef: c.sourceRef } : {}),
      // Text changed: the cached scores no longer describe it.
      ...(same && same.text === c.text.trim() && same.scores ? { scores: same.scores, scoredWith: same.scoredWith } : {}),
      createdAt: same?.createdAt ?? new Date().toISOString(),
    };
    out.push(await put("cases", doc));
  }
  return out;
}

const EXTRACT_BRIEF = `You read meeting notes from an Australian health-access team and pull out every case study in them: a specific person's situation that the team discussed and reached a decision on.
For each case return:
- "title": 3-8 words naming the situation, with no names or identifying details;
- "text": the situation as the notes describe it (presentation, history, needs, constraints, preferences), in plain sentences, with names, ages-at-birthdate, places of work and any other identifying detail removed. Do NOT include the decision or the outcome in "text": the text is what the team knew before deciding;
- "decision": the decision the team reached, as a short reusable label (2-6 words, e.g. "Psychiatrist referral", "GP ADHD assessment", "ADHD coach"). When one of the existing decision labels fits, use it exactly.
Leave out anything that is not a case with a decision. Return an empty list when there is none.`;

export type ExtractedCase = { title: string; text: string; decision: string };

/** Meeting notes → draft case studies for a person to check before they are saved. Nothing is stored here. */
export async function extractCases(notes: string): Promise<ExtractedCase[]> {
  const labels = [...new Set((await listCases()).map((c) => c.decision))].sort();
  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["cases"],
    properties: {
      cases: {
        type: "array",
        items: { type: "object", additionalProperties: false, required: ["title", "text", "decision"], properties: { title: { type: "string" }, text: { type: "string" }, decision: { type: "string" } } },
      },
    },
  };
  const out = await structured<{ cases: ExtractedCase[] }>("case_studies", schema, `${EXTRACT_BRIEF}\n\nExisting decision labels: ${labels.length ? labels.join("; ") : "none yet"}`, notes.slice(0, MAX_TRANSCRIPT));
  return (out.cases ?? []).filter((c) => c.text?.trim() && c.decision?.trim()).slice(0, 40);
}

export async function removeCase(id: string): Promise<void> {
  await remove("cases", id);
}

export async function currentModel(): Promise<TreeModel | null> {
  return (await get<TreeModel & { id: string }>("models", "current")) ?? null;
}

/** Score every case not yet scored on the current categories, then fit and evaluate the tree. */
export async function train(onProgress?: (done: number, total: number) => void): Promise<TreeModel> {
  const categories = await activeCategories();
  const scoredWith = scoredWithKey(categories);
  const cases = await listCases();
  if (cases.length === 0) throw new Error("No case studies yet. Add some on /admin/cases first.");
  // Four at a time: a retrain re-scores every case after a category is approved.
  let done = 0;
  const stale = cases.filter((c) => c.scoredWith !== scoredWith || !c.scores);
  for (let i = 0; i < stale.length; i += 4) {
    await Promise.all(
      stale.slice(i, i + 4).map(async (c) => {
        const scores = await scoreTranscript(c.text, categories);
        await put<CaseStudy & { id: string }>("cases", { ...c, scores, scoredWith });
        c.scores = scores;
        c.scoredWith = scoredWith;
        onProgress?.(++done, stale.length);
      }),
    );
  }
  const features = categories.map((c) => c.key);
  const rows: Row[] = cases.map((c) => ({ features: features.map((f) => c.scores?.[f] ?? 0), label: c.decision }));
  const { root, importance } = fit(rows, features, TREE_PARAMS);
  const ev = evaluate(rows, features, TREE_PARAMS);
  const prior = await currentModel();
  const model: TreeModel = {
    version: (prior?.version ?? 0) + 1,
    trainedAt: new Date().toISOString(),
    scoredWith,
    features,
    labels: [...new Set(rows.map((r) => r.label))].sort(),
    root,
    importance,
    cases: rows.length,
    trainingAccuracy: ev.training,
    leaveOneOutAccuracy: ev.leaveOneOut,
    params: TREE_PARAMS,
  };
  await put("models", { ...model, id: `v${model.version}` });
  await put("models", { ...model, id: "current" });
  return model;
}

export function labeller(categories: readonly Category[]): (key: string) => string {
  const by = new Map(categories.map((c) => [c.key, c.label]));
  return (key) => by.get(key) ?? key;
}

/* ------------------------------------------------------------- one transcript, end to end */

export interface ClassifyResult {
  scores: Scores;
  decision: (DecisionResult & { modelVersion: number; stale: boolean }) | null;
  candidates: Candidate[];
  model: string;
  categories: number;
  ms: number;
}

export async function classify(transcript: string, opts: { discover?: boolean } = {}): Promise<ClassifyResult> {
  const text = transcript.trim().slice(0, MAX_TRANSCRIPT);
  if (!text) throw new Error("transcript required");
  const started = Date.now();
  const categories = await activeCategories();
  const [scores, found] = await Promise.all([scoreTranscript(text, categories), opts.discover === false ? Promise.resolve([] as Found[]) : findCandidates(text, categories)]);
  const { touched } = await queueCandidates(found, categories);
  const model = await currentModel();
  const decision = model ? { ...predict(model, scores, labeller(categories)), modelVersion: model.version, stale: model.scoredWith !== scoredWithKey(categories) } : null;
  const result: ClassifyResult = { scores, decision, candidates: touched, model: openaiModel(), categories: categories.length, ms: Date.now() - started };
  const top = Object.entries(scores).sort((a, b) => b[1] - a[1]).slice(0, 8);
  await put("runs", {
    id: newId("run"),
    at: new Date().toISOString(),
    transcriptSha256: createHash("sha256").update(text).digest("hex"),
    length: text.length,
    model: result.model,
    decision: decision?.decision ?? null,
    confidence: decision?.confidence ?? null,
    top,
    candidates: touched.map((c) => c.id),
    ms: result.ms,
  });
  return result;
}

export async function recentRuns(limit = 20): Promise<{ id: string; at: string; length: number; model: string; decision: string | null; confidence: number | null; top: [string, number][]; candidates: string[]; ms: number }[]> {
  const runs = await list<{ id: string; at: string; length: number; model: string; decision: string | null; confidence: number | null; top: [string, number][]; candidates: string[]; ms: number }>("runs");
  return runs.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}
