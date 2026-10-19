// The matching pipeline (PRD §8.1, writing-block.md Tasks 5 and 6): sentence → intent → Layer 1
// (hard filters, tiered clinical rank) → Layer 2 (human-fit reorder inside each clinical band)
// → order honesty → explanations. Written for the port on 2026-10-15 on top of the functions
// ported from adhd.me/src/matching and adhd.me/src/demo/clinicians.ts; the two-layer shape is
// the plan's, and lives in layer1.ts and layer2.ts.
//
// Every number here is explainable from a declaration: the ranker holds no per-doctor
// coefficient, the evidence rows carry the tier of the declaration they rest on, every reason
// names the field it rests on, and the order note says whether the order was earned.

import type { Clinician } from "./clinician";
import { evidenceFor, toClinician } from "./adapter";
import { clarifiers } from "./clarify";
import { hardAsks, isEmergency, lexiconFor, lexiconForSlug, type Lexicon } from "./needs";
import { CARE_GUIDANCE, clinicalFitFor, extractIntent, layer1Filter, REACH_KM } from "./layer1";
import { DEFAULT_WEIGHTS, rerank, type WeightsInput } from "./layer2";
import {
  CAPACITY_ORDER,
  capacityGrade,
  closedBooksNote,
  matchEvidence,
  matchQuality,
  missedAsks,
  nearestKm,
  orderNote,
  rankCliniciansNear,
  rankingProfile,
  needsFor,
  unservedNeeds,
} from "./rank";
import type { Discipline } from "@/src/disciplines/load";
import type { SuburbPoint } from "@/src/geo/suburbs";
import { isAllied, type Doctor, type Evidence, type FilterReason, type MatchResult, type Place, type Ranked } from "./types";

export { REACH_KM, CARE_GUIDANCE } from "./layer1";
export { DEFAULT_WEIGHTS, ZERO_WEIGHTS, NO_PROFILE_REASON, normaliseWeights, rerank, humanFitFor, type HumanFitWeights, type WeightsInput } from "./layer2";
export { extractIntent, clinicalFitFor, layer1Filter, specialtiesFor, isMandatory, urgencyOf, SPECIALTY_LABELS } from "./layer1";

/** How many results the screen shows. */
export const RESULTS_SHOWN = 3;

/**
 * What the screen shows instead of a list when the sentence carries an emergency cue. One
 * sentence, no ranking: a list of psychiatrists is the wrong answer to it.
 */
export const EMERGENCY_NOTE =
  "If you or someone else is in danger right now, call 000. Lifeline is on 13 11 14, any time.";

/** Patient-facing names for the hard-filter reasons, used in the unserved breakdown. */
export const FILTER_REASON_COPY: Record<FilterReason, string> = {
  "wrong-specialty": "a different specialty",
  "closed-books": "books that are closed",
  "wrong-age-group": "a different age group",
  "billing-mismatch": "bulk billing only",
  "no-telehealth": "telehealth only",
  "out-of-reach": `within ${REACH_KM} km`,
  "registration-not-current": "a current registration",
  "gender-mismatch": "the gender you asked for",
  "language-mismatch": "a language they consult in",
};

/** The discipline a match runs under: a loaded yaml, or its slug. */
export type DisciplineChoice = "mvp" | "psychiatry" | Discipline;

export interface MatchOptions {
  discipline: DisciplineChoice;
  /** Layer-2 weights; `DEFAULT_WEIGHTS` when absent. Any subset, see `WeightsInput`. */
  weights?: Readonly<WeightsInput>;
  today?: Date;
}

function originOf(place: Place | null | undefined): SuburbPoint | null {
  if (!place) return null;
  return { suburb: place.suburb, postcode: "", lat: place.lat, lon: place.lng };
}

/**
 * The ported hard filters, kept under their original name for callers and tests that read a
 * single-specialty roster. `match()` runs `layer1Filter`, which adds the intent's specialty
 * set and the mandatory constraints.
 */
export function filterReason(
  doctor: Doctor,
  clinician: Clinician,
  discipline: Discipline,
  asks: { telehealthOnly: boolean; bulkBillingOnly: boolean },
  origin: SuburbPoint | null,
): FilterReason | null {
  if (doctor.specialty !== discipline.slug) return "wrong-specialty";
  if (doctor.register && doctor.register.status.value !== "registered") return "registration-not-current";
  if (doctor.capacity.value === "closed") return "closed-books";
  if (asks.bulkBillingOnly && doctor.billing.value !== "bulk-bills" && doctor.billing.value !== "bulk-bills-concession") return "billing-mismatch";
  if (asks.telehealthOnly && doctor.telehealth.value === "none") return "no-telehealth";
  if (origin && doctor.telehealth.value === "none") {
    const km = nearestKm(clinician, origin);
    if (km !== null && km > REACH_KM) return "out-of-reach";
  }
  return null;
}

