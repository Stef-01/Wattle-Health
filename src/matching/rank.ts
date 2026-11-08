// Ported from adhd.me/src/demo/clinicians.ts on 2026-10-15 (the ranking, the copy tables and
// the geo helpers; the roster data stayed in ADHD.ME).
//
// WHAT CHANGED IN THE PORT: every entry point takes the roster as a parameter — there is no
// default roster, because Wattle's roster is whatever `match()` was handed. The lexicon is a
// trailing optional parameter defaulting to the psychiatry discipline (see needs.ts). The
// archetype eligibility helper and the Healthengine-specific booking copy were not carried;
// `bookingHandoff` reads the platform name from the record instead.

import type { Clinician } from "./clinician";
import { describeDistance, distanceKm, resolvePlace, type SuburbPoint } from "@/src/geo/suburbs";
import { defaultLexicon, facetKey, holdsPreference, languageNeeds, readNeeds, type Lexicon, type NeedSignal, type Preference } from "./needs";
import { matchableLanguages } from "./languages";
// Value import of copy tables only. `clarify.ts` imports nothing but TYPES from this module, so
// this direction is the one that keeps the graph acyclic at runtime.
import { promptTables } from "./clarify";
import { profession } from "./support/professions";

/**
 * How long a books declaration stays fresh: a quarter. Long enough that nobody is nagged
 * weekly, short enough that a directory cannot spend a year advertising capacity nobody has.
 */
export const CAPACITY_FRESH_DAYS = 90;

export type CapacityGrade = "fresh-open" | "stale-open" | "closed";

/**
 * Grade a capacity declaration by its age (O56). `today` is injected so ranking stays a pure
 * function of its arguments. An UNDATED open declaration grades stale: freshness is a claim,
 * and a claim nobody dated cannot make it.
 */
export function capacityGrade(clinician: Clinician, today: Date = new Date()): CapacityGrade {
  if (!clinician.acceptingNewPatients) return "closed";
  if (!clinician.capacityDeclaredAt) return "stale-open";
  const ageDays = (today.getTime() - new Date(clinician.capacityDeclaredAt).getTime()) / 86_400_000;
  return ageDays <= CAPACITY_FRESH_DAYS ? "fresh-open" : "stale-open";
}

/** Exported so the console's audit sort is the SAME order the finder uses, not a re-guess. */
export const CAPACITY_ORDER: Record<CapacityGrade, number> = { "fresh-open": 0, "stale-open": 1, closed: 2 };

export function rankClinicians(query: string, roster: readonly Clinician[], today: Date = new Date(), lexicon: Lexicon = defaultLexicon()): Clinician[] {
  const needs = needsFor(query, roster, lexicon);
  return [...roster].sort((a, b) => {
    const aProfile = rankingProfile(a, needs);
    const bProfile = rankingProfile(b, needs);

    /* ACCESS BEFORE ACCUMULATION. A language or access request is not one more keyword: a
       clinician who does not answer that constraint must not leapfrog one who does by
       accumulating several lower-stakes care-area overlaps. (PRD §4.2) */
    const byConstraintCoverage = bProfile.constraintCoverage - aProfile.constraintCoverage;
    if (byConstraintCoverage !== 0) return byConstraintCoverage;

    const byConstraint = bProfile.constraintScore - aProfile.constraintScore;
    if (byConstraint !== 0) return byConstraint;

    /* TIERS BEFORE ACCUMULATION, WITHIN THE REMAINING SCORE TOO (M9/F9): care is STRONG,
       manner is CONTRIBUTORY, and a contributory tier never buys its way past a strong one by
       piling up. (PRD §4.3) */
    const byCare = bProfile.careScore - aProfile.careScore;
    if (byCare !== 0) return byCare;

    const byManner = bProfile.mannerScore - aProfile.mannerScore;
    if (byManner !== 0) return byManner;

    /* Equal weighted evidence is resolved by completeness: the clinician answering more of the
       distinct things the reader named comes first. */
    const byCoverage = bProfile.coverage - aProfile.coverage;
    if (byCoverage !== 0) return byCoverage;

    /* WITHIN EQUAL FIT, SOMEBODY WHO CAN ACTUALLY SEE YOU COMES FIRST (O4/F5, O56): fresh-open
       before stale-open before closed. Closed books never cost a point of fit. (PRD §4.4) */
    const byCapacity = CAPACITY_ORDER[capacityGrade(a, today)] - CAPACITY_ORDER[capacityGrade(b, today)];
    if (byCapacity !== 0) return byCapacity;

    // Exact ties remain peers in the UI's rank band, but source-file position must not decide
    // which named clinician appears first inside that band.
    const shuffle = (clinician: Clinician) => tieHash(`${query}|${clinician.id}`);
    return shuffle(a) - shuffle(b) || a.id.localeCompare(b.id);
  });
}

