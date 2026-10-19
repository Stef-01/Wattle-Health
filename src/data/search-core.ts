// The search itself, pure over the roster and vocabulary it is handed: sentence → chips the
// person can correct → match() → cards the screens render. runSearch (search.ts) feeds it the
// server roster; the static build feeds it src/generated/roster.json in the browser
// (client-match.ts). The sentence is read here and returned in closed vocabulary only; it
// never goes into a URL or a log.
import { match, type HumanFitWeights } from "@/src/matching";
import { hardAsks, languageNeeds, lexiconFor, readNeeds, type NeedSignal } from "@/src/matching/needs";
import type { Intent, Ranked, SpecialtyField } from "@/src/matching/types";
import type { Discipline } from "@/src/disciplines/load";
import { highlightsFor } from "./highlights";
import { resolveSuburb } from "./places";
import type { DoctorRecord } from "./types";
import { DEFAULT_WEIGHTS, type Card, type Chip, type FitBand, type SearchRequest, type SearchResponse, type Weights } from "./search-types";

export function toHumanFitWeights(w: Weights): HumanFitWeights {
  return { clinicalInterests: w.clinical, philosophy: w.communication, livedExperience: w.lived, research: w.research, populations: 1 };
}

const SPECIALTY_LABEL: Partial<Record<SpecialtyField, string>> = {
  psychiatry: "Psychiatry",
  paediatrics: "Paediatrics",
  "obstetrics-gynaecology": "Obstetrics and gynaecology",
  "general-practice": "General practice",
  "pain-medicine": "Pain medicine",
};
const specialtyLabel = (s: SpecialtyField): string => SPECIALTY_LABEL[s] ?? s.replace(/-/g, " ");

const PREF_LABEL: Record<string, { label: string; must: boolean }> = {
  "woman-gp": { label: "Woman doctor", must: true },
  "man-gp": { label: "Man doctor", must: true },
  "telehealth-first": { label: "Telehealth", must: false },
  "bulk-billing": { label: "Bulk billing", must: false },
  "longer-appointment": { label: "Longer appointment", must: false },
};

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function chipsFor(sentence: string, discipline: Discipline, intent: Intent | undefined): Chip[] {
  const lexicon = lexiconFor(discipline);
  const needs: NeedSignal[] = readNeeds(sentence, lexicon);
  const langs = languageNeeds(sentence, Object.keys(discipline.languages), lexicon);
  const asks = hardAsks(sentence, lexicon);
  const chips: Chip[] = [];
  const seen = new Set<string>();
  const push = (chip: Chip) => {
    if (seen.has(chip.id)) return;
    seen.add(chip.id);
    chips.push(chip);
  };
  for (const n of needs) {
    const f = n.facet;
    if (f.kind === "care") push({ id: `condition:${f.area}`, kind: "condition", label: n.label, phrase: n.matched, removable: true });
    else if (f.kind === "manner") push({ id: `human:${f.trait}`, kind: "human", label: n.label, phrase: n.matched, removable: true });
    else if (f.kind === "preference") {
      const p = PREF_LABEL[f.preference] ?? { label: n.label, must: false };
      const must = p.must || (f.preference === "telehealth-first" && asks.telehealthOnly) || (f.preference === "bulk-billing" && asks.bulkBillingOnly);
      push({ id: `${must ? "must" : "preference"}:${f.preference}`, kind: must ? "must" : "preference", label: p.label, phrase: n.matched, removable: true });
    }
  }
  for (const l of langs) {
    if (l.facet.kind === "language") push({ id: `must:language-${l.facet.language}`, kind: "must", label: l.label, phrase: l.matched, removable: true });
  }
  const lower = sentence.toLowerCase();
  for (const pop of discipline.populations) {
    const cue = pop.cues.find((c) => new RegExp(`(^|[^a-z])${escape(c.toLowerCase())}([^a-z]|$)`).test(lower));
    if (cue && pop.id !== "adult") push({ id: `population:${pop.id}`, kind: "population", label: pop.id.replace("-", " "), phrase: cue, removable: true });
  }
  for (const h of intent?.humanFit ?? []) {
    const label = discipline.manner.find((m) => m.id === h)?.label ?? h.replace(/-/g, " ");
    push({ id: `human:${h}`, kind: "human", label, removable: false });
  }
  for (const s of intent?.specialties ?? []) push({ id: `specialty:${s}`, kind: "specialty", label: specialtyLabel(s), removable: false });
  return chips;
}

