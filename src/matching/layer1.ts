// Layer 1: clinical and administrative suitability (writing-block.md Task 5). Written on
// 2026-10-15 on top of the ported ADHD.ME reader and ranker.
//
// WHAT THIS LAYER DECIDES, in order:
//   1. the sentence → a structured `Intent` (conditions, the specialties that treat them,
//      population, access constraints and which of them are MANDATORY, manner, human-fit labels,
//      urgency, refusals) — lexical, from the discipline yaml, no model call;
//   2. the hard filters: the ported ones plus wrong-specialty against the intent's specialty set
//      and the mandatory constraints the sentence phrased as "must" / "only" / "has to be" /
//      "need a";
//   3. the clinical-fit verdict per surviving doctor: `documented` when they declare an asked
//      condition, `plausible` when they are the right specialty without documented evidence,
//      `listed` when no condition was asked. A plausible doctor is ranked below a documented one
//      by the existing care tier and is never removed for lacking evidence.
//
// Nothing here invents experience: every reason names the doctor field it rests on.

import type { Discipline } from "@/src/disciplines/load";
import type { SuburbPoint } from "@/src/geo/suburbs";
import type { Clinician } from "./clinician";
import { phrasePresent, readHumanFit } from "./human-fit";
import { matchableLanguages } from "./languages";
import { facetKey, hardAsks as hardAsksOf, isEmergency, languageNeeds, readNeeds, type Lexicon, type NeedSignal } from "./needs";
import { nearestKm } from "./rank";
import { isSpecialtyField, type ClinicalFit, type Doctor, type FilterReason, type Intent, type Population, type Reason, type SpecialtyField } from "./types";

/** In-person reach: beyond this a doctor is out of reach unless they consult by telehealth. */
export const REACH_KM = 30;

/** Patient-facing names for the Ahpra specialties, for the clinical-fit reasons. */
export const SPECIALTY_LABELS: Readonly<Record<SpecialtyField, string>> = {
  psychiatry: "psychiatry",
  paediatrics: "paediatrics",
  "obstetrics-gynaecology": "obstetrics and gynaecology",
  "general-practice": "general practice",
  "pain-medicine": "pain medicine",
  rheumatology: "rheumatology",
  "rehabilitation-medicine": "rehabilitation medicine",
  neurology: "neurology",
  gastroenterology: "gastroenterology",
  endocrinology: "endocrinology",
  "immunology-allergy": "immunology and allergy",
  cardiology: "cardiology",
  "respiratory-sleep-medicine": "respiratory and sleep medicine",
  "infectious-diseases": "infectious diseases",
  "clinical-genetics": "clinical genetics",
  psychology: "psychology",
  "occupational-therapy": "occupational therapy",
  "allied-health": "allied health",
};

const POPULATION_LABELS: Readonly<Record<Population, string>> = {
  infant: "infants",
  child: "children",
  adolescent: "adolescents",
  adult: "adults",
  "older-adult": "older adults",
  perinatal: "patients during pregnancy and after birth",
};

/**
 * Care-seeking guidance shown beside the results when the sentence carried an urgent (not
 * emergency) cue. A ranked list is still the right answer; this sentence is the other half.
 */
export const CARE_GUIDANCE =
  "If this cannot wait for a first appointment, see a GP today or call healthdirect on 1800 022 222 for advice on where to go.";

/** The specialties that appropriately treat any of the asked conditions (yaml `conditions[].specialties`). */
export function specialtiesFor(conditions: readonly string[], discipline: Discipline): SpecialtyField[] {
  const out: SpecialtyField[] = [];
  for (const id of conditions) {
    const group = discipline.conditions.find((condition) => condition.id === id);
    for (const specialty of group?.specialties ?? []) if (!out.includes(specialty)) out.push(specialty);
  }
  return out;
}