/**
 * The card headline: "In common: <top shared concept>", and each card's headline must differ
 * from the others' or the next-best concept is used (PRD §8.1.5).
 */
function headlines(cards: ReadonlyArray<{ evidence: Evidence[] }>): string[] {
  const labels = cards.map((card) => [...new Set(card.evidence.map((item) => item.label))]);
  const picked: (string | null)[] = labels.map(() => null);
  const used = new Set<string>();
  labels.forEach((options, index) => {
    let pick = options.find((label) => !used.has(label));
    if (pick === undefined && options[0] !== undefined) {
      // Every concept this card holds is taken. An earlier card holding the same concept may
      // have a second-best of its own; if so it moves, and this card keeps its only concept.
      const wanted = options[0];
      const holder = picked.findIndex((label, j) => j < index && label === wanted);
      const alternative = holder >= 0 ? labels[holder]!.find((label) => !used.has(label)) : undefined;
      if (holder >= 0 && alternative !== undefined) {
        picked[holder] = alternative;
        used.add(alternative);
        pick = wanted;
      } else {
        pick = wanted;
      }
    }
    if (pick !== undefined) {
      used.add(pick);
      picked[index] = pick;
    }
  });
  return picked.map((label) => (label === null ? "Listed for this specialty" : `In common: ${label}`));
}

/** The slice a screen shows, with headlines that differ card to card. Pure; call after `rerank`. */
export function shown(survivors: readonly Ranked[], count: number = RESULTS_SHOWN): Ranked[] {
  const top = survivors.slice(0, count);
  const titles = headlines(top.map((card) => ({ evidence: card.evidence.filter((item) => item.kind !== "capacity") })));
  return top.map((card, index) => ({ ...card, headline: titles[index]! }));
}

function resolveDiscipline(choice: DisciplineChoice): { discipline: Discipline; lexicon: Lexicon } {
  if (typeof choice === "string") {
    const lexicon = lexiconForSlug(choice);
    return { discipline: lexicon.discipline, lexicon };
  }
  return { discipline: choice, lexicon: lexiconFor(choice) };
}

function isDiscipline(value: Discipline | MatchOptions): value is Discipline {
  return "slug" in value && "conditions" in value;
}

/**
 * The pipeline. Two call shapes: the ported `match(sentence, place, doctors, discipline, today)`
 * and the plan's `match(sentence, place, doctors, { discipline: "mvp", weights })`. Both return
 * the Layer-2 ordered list with the clinical-fit and human-fit explanations on every result.
 */