export type RankingProfile = {
  /** Number of distinct language and access constraints this clinician answers. */
  constraintCoverage: number;
  /** Weight of explicitly requested language and access constraints this clinician answers. */
  constraintScore: number;
  /** Weighted overlap on care-area facets alone — the STRONG tier (M9/F9). */
  careScore: number;
  /** Weighted overlap on manner facets alone — the CONTRIBUTORY tier (M9/F9). */
  mannerScore: number;
  /** The full explainable weighted-overlap score, across every tier. */
  weightedScore: number;
  /** Number of distinct requested needs answered, used only after an exact score tie. */
  coverage: number;
};

/**
 * The full, auditable ranking vector for one clinician. It deliberately contains no opaque
 * quality estimate, popularity, symptom severity, or clinician-specific coefficient.
 */
export function rankingProfile(clinician: Clinician, needs: readonly NeedSignal[]): RankingProfile {
  let constraintCoverage = 0;
  let constraintScore = 0;
  let careScore = 0;
  let mannerScore = 0;
  let weightedScore = 0;
  let coverage = 0;
  for (const need of needs) {
    const strength = facetStrength(clinician, need.facet);
    if (strength === 0) continue;
    const contribution = roundScore(need.weight * strength);
    coverage += 1;
    weightedScore += contribution;
    if (need.facet.kind === "preference" || need.facet.kind === "language") {
      constraintCoverage += 1;
      constraintScore += contribution;
    } else if (need.facet.kind === "care") {
      careScore += contribution;
    } else {
      mannerScore += contribution;
    }
  }
  return {
    constraintCoverage,
    constraintScore: roundScore(constraintScore),
    careScore: roundScore(careScore),
    mannerScore: roundScore(mannerScore),
    weightedScore: roundScore(weightedScore),
    coverage,
  };
}

/**
 * FNV-1a over a string, as a stable arbitrary number. Deterministic, cheap, dependency-free,
 * and with no relationship to anything a reader or a clinician could care about.
 */