function stripPhrases(sentence: string, phrases: string[]): string {
  let out = sentence;
  for (const phrase of phrases) {
    if (!phrase) continue;
    out = out.replace(new RegExp(escape(phrase), "ig"), " ");
  }
  return out.replace(/\s+/g, " ").trim();
}

const BAND: Record<Ranked["clinicalFit"]["band"], FitBand> = { documented: "strong", plausible: "some", listed: "listed" };

/** A ranked result as the screens' Card; shared with the rerank path (rerank-core.ts). */
export function toCard(ranked: Ranked, byId: Map<string, DoctorRecord>, intent?: Intent, labels: Record<string, string> = {}): Card | null {
  const doctor = byId.get(ranked.doctor.id);
  if (!doctor) return null;
  const clinical = ranked.clinicalFit ?? { band: "listed" as const, reasons: [] };
  const human = ranked.humanFit ?? { score: 0, reasons: [], basis: "none" as const };
  const card: Card = {
    doctor,
    headline: ranked.headline,
    score: ranked.score,
    clinicalFit: { band: BAND[clinical.band] ?? "listed", reasons: clinical.reasons.map((r) => r.text) },
    humanFit: { score: human.score, reasons: human.reasons.map((r) => r.text), basis: human.basis },
    evidence: ranked.evidence,
    missed: ranked.missed,
  };
  if (ranked.distanceKm !== undefined) card.distanceKm = ranked.distanceKm;
  card.highlights = highlightsFor(doctor, intent, labels);
  return card;
}

export function searchWith(allDoctors: readonly DoctorRecord[], discipline: Discipline, req: SearchRequest): SearchResponse {
  const exclude = new Set(req.exclude ?? []);
  const doctors = exclude.size ? allDoctors.filter((d) => !exclude.has(d.specialty)) : allDoctors;
  const weights: Weights = { ...DEFAULT_WEIGHTS, ...(req.weights ?? {}) };
  const typed = (req.suburb ?? "").trim() || "Brisbane";
  const place = resolveSuburb(typed, doctors);

  const original = req.sentence.slice(0, 1200);
  const removed = new Set(req.removed ?? []);
  const first = match(original, place, doctors, { discipline, weights: toHumanFitWeights(weights) });
  const chipsAll = chipsFor(original, discipline, first.intent);
  const sentence = stripPhrases(original, chipsAll.filter((c) => removed.has(c.id)).map((c) => c.phrase ?? ""));
  const result = sentence === original ? first : match(sentence, place, doctors, { discipline, weights: toHumanFitWeights(weights) });
  const chips = chipsAll.filter((c) => !removed.has(c.id));

  const byId = new Map(doctors.map((d) => [d.id, d]));
  const conditionLabels = Object.fromEntries(discipline.conditions.map((c) => [c.id, c.label]));
  const cards = result.results.map((r) => toCard(r, byId, result.intent, conditionLabels)).filter((c): c is Card => c !== null);

  const response: SearchResponse = {
    order: result.order,
    orderNote: result.orderNote,
    cards,
    chips,
    clarifiers: result.clarifiers,
    place: { typed, suburb: place?.suburb ?? null },
    rosterSize: doctors.length,
    conditionLabels,
  };
  if (result.careGuidance) response.careGuidance = result.careGuidance;
  if (result.emergency) response.emergency = result.emergency;
  if (result.unserved) response.unserved = result.unserved;
  return response;
}