/** The sentence, lowercased with apostrophes removed, for the mandatory/urgent regexes. */
function normalise(text: string): string {
  return text.toLowerCase().replace(/['’]/g, "").replace(/\s+/g, " ");
}

/**
 * Phrases that make a constraint MANDATORY. Read as a regex over the normalised sentence, with
 * the matched cue phrase allowed inflection and up to three words between: "I need a female
 * doctor", "must speak Greek", "women only", "has to be by telehealth".
 */
const MANDATORY_LEAD = "(?:must|only|has to be|have to be|needs? to be|need an?|needs an?|only wants?|only see|only want to see|only with)";

export function isMandatory(text: string, phrase: string): boolean {
  const normalised = normalise(text);
  const words = phrase
    .toLowerCase()
    .replace(/['’]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => `${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\w*`);
  if (words.length === 0) return false;
  const cue = words.join("\\W+(?:\\w+\\W+){0,2}?");
  const lead = new RegExp(`\\b${MANDATORY_LEAD}\\W+(?:\\w+\\W+){0,3}?\\b${cue}`);
  const trail = new RegExp(`\\b${cue}\\W+only\\b`);
  return lead.test(normalised) || trail.test(normalised);
}

/** Whether any cue in a yaml list is present (`phrasePresent`: tokeniser plus the collapse rule). */
function anyCue(text: string, cues: readonly string[]): boolean {
  return cues.some((cue) => phrasePresent(text, cue));
}

/** Emergency → urgent (yaml `constraints.urgent`) → routine. */
export function urgencyOf(text: string, lexicon: Lexicon): Intent["urgency"] {
  if (isEmergency(text, lexicon)) return "emergency";
  return anyCue(text, lexicon.discipline.constraints.urgent ?? []) ? "urgent" : "routine";
}

/** Preference order when a sentence names more than one population: the specific before the default. */
const POPULATION_PRIORITY: readonly Population[] = ["perinatal", "infant", "child", "adolescent", "older-adult", "adult"];

export function readPopulation(text: string, discipline: Discipline): Population | undefined {
  const hit = new Set<Population>();
  for (const group of discipline.populations) if (anyCue(text, group.cues)) hit.add(group.id);
  return POPULATION_PRIORITY.find((population) => hit.has(population));
}

/**
 * The structured intent (plan Task 5: "convert free text into structured search intent").
 * Everything is derived from the discipline yaml through the ported reader; `signals` are the
 * ranker's own need signals, returned so a caller can see which cue reached which facet.
 */
export function extractIntent(text: string, lexicon: Lexicon): { intent: Intent; signals: NeedSignal[] } {
  const discipline = lexicon.discipline;
  const spoken = matchableLanguages(lexicon);
  const signals = [...readNeeds(text, lexicon), ...languageNeeds(text, spoken, lexicon)];
  const conditions: string[] = [];
  const manner: string[] = [];
  const constraints: Intent["constraints"] = {};
  const mandatory: NonNullable<Intent["mandatory"]> = [];
  const mandate = (kind: (typeof mandatory)[number], phrase: string) => {
    if (isMandatory(text, phrase) && !mandatory.includes(kind)) mandatory.push(kind);
  };
  for (const signal of signals) {
    const facet = signal.facet;
    if (facet.kind === "care") conditions.push(facet.area);
    else if (facet.kind === "manner") manner.push(facet.trait);
    else if (facet.kind === "language") {
      constraints.language = facet.language.toLowerCase();
      mandate("language", signal.matched);
    } else {
      switch (facet.preference) {
        case "woman-gp":
          constraints.gender = "woman";
          mandate("gender", signal.matched);
          break;
        case "man-gp":
          constraints.gender = "man";
          mandate("gender", signal.matched);
          break;
        case "telehealth-first":
          constraints.telehealth = "preferred";
          break;
        case "bulk-billing":
          constraints.billing = "bulk-bills";
          break;
        case "longer-appointment":
          break;
      }
    }
  }
  const asks = hardAsksOf(text, lexicon);
  if (asks.telehealthOnly) {
    constraints.telehealth = "only";
    mandatory.push("telehealth");
  } else if (anyCue(text, discipline.constraints.in_person ?? [])) {
    constraints.telehealth = "no";
  }
  if (asks.bulkBillingOnly) {
    constraints.billing = "bulk-bills";
    mandatory.push("billing");
  } else if (constraints.billing === undefined && anyCue(text, discipline.constraints.gap_ok ?? [])) {
    constraints.billing = "gap-ok";
  }
  const normalised = normalise(text);
  const refused = [...new Set(lexicon.refusedCues.filter((cue) => cue.pattern.test(normalised)).flatMap((cue) => cue.refuses))];
  // A single-specialty yaml (psychiatry.yaml names no `specialties` on its conditions) is its
  // own specialty filter: the discipline slug IS the Ahpra specialty, as the ported filter read it.
  const specialties = specialtiesFor(conditions, discipline);
  if (specialties.length === 0 && isSpecialtyField(discipline.slug) && !discipline.conditions.some((c) => c.specialties.length > 0)) {
    specialties.push(discipline.slug);
  }
  const intent: Intent = {
    discipline: discipline.slug,
    specialties,
    conditions,
    constraints,
    mandatory,
    manner,
    humanFit: readHumanFit(text, discipline),
    urgency: urgencyOf(text, lexicon),
    referralInHand: anyCue(text, discipline.constraints.referral_in_hand ?? []),
    refused,
  };
  if (specialties.length === 1) intent.specialty = specialties[0];
  const population = readPopulation(text, discipline);
  if (population) intent.population = population;
  return { intent, signals };
}

/**
 * The Layer-1 hard filters, each with a named reason (PRD §8.1.2 plus plan Task 5). The ported
 * filters are unchanged; wrong-specialty now reads the intent's specialty SET (a roster with no
 * condition asked has no specialty filter), and a MANDATORY gender or language excludes a doctor
 * whose declaration contradicts it. An undeclared gender is not a contradiction (declaration-
 * state.ts): such a doctor passes and ranks below those who declare the asked gender.
 */
export function layer1Filter(
  doctor: Doctor,
  clinician: Clinician,
  intent: Intent,
  asks: { telehealthOnly: boolean; bulkBillingOnly: boolean },
  origin: SuburbPoint | null,
  originState?: string | null,
): FilterReason | null {
  const specialties = intent.specialties ?? [];
  const mandatory = intent.mandatory ?? [];
  if (specialties.length > 0 && !specialties.includes(doctor.specialty)) return "wrong-specialty";
  if (doctor.register && doctor.register.status.value !== "registered") return "registration-not-current";
  if (doctor.capacity.value === "closed") return "closed-books";
  if (asks.bulkBillingOnly && doctor.billing.value !== "bulk-bills" && doctor.billing.value !== "bulk-bills-concession") return "billing-mismatch";
  if (asks.telehealthOnly && doctor.telehealth.value === "none") return "no-telehealth";
  if (mandatory.includes("gender") && intent.constraints.gender && doctor.gender && doctor.gender.value !== intent.constraints.gender) {
    return "gender-mismatch";
  }
  if (mandatory.includes("language") && intent.constraints.language) {
    const wanted = intent.constraints.language;
    if (!clinician.languages.some((language) => language.toLowerCase() === wanted)) return "language-mismatch";
  }
  if (origin && doctor.telehealth.value === "none") {
    const km = nearestKm(clinician, origin);
    if (km !== null && km > REACH_KM) return "out-of-reach";
  }
  if (outOfState(doctor, clinician, origin, originState)) return "out-of-state";
  return null;
}

/**
 * Every state (2026-10-24). A provider whose declared reach leaves out the person's state does not
 * see them, by telehealth or otherwise: an ADHD prescriber's authority is state by state, and a
 * Queensland GP's "telehealth" is telehealth to Queenslanders. Rooms within REACH_KM across a
 * border still count (Coolangatta for someone in Tweed Heads). No reach on the record, or an
 * unknown state for the person: nothing to check, so nothing is excluded.
 */
export function outOfState(doctor: Doctor, clinician: Clinician, origin: SuburbPoint | null, originState: string | null | undefined): boolean {
  const states = doctor.reach?.states ?? [];
  if (!originState || states.length === 0 || (states as string[]).includes(originState)) return false;
  const km = origin ? nearestKm(clinician, origin) : null;
  return km === null || km > REACH_KM;
}

function conditionLabel(id: string, discipline: Discipline): string {
  return discipline.conditions.find((condition) => condition.id === id)?.label ?? id;
}

/**
 * The clinical-fit verdict for one surviving doctor. Reasons are closed vocabulary and each
 * names the field it rests on; the band is read straight from the declarations.
 */
export function clinicalFitFor(doctor: Doctor, intent: Intent, discipline: Discipline): ClinicalFit {
  const reasons: Reason[] = [];
  const often = doctor.conditions.value;
  const sometimes = doctor.conditionsSometimes?.value ?? [];
  let documented = false;
  for (const id of intent.conditions) {
    if (often.includes(id)) {
      documented = true;
      reasons.push({ text: `Declares ${conditionLabel(id, discipline)} as a condition they see`, field: "conditions", label: id, tier: doctor.conditions.tier });
    } else if (sometimes.includes(id)) {
      documented = true;
      reasons.push({ text: `Sees ${conditionLabel(id, discipline)} sometimes`, field: "conditionsSometimes", label: id, tier: doctor.conditionsSometimes!.tier });
    }
  }
  const specialty = SPECIALTY_LABELS[doctor.specialty];
  if (intent.conditions.length === 0) {
    reasons.push({ text: `Listed under ${specialty}`, field: "specialty", label: doctor.specialty });
  } else if (!documented) {
    const treated = intent.conditions.filter((id) => (discipline.conditions.find((c) => c.id === id)?.specialties ?? []).includes(doctor.specialty));
    const named = treated.length > 0 ? conditionLabel(treated[0]!, discipline) : conditionLabel(intent.conditions[0]!, discipline);
    reasons.push({
      text: `Listed under ${specialty}, which treats ${named}; no documented focus on it yet`,
      field: "specialty",
      label: doctor.specialty,
    });
  }
  if (intent.population && doctor.populations.value.includes(intent.population)) {
    reasons.push({ text: `Sees ${POPULATION_LABELS[intent.population]}`, field: "populations", label: intent.population, tier: doctor.populations.tier });
  }
  const band: ClinicalFit["band"] = intent.conditions.length === 0 ? "listed" : documented ? "documented" : "plausible";
  return { band, reasons };
}

/** Stable key for the facet signals an intent was built from, for tests. */
export function signalKeys(signals: readonly NeedSignal[]): string[] {
  return signals.map((signal) => facetKey(signal.facet));
}