function tieHash(input: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/**
 * How well one clinician answers what was asked for. THE WHOLE SCORE IS OVERLAP BETWEEN TWO
 * DECLARED SETS. There is no per-clinician coefficient anywhere in this function.
 */
export function scoreAgainst(clinician: Clinician, needs: readonly NeedSignal[]): number {
  return rankingProfile(clinician, needs).weightedScore;
}

/**
 * How strongly one clinician's declared record answers one facet — M1. THE ONE PLACE THAT
 * READS `careAreasSometimes`. `0` undeclared, `0.5` declared "sometimes" (care facets only),
 * `1` declared "often" or held at all.
 */
export function facetStrength(clinician: Clinician, facet: NeedSignal["facet"]): 0 | 0.5 | 1 {
  if (facet.kind === "care") {
    if (clinician.careAreas.includes(facet.area)) return 1;
    return (clinician.careAreasSometimes ?? []).includes(facet.area) ? 0.5 : 0;
  }
  if (facet.kind === "manner") return clinician.manner.includes(facet.trait) ? 1 : 0;
  if (facet.kind === "language") {
    return clinician.languages.some((spoken) => spoken.toLowerCase() === facet.language.toLowerCase()) ? 1 : 0;
  }
  return holdsPreference(clinician, facet.preference) ? 1 : 0;
}

/**
 * A free-text field a patient reads whose wording can assert the same real-world fact a
 * structured field answers separately (M3, F6). Detection only.
 */
export type DisplayTwin = {
  field: "appointmentLength";
  impliesClaim: (clinician: Clinician) => boolean;
  preference: Preference;
};

export const DISPLAY_TWINS: readonly DisplayTwin[] = [
  {
    field: "appointmentLength",
    impliesClaim: (clinician) => /\blonger?\s+(?:first\s+)?appointment/i.test(clinician.appointmentLength),
    preference: "longer-appointment",
  },
];

/** Every display twin whose wording asserts a claim on this clinician that the matcher does not hold. */
export function unheldDisplayClaims(clinician: Clinician): DisplayTwin[] {
  return DISPLAY_TWINS.filter((twin) => twin.impliesClaim(clinician) && !holdsPreference(clinician, twin.preference));
}

/** Whether this clinician answers one stated need at all. Derived from `facetStrength`. */
function answers(clinician: Clinician, need: NeedSignal): boolean {
  return facetStrength(clinician, need.facet) > 0;
}

/**
 * A facet label, lowered to sit inside a sentence — without breaking the words that must not be
 * (O118). Only the FIRST CHARACTER is ever touched; a first word that is an ACRONYM is left
 * alone; a LANGUAGE facet is left alone entirely.
 */
export function labelInSentence(need: NeedSignal): string {
  const label = need.label;
  if (need.facet.kind === "language") return label;
  const firstWord = label.split(/[\s-]/)[0] ?? "";
  if (firstWord.length > 1 && firstWord === firstWord.toUpperCase()) return label;
  return label.charAt(0).toLowerCase() + label.slice(1);
}

/**
 * What the profile says about an ask this clinician has not declared (O51). Declaration-framed:
 * a fact about a declaration and never a claim about ability. Returned as parts so a surface
 * can emphasise the ask inside an otherwise muted line.
 */
export function missedAskParts(need: NeedSignal): { before: string; label: string; after: string } {
  const facet = need.facet;
  let after = ", not something they declare. Another listing may.";
  if (facet.kind === "language") {
    after = ", not listed among the languages they consult in. Another listing may.";
  } else if (facet.kind === "preference") {
    const detail: Record<typeof facet.preference, string> = {
      "woman-gp": "this clinician does not match that preference",
      "man-gp": "this clinician does not match that preference",
      "telehealth-first": "this listing does not show a telehealth first appointment",
      "bulk-billing": "this listing does not show bulk billing",
      "longer-appointment": "this listing does not show a longer first appointment",
    };
    after = `, ${detail[facet.preference]}. Another listing may.`;
  }
  return {
    before: "You also asked for ",
    label: labelInSentence(need),
    after,
  };
}

export function missedAskCopy(need: NeedSignal): string {
  const { before, label, after } = missedAskParts(need);
  return `${before}${label}${after}`;
}

/**
 * The sentence a reader is owed when nobody listed answers what they asked for (O110). One
 * shape for every facet kind, and it is a fact about a DECLARATION rather than a claim about
 * ability. The sentence names the LIST it is about (O252).
 */
export function unservedCopy(label: string, noun: string): string {
  return `${label} is not something any ${noun} listed today declares. That is a gap in our listing, not in what you asked for.`;
}

/**
 * What the reader asked for that NOBODY on the roster declares — care, manner, preference and
 * language alike. A "sometimes" declaration is still a declaration (O2).
 */
export function unservedAsks(query: string, roster: readonly Clinician[], lexicon: Lexicon = defaultLexicon()): string[] {
  return unservedNeeds(query, roster, lexicon).map((need) => unservedCopy(need.label, rosterNoun(roster).one));
}

/** The needs behind `unservedAsks`, for a caller that wants the signals rather than the sentences. */
export function unservedNeeds(query: string, roster: readonly Clinician[], lexicon: Lexicon = defaultLexicon()): NeedSignal[] {
  const declared = new Set(
    roster.flatMap((clinician) => [...clinician.careAreas, ...(clinician.careAreasSometimes ?? [])]),
  );
  return needsFor(query, roster, lexicon).filter((need) => {
    const facet = need.facet;
    if (facet.kind === "care") return !declared.has(facet.area);
    if (facet.kind === "manner") return !roster.some((clinician) => clinician.manner.includes(facet.trait));
    if (facet.kind === "preference") return !roster.some((clinician) => holdsPreference(clinician, facet.preference));
    if (facet.kind === "language") {
      return !roster.some((clinician) =>
        clinician.languages.some((language) => language.toLowerCase() === facet.language.toLowerCase()),
      );
    }
    return false;
  });
}

/**
 * WHETHER THE ORDER MEANS ANYTHING, which the finder has to be able to say (PRD §4.5, §8.1.4).
 *
 *   informed  — the words reached facets and the clinicians differ on them. The order is earned.
 *   tied      — facets were reached and every clinician answers them equally. Order is arbitrary.
 *   unmatched — nothing was reached. There is no order; this is just the roster.
 *   unserved  — something was read that nobody listed answers.
 *
 * It is not a confidence score. It is a statement about whether a comparison happened at all.
 */
export type MatchQuality = "informed" | "tied" | "unmatched" | "unserved";

/**
 * The smallest share of the DISTINCT facets a query reached that must actually separate the
 * roster before the order earns `informed` — M7 (F8). Half: a query asking about two things
 * where one ties and one does not differs on HALF the ask, and that is already an order this
 * tree calls earned; a single thin facet deciding a four-facet ask is not.
 */
export const INFORMED_SEPARATION_RATIO = 0.5;

function separationRatioForNeeds(needs: readonly NeedSignal[], roster: readonly Clinician[]): number | null {
  if (needs.length === 0) return null;
  const askedFacets = new Map<string, NeedSignal["facet"]>();
  for (const need of needs) askedFacets.set(facetKey(need.facet), need.facet);
  const differing = [...askedFacets.values()].filter(
    (facet) => new Set(roster.map((clinician) => facetStrength(clinician, facet))).size > 1,
  ).length;
  return differing / askedFacets.size;
}

/**
 * The fraction of distinct facets a query reached on which the roster's declared strength
 * actually differs. `null` when the query reached nothing.
 */
export function separationRatio(query: string, roster: readonly Clinician[], lexicon: Lexicon = defaultLexicon()): number | null {
  return separationRatioForNeeds(needsFor(query, roster, lexicon), roster);
}

export function matchQuality(query: string, roster: readonly Clinician[], lexicon: Lexicon = defaultLexicon()): MatchQuality {
  const needs = needsFor(query, roster, lexicon);
  if (needs.length === 0) return "unmatched";
  const profiles = roster.map((clinician) => rankingProfile(clinician, needs));
  const scores = profiles.map((profile) => profile.weightedScore);
  // Words that were READ but that nobody on the roster answers are not a tie (O111).
  if (scores.every((score) => score === 0)) return "unserved";
  // `informed` must still imply a real score gap, never just a real facet-count gap.
  if (new Set(scores).size === 1) return "tied";
  const ratio = separationRatioForNeeds(needs, roster)!;
  return ratio >= INFORMED_SEPARATION_RATIO ? "informed" : "tied";
}

/**
 * The sentences beside a closed-books listing (O4/F5). Shown, not filtered. Two sentences,
 * because "shown because they fit what you asked" is only true when a fit was computed.
 */
export const CLOSED_BOOKS_COPY =
  "Their books are closed to new patients right now, shown because they fit what you asked. The practice can say when that changes.";
export const CLOSED_BOOKS_NEUTRAL_COPY =
  "Their books are closed to new patients right now. The practice can say when that changes.";

/** The right closed-books sentence for this clinician and query. Null when books are open. */
export function closedBooksNote(clinician: Clinician, query: string, roster: readonly Clinician[], lexicon: Lexicon = defaultLexicon()): string | null {
  if (clinician.acceptingNewPatients) return null;
  return matchEvidence(clinician, query, roster, lexicon).length > 0 ? CLOSED_BOOKS_COPY : CLOSED_BOOKS_NEUTRAL_COPY;
}

/**
 * THE OUTBOUND CONTROL'S LABEL AND ITS CAPTION, MADE ONE VALUE SO THEY CANNOT DISAGREE. A
 * handoff names the platform in its caption if and only if it names it in its label. Null for
 * a record with no booking route, which has no control — never a disabled button or a link to
 * a fabricated page. (PRD §4.7: booking is a handoff.)
 */
export type BookingHandoff = { label: string; caption: string };

export function bookingHandoff(clinician: Clinician): BookingHandoff | null {
  switch (clinician.booking.via) {
    case "platform":
      return {
        label: `See times on ${clinician.booking.platform}`,
        caption: `Opens ${clinician.booking.platform} in a new tab.`,
      };
    case "practice":
      return { label: "Open the practice page", caption: "Opens the practice’s own page in a new tab." };
    case "none":
      return null;
  }
}

/** What the finder says when the order is not earned. Closed vocabulary, like every other reason. */
export const MATCH_QUALITY_COPY: Record<MatchQuality, string> = {
  informed: "",
  tied: "Everyone here answers what you asked for equally well, so this is not a ranking.",
  unmatched: "We could not tell what you are looking for, so this is everyone we list, not an order.",
  unserved: "We understood what you asked for. Nobody listed today answers it, so this is everyone we list, not an order.",
};

/**
 * The ranked roster, grouped where the scores are exactly equal (O3/F3). Within a band the
 * order is NOT a ranking, and a surface can say so exactly where it is true.
 */
export type RankBand = {
  score: number;
  constraintCoverage: number;
  constraintScore: number;
  careScore: number;
  mannerScore: number;
  coverage: number;
  clinicians: Clinician[];
};

export function rankBands(query: string, roster: readonly Clinician[], lexicon: Lexicon = defaultLexicon()): RankBand[] {
  const needs = needsFor(query, roster, lexicon);
  const bands: RankBand[] = [];
  for (const clinician of rankClinicians(query, roster, new Date(), lexicon)) {
    const profile = rankingProfile(clinician, needs);
    const last = bands.at(-1);
    if (
      last &&
      last.score === profile.weightedScore &&
      last.constraintCoverage === profile.constraintCoverage &&
      last.constraintScore === profile.constraintScore &&
      last.careScore === profile.careScore &&
      last.mannerScore === profile.mannerScore &&
      last.coverage === profile.coverage
    ) {
      last.clinicians.push(clinician);
    } else {
      bands.push({
        score: profile.weightedScore,
        constraintCoverage: profile.constraintCoverage,
        constraintScore: profile.constraintScore,
        careScore: profile.careScore,
        mannerScore: profile.mannerScore,
        coverage: profile.coverage,
        clinicians: [clinician],
      });
    }
  }
  return bands;
}

/** The asks the order was actually built from, strongest first, deduplicated by label. */
function orderedAsks(query: string, roster: readonly Clinician[], lexicon: Lexicon): NeedSignal[] {
  const strongest = new Map<string, NeedSignal>();
  for (const need of needsFor(query, roster, lexicon)) {
    const held = strongest.get(need.label);
    if (!held || need.weight > held.weight) strongest.set(need.label, need);
  }
  return [...strongest.values()].sort((a, b) => b.weight - a.weight);
}

/**
 * The noun for what a roster holds: the profession's own words when the list holds one kind,
 * "provider" when it mixes kinds. An entry with no profession reads as a GP.
 */
export function rosterNoun(roster: readonly Clinician[]): { one: string; many: string } {
  const kinds = new Set(roster.map((c) => c.profession ?? "gp"));
  if (kinds.size === 1) {
    const only = [...kinds][0]!;
    const entry = profession(only);
    return { one: entry.label === "GP" ? "GP" : entry.label.toLowerCase(), many: entry.plural };
  }
  return { one: "provider", many: "providers" };
}

/**
 * Why the list is in this order, said on the screen that shows the order. Derived from the
 * same read the ranking ran, so it cannot describe an order the list does not have. One branch
 * per `MatchQuality`. `nearest` is the caller's fact: the distance clause appears exactly when
 * distance actually moved something.
 */
export function orderNote(
  query: string,
  roster: readonly Clinician[],
  { nearest = false, lexicon = defaultLexicon() }: { nearest?: boolean; lexicon?: Lexicon } = {},
): string {
  const quality = matchQuality(query, roster, lexicon);
  const noun = rosterNoun(roster);
  if (quality === "unmatched") {
    return nearest
      ? `Nothing you said names something this listing can compare on, so this is every listed ${noun.one}, nearest first.`
      : `Nothing you said names something this listing can compare on, so this is every listed ${noun.one}, in the order the listing holds them.`;
  }
  const asks = orderedAsks(query, roster, lexicon);
  const namedWith = (say: (need: NeedSignal) => string) => {
    const parts = asks.slice(0, 3).map(say);
    return asks.length > 3 ? `${asList(parts)}, and ${asks.length - 3} more` : asList(parts);
  };
  const inProse = namedWith(labelInSentence);
  if (quality === "unserved") {
    return nearest
      ? `No listed ${noun.one} declares ${inProse}, so nothing below is ordered by it, this is every listed ${noun.one}, nearest first.`
      : `No listed ${noun.one} declares ${inProse}, so nothing below is ordered by it, this is every listed ${noun.one}, in the order the listing holds them.`;
  }
  if (quality === "tied") {
    return nearest
      ? `You asked about ${inProse}, and the listed ${noun.many} answer that too similarly to rank, so nearer rooms come first.`
      : `You asked about ${inProse}, and the listed ${noun.many} answer that too similarly to rank, read this as a list, not an order.`;
  }
  const asListed = namedWith((need) => need.label);
  return nearest
    ? `Ordered by what you asked for: ${asListed}. Where two answer the same, nearer comes first.`
    : `Ordered by what you asked for: ${asListed}.`;
}

/** The sentence for a top-of-list tie that the roster-global verdict cannot see (F3). */
export function topTieNote(query: string, roster: readonly Clinician[], lexicon: Lexicon = defaultLexicon()): string | null {
  if (matchQuality(query, roster, lexicon) !== "informed") return null;
  const top = rankBands(query, roster, lexicon)[0];
  if (!top || top.clinicians.length < 2) return null;
  return `The first ${top.clinicians.length} all answer what you asked equally well, so the order between them is not a ranking, read them as a group.`;
}

/**
 * Everything the reader asked for that this roster can be compared on: the lexicon's closed
 * vocabulary plus the languages the roster itself declares. THIS IS THE ONE ENTRY POINT
 * (O1/F2): the ranking, the quality verdict, the explanation and the console audit all read it.
 */
/**
 * One read per (lexicon, roster, query). `matchEvidence` and `missedAsks` ask for the needs once per
 * clinician, so a 4,870-doctor search read the sentence 9,740 times and walked the roster each time
 * (2.2 s of a 4.6 s search, profiled 2026-11-08). The roster is keyed by identity; the map per roster
 * holds the last 64 sentences. Callers only map and filter the result, never mutate it.
 */
const NEEDS_CACHE = new WeakMap<Lexicon, WeakMap<readonly Clinician[], Map<string, NeedSignal[]>>>();

export function needsFor(query: string, roster: readonly Clinician[], lexicon: Lexicon = defaultLexicon()): NeedSignal[] {
  let byRoster = NEEDS_CACHE.get(lexicon);
  if (!byRoster) NEEDS_CACHE.set(lexicon, (byRoster = new WeakMap()));
  let byQuery = byRoster.get(roster);
  if (!byQuery) byRoster.set(roster, (byQuery = new Map()));
  const hit = byQuery.get(query);
  if (hit) return hit;
  const computed = computeNeeds(query, roster, lexicon);
  if (byQuery.size >= 64) byQuery.delete(byQuery.keys().next().value as string);
  byQuery.set(query, computed);
  return computed;
}

function computeNeeds(query: string, roster: readonly Clinician[], lexicon: Lexicon): NeedSignal[] {
  const spoken = [...new Set([...matchableLanguages(lexicon), ...roster.flatMap((c) => c.languages)])];
  const signals = [...readNeeds(query, lexicon), ...languageNeeds(query, spoken, lexicon)];
  const said = query.toLowerCase();
  const answersByKey = clarifierAnswers(lexicon);
  return signals.map((need) => {
    const answer = answersByKey.get(facetKey(need.facet));
    const confirmed = answer !== undefined && said.includes(answer);
    return {
      ...need,
      weight: roundScore(
        need.weight *
          (confirmed ? STATED_IMPORTANCE_LIFT : 1) *
          separation(declaredMass(roster, need), roster.length),
      ),
    };
  });
}

/**
 * Scores snap to three decimal places wherever one is produced, so two mathematically equal
 * totals never compare unequal through float dust.
 */
export function roundScore(value: number): number {
  return Math.round(value * 1000) / 1000;
}

const CLARIFIER_ANSWER_CACHE = new WeakMap<Lexicon, Map<string, string>>();

/**
 * Every clarifier answer sentence, keyed by the facet it confirms. These are OUR OWN fixed
 * sentences, appended verbatim by the clarifier UI — marker detection on constants, not an
 * attempt to read a person's language.
 */
function clarifierAnswers(lexicon: Lexicon): Map<string, string> {
  let answers = CLARIFIER_ANSWER_CACHE.get(lexicon);
  if (!answers) {
    answers = new Map(Object.entries(promptTables(lexicon)).map(([key, copy]) => [key, copy.answer.toLowerCase()]));
    CLARIFIER_ANSWER_CACHE.set(lexicon, answers);
  }
  return answers;
}

/**
 * Importance is the READER'S datum, not the platform's (O5/F6): a confirmed clarifier facet
 * carries half again its lexicon weight.
 */
const STATED_IMPORTANCE_LIFT = 1.5;

/**
 * How much of a facet's weight survives, given how many of the roster hold it (the O2/F1
 * rarity discount). `(N − heldBy + 1) / N`, capped at 1. A facet nobody else declares keeps its
 * whole weight; a facet the entire roster declares keeps 1/N of it. It discounts POPULAR
 * FACETS; it does not penalise BROAD DECLARERS (O182) — stated so nobody builds on the
 * stronger claim.
 */
function separation(heldBy: number, rosterSize: number): number {
  if (rosterSize === 0) return 1;
  return Math.min(1, (rosterSize - heldBy + 1) / rosterSize);
}

/**
 * How much of the roster's DECLARED CAPABILITY covers this facet (O182): rarity counts the
 * SAME quantity scoring pays out, so a "sometimes" declaration dilutes a rival by exactly what
 * it earns and the box-ticking strategy disappears.
 */
function declaredMass(roster: readonly Clinician[], need: NeedSignal): number {
  return roster.reduce((mass, clinician) => mass + facetStrength(clinician, need.facet), 0);
}

/**
 * The needs this clinician actually answers, in the reader's asking order. ONE COMPUTATION,
 * TWO CONSUMERS: the ranking and the explanation both read this. The weight the card carries is
 * the weight this clinician's answer actually earned.
 */
export function matchEvidence(
  clinician: Clinician,
  query: string,
  roster: readonly Clinician[],
  lexicon: Lexicon = defaultLexicon(),
): NeedSignal[] {
  return needsFor(query, roster, lexicon)
    .filter((need) => answers(clinician, need))
    .map((need) => ({ ...need, weight: roundScore(need.weight * facetStrength(clinician, need.facet)) }));
}

/**
 * The asks THIS clinician does not answer (O51). Same read as the evidence, inverted filter, so
 * the profile's two lists partition the reader's asks exactly.
 */
export function missedAsks(
  clinician: Clinician,
  query: string,
  roster: readonly Clinician[],
  lexicon: Lexicon = defaultLexicon(),
): NeedSignal[] {
  return needsFor(query, roster, lexicon).filter((need) => !answers(clinician, need));
}

export type RequestFitSummary = {
  recognizedNeedCount: number;
  constraintCount: number;
  fullMatchCount: number;
  bestCoverage: number;
  bestConstraintCoverage: number;
};

/** Roster-level fit without conflating collective coverage with one clinician meeting every ask. */
export function requestFitSummary(query: string, roster: readonly Clinician[], lexicon: Lexicon = defaultLexicon()): RequestFitSummary {
  const needs = needsFor(query, roster, lexicon);
  const profiles = roster.map((clinician) => rankingProfile(clinician, needs));
  const constraintCount = needs.filter(
    (need) => need.facet.kind === "preference" || need.facet.kind === "language",
  ).length;
  return {
    recognizedNeedCount: needs.length,
    constraintCount,
    fullMatchCount: needs.length === 0 ? 0 : profiles.filter((profile) => profile.coverage === needs.length).length,
    bestCoverage: Math.max(0, ...profiles.map((profile) => profile.coverage)),
    bestConstraintCoverage: Math.max(0, ...profiles.map((profile) => profile.constraintCoverage)),
  };
}

/** Honest results copy for how many individual listings, if any, answer the complete request. */
export function requestFitCopy(summary: RequestFitSummary, roster: readonly Clinician[]): string | null {
  const rosterSize = roster.length;
  if (summary.recognizedNeedCount === 0 || rosterSize === 0) return null;
  const noun = rosterNoun(roster);
  if (summary.fullMatchCount === rosterSize) {
    if (rosterSize === 1) return `This listed ${noun.one} matches every part of your request we understood.`;
    if (rosterSize === 2) return `Both listed ${noun.many} match every part of your request we understood.`;
    return `All ${rosterSize} listed ${noun.many} match every part of your request we understood.`;
  }
  if (summary.fullMatchCount > 0) {
    return `${summary.fullMatchCount} of ${rosterSize} listed ${noun.many} ${summary.fullMatchCount === 1 ? "matches" : "match"} every part of your request we understood.`;
  }
  return `No listed ${noun.one} matches every part of your request we understood. Showing the strongest declared matches.`;
}

/**
 * Rank by stated preference, then bring the near ones forward. TWO-STAGE ON PURPOSE: distance
 * does not outrank fit; it reorders only WITHIN an exact fit-and-capacity tie (O3/F4). NOT A
 * COMPARATOR: within each tie, the clinicians with a real distance swap among the positions
 * they already occupy; telehealth-first and unknown-suburb clinicians keep their exact fit
 * position (PRD §4.12).
 */
export function rankCliniciansNear(
  query: string,
  origin: SuburbPoint | null,
  roster: readonly Clinician[],
  today: Date = new Date(),
  lexicon: Lexicon = defaultLexicon(),
): Clinician[] {
  const byFit = rankClinicians(query, roster, today, lexicon);
  if (!origin) return byFit;

  const needs = needsFor(query, roster, lexicon);
  const km = (c: Clinician) => nearestLocation(c, origin)?.km ?? null;

  const out = [...byFit];
  const tieKey = (c: Clinician) => {
    const profile = rankingProfile(c, needs);
    return `${profile.constraintCoverage}|${profile.constraintScore}|${profile.weightedScore}|${profile.coverage}|${CAPACITY_ORDER[capacityGrade(c, today)]}`;
  };
  let start = 0;
  while (start < out.length) {
    let end = start;
    while (end + 1 < out.length && tieKey(out[end + 1]!) === tieKey(out[start]!)) end += 1;

    const movable: number[] = [];
    for (let i = start; i <= end; i += 1) {
      const c = out[i]!;
      if (!c.telehealthFirstAppointment && km(c) !== null) movable.push(i);
    }
    const nearestFirst = movable
      .map((i) => out[i]!)
      .sort((a, b) => km(a)! - km(b)!);
    movable.forEach((position, j) => {
      out[position] = nearestFirst[j]!;
    });

    start = end + 1;
  }
  return out;
}

/**
 * A clinician's consulting locations that can be placed: declared coordinates when the record
 * carries them, else the primary suburb plus any `alsoConsultsAt` resolved through the
 * gazetteer. A location nobody can place is simply absent — our missing row, never their penalty.
 */
function consultingPoints(clinician: Clinician): Array<{ suburb: string; point: SuburbPoint }> {
  // Nobody travels to a telehealth-only clinician: no rooms, no distance, whatever the gazetteer
  // knows about the suburb their practice is registered in.
  if (clinician.telehealthOnly) return [];
  if (clinician.consultingPoints && clinician.consultingPoints.length > 0) {
    return clinician.consultingPoints.map((point) => ({ suburb: point.suburb, point }));
  }
  return [clinician.suburb, ...(clinician.alsoConsultsAt ?? [])]
    .map((suburb) => ({ suburb, point: resolvePlace(suburb) }))
    .filter((entry): entry is { suburb: string; point: SuburbPoint } => entry.point !== null);
}

/** The nearest consulting location as a PLACE, so the map and the ranking cannot disagree. */
export function nearestConsultingLocation(clinician: Clinician, origin: SuburbPoint): { suburb: string; point: SuburbPoint } | null {
  let best: { suburb: string; point: SuburbPoint; km: number } | null = null;
  for (const { suburb, point } of consultingPoints(clinician)) {
    const km = distanceKm(origin, point);
    if (!best || km < best.km) best = { suburb, point, km };
  }
  return best ? { suburb: best.suburb, point: best.point } : null;
}

/** The nearest consulting location's distance in km, or null when the clinician cannot be placed. */
export function nearestKm(clinician: Clinician, origin: SuburbPoint): number | null {
  return nearestLocation(clinician, origin)?.km ?? null;
}

function nearestLocation(clinician: Clinician, origin: SuburbPoint): { suburb: string; km: number } | null {
  let best: { suburb: string; km: number } | null = null;
  for (const { suburb, point } of consultingPoints(clinician)) {
    const km = distanceKm(origin, point);
    if (!best || km < best.km) best = { suburb, km };
  }
  return best;
}

/** Every place this clinician consults, as one label: "Double Bay & Hornsby". */
export function locationLabel(clinician: Clinician): string {
  return [clinician.suburb, ...(clinician.alsoConsultsAt ?? [])].join(" & ");
}

/** The distance sentence for a clinician, or null when there is nothing honest to say. */
export function distanceTo(clinician: Clinician, origin: SuburbPoint | null): string | null {
  if (!origin) return null;
  // A kilometre figure beside somebody you never travel to is a number that answers no question.
  if (clinician.telehealthFirstAppointment) return "by telehealth";
  const nearest = nearestLocation(clinician, origin);
  if (!nearest) return null;
  const said = describeDistance(nearest.km);
  return nearest.suburb === clinician.suburb ? said : `${said} (their ${nearest.suburb} rooms)`;
}

/** "a", "a and b", "a, b and c" — Australian conjunction, no Oxford comma. */
const LIST_FORMAT = new Intl.ListFormat("en-AU", { style: "long", type: "conjunction" });

export function asList(items: readonly string[]): string {
  return LIST_FORMAT.format(items);
}

/**
 * The reason sentence, composed from the closed vocabulary and nothing else. DERIVED, NOT
 * RE-DERIVED: it reads `matchEvidence`, so the explanation IS the ranking's evidence. Labels
 * keep the case they were authored in.
 */
export function getPersonalizedMatch(clinician: Clinician, query: string, roster: readonly Clinician[], lexicon: Lexicon = defaultLexicon()) {
  const evidence = matchEvidence(clinician, query, roster, lexicon);
  const signals = evidence.map((need) => need.label);
  const reason = signals.length === 0
    ? clinician.matchLine
    : `${clinician.shortName}: ${asList(signals.slice(0, 3))}.`;
  return { reason, signals };
}