export function match(sentence: string, place: Place | null | undefined, doctors: readonly Doctor[], discipline: Discipline, today?: Date, options?: Partial<MatchOptions>): MatchResult;
export function match(sentence: string, place: Place | null | undefined, doctors: readonly Doctor[], options: MatchOptions): MatchResult;
export function match(
  sentence: string,
  place: Place | null | undefined,
  doctors: readonly Doctor[],
  disciplineOrOptions: Discipline | MatchOptions,
  todayArg?: Date,
  extra: Partial<MatchOptions> = {},
): MatchResult {
  // A loaded Discipline as the fourth argument wins over a slug in `extra`: the caller's object
  // is the vocabulary the roster was built against.
  const options: MatchOptions = isDiscipline(disciplineOrOptions) ? { ...extra, discipline: disciplineOrOptions } : disciplineOrOptions;
  const { discipline, lexicon } = resolveDiscipline(options.discipline);
  const today = todayArg ?? options.today ?? new Date();
  const weights = options.weights ?? DEFAULT_WEIGHTS;

  if (isEmergency(sentence, lexicon)) {
    return {
      order: "unmatched",
      orderNote: EMERGENCY_NOTE,
      results: [],
      survivors: [],
      excluded: [],
      clarifiers: [],
      emergency: { note: EMERGENCY_NOTE },
    };
  }

  const origin = originOf(place);
  const asks = hardAsks(sentence, lexicon);
  const { intent } = extractIntent(sentence, lexicon);
  const byId = new Map<string, Doctor>();
  const roster: Clinician[] = [];
  const excluded: MatchResult["excluded"] = [];
  for (const doctor of doctors) {
    const clinician = toClinician(doctor);
    const reason = layer1Filter(doctor, clinician, intent, asks, origin);
    if (reason) {
      excluded.push({ doctor, reason });
      continue;
    }
    byId.set(clinician.id, doctor);
    roster.push(clinician);
  }

  const guidance = intent.urgency === "urgent" ? { careGuidance: CARE_GUIDANCE } : {};

  if (roster.length === 0) {
    const counts = new Map<FilterReason, number>();
    for (const { reason } of excluded) counts.set(reason, (counts.get(reason) ?? 0) + 1);
    return {
      order: "unserved",
      orderNote: "Nobody listed today answers every part of what you asked for. That is a gap in our listing, not in what you asked for.",
      results: [],
      survivors: [],
      excluded,
      unserved: [...counts.entries()].map(([reason, restoreCount]) => ({ ask: FILTER_REASON_COPY[reason], restoreCount })),
      clarifiers: [],
      intent,
      ...guidance,
    };
  }

  const order = matchQuality(sentence, roster, lexicon);
  const needs = needsFor(sentence, roster, lexicon);
  const byFit = rankCliniciansNear(sentence, origin, roster, today, lexicon);

  // The Layer-1 band is the tier vector rankClinicians sorts on plus the capacity grade: the
  // exact tie inside which distance already reordered, and the only place Layer 2 may reorder.
  const bandOf = (clinician: Clinician) => {
    const profile = rankingProfile(clinician, needs);
    return `${profile.constraintCoverage}|${profile.constraintScore}|${profile.careScore}|${profile.mannerScore}|${profile.coverage}|${CAPACITY_ORDER[capacityGrade(clinician, today)]}`;
  };
  // An allied provider's band carries its own suffix, so Layer 2 never lifts one past a doctor.
  const layer1Band = (clinician: Clinician) => `${bandOf(clinician)}${allied(clinician) ? "|allied" : ""}`;
  // ALLIED PROVIDERS NEVER LEAD WHERE A PRESCRIBER IS NEEDED (2026-10-19). For a condition the
  // yaml marks `prescriber: true` (ADHD), every doctor who passed Layer 1 ranks above every
  // allied provider; for any other ask, a doctor still ranks above an allied provider at an
  // exactly equal Layer-1 band. Stable partitions, so each side keeps the ranker's order.
  const allied = (clinician: Clinician) => isAllied(byId.get(clinician.id)!.specialty);
  const prescriberAsk = intent.conditions.some((id) => discipline.conditions.find((c) => c.id === id)?.prescriber === true);
  // Founder 2026-10-19 ("add in all providers"): ADHD uses the tie-break rule too, so a psychologist who documents ADHD can rank above a doctor who does not; doctors still win ties.
  void prescriberAsk;
  const ranked = medicalFirstWithinBands(byFit, allied, (c) => bandOf(c));

  const layer1: Ranked[] = ranked.map((clinician, position) => {
    const doctor = byId.get(clinician.id)!;
    const profile = rankingProfile(clinician, needs);
    const evidence: Evidence[] = matchEvidence(clinician, sentence, roster, lexicon).map((need) => ({
      label: need.label,
      ...evidenceFor(doctor, need.facet),
    }));
    const missed: Evidence[] = missedAsks(clinician, sentence, roster, lexicon).map((need) => ({
      label: need.label,
      ...evidenceFor(doctor, need.facet),
    }));
    const closed = closedBooksNote(clinician, sentence, roster, lexicon);
    if (closed) evidence.push({ label: closed, kind: "capacity", tier: doctor.capacity.tier });
    const card: Ranked = {
      doctor,
      score: profile.weightedScore,
      tiers: { access: profile.constraintScore, fit: profile.careScore, manner: profile.mannerScore, coverage: profile.coverage },
      evidence,
      missed,
      headline: "",
      clinicalFit: clinicalFitFor(doctor, intent, discipline),
      humanFit: { score: 0, reasons: [], basis: "none" },
      layer1: { band: layer1Band(clinician), position },
    };
    // The figure is shown whenever the doctor has rooms; whether it SORTS them is the
    // telehealth-first rule in rankCliniciansNear (PRD §4.12), not this line.
    const km = origin ? nearestKm(clinician, origin) : null;
    if (km !== null) card.distanceKm = Math.round(km * 10) / 10;
    return card;
  });

  const survivors = rerank(layer1, intent, weights, discipline);
  const results = shown(survivors);

  const result: MatchResult = {
    order,
    orderNote: orderNote(sentence, roster, { nearest: origin !== null, lexicon }),
    results,
    survivors,
    excluded,
    clarifiers: clarifiers(sentence, roster, 3, lexicon).map((clarifier) => ({
      facet: clarifier.facetKey,
      question: clarifier.prompt,
      options: [clarifier.answer],
    })),
    intent,
    ...guidance,
  };
  if (order === "unserved") {
    result.unserved = unservedNeeds(sentence, roster, lexicon).map((need) => ({ ask: need.label, restoreCount: 0 }));
  }
  return result;
}

/** Inside each run of equal Layer-1 band, doctors before allied providers; runs keep their order. */
function medicalFirstWithinBands(ranked: readonly Clinician[], allied: (c: Clinician) => boolean, band: (c: Clinician) => string): Clinician[] {
  const out: Clinician[] = [];
  let start = 0;
  while (start < ranked.length) {
    let end = start + 1;
    while (end < ranked.length && band(ranked[end]!) === band(ranked[start]!)) end += 1;
    const run = ranked.slice(start, end);
    out.push(...run.filter((c) => !allied(c)), ...run.filter(allied));
    start = end;
  }
  return out;
}
