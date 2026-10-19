// Shared contract between the matcher, the UI and the pipeline.
// PRD §7 (profile tiers) and §8 (pipeline). Every field here is a declaration
// with a source tier; nothing is a verification unless tier === "register".

export type Tier = "register" | "declared" | "found";

export interface Observed<T> {
  value: T;
  tier: Tier;
  /** Source id from the `sources` registry, e.g. "ahpra", "ranzcp-find", "practice-site", "claim". */
  source: string;
  sourceUrl?: string;
  /** ISO date the fact was observed or declared. */
  observedAt: string;
  /** ISO date after which the fact falls back to the next tier. */
  expiresAt?: string;
}

/**
 * The specialties the roster holds today and the data layer keys its tables on. A doctor's
 * `specialty` is one of these. The last three are held only by illustrative (fictional) profiles
 * in data/illustrative/ until real general-practice, pain and rheumatology records are ingested.
 */
export type Specialty =
  | "psychiatry"
  | "paediatrics"
  | "obstetrics-gynaecology"
  | "general-practice"
  | "pain-medicine"
  | "rheumatology"
  | AlliedSpecialty;

/**
 * Allied health and coaching providers (founder 2026-10-19: "add in all providers not just GPs").
 * Not Ahpra medical specialties and never prescribers: `psychology` (every psychologist,
 * registered, clinical, provisional), `occupational-therapy`, and `allied-health` for the rest
 * (coaches, dietitians, physiotherapists, exercise physiologists, social workers, counsellors,
 * therapy assistants, neurotherapy). The record's `profession` carries the title they use.
 */
export const ALLIED_SPECIALTIES = ["psychology", "occupational-therapy", "allied-health"] as const;
export type AlliedSpecialty = (typeof ALLIED_SPECIALTIES)[number];

export function isAllied(specialty: string): specialty is AlliedSpecialty {
  return (ALLIED_SPECIALTIES as readonly string[]).includes(specialty);
}

/**
 * Every Ahpra specialty / field of specialty practice the cross-specialty vocabulary
 * (disciplines/mvp.yaml) may name under `conditions[].specialties`. A superset of `Specialty`:
 * the Layer-1 filter keeps a doctor whose `specialty` is in the asked set, so a field with no
 * doctors listed yet simply never passes anyone. Widening `Doctor.specialty` to this type is
 * the data layer's call once its per-specialty records are keyed on it.
 */
export const SPECIALTY_FIELDS = [
  "psychiatry",
  "paediatrics",
  "obstetrics-gynaecology",
  "general-practice",
  "pain-medicine",
  "rheumatology",
  "rehabilitation-medicine",
  "neurology",
  "gastroenterology",
  "endocrinology",
  "immunology-allergy",
  "cardiology",
  "respiratory-sleep-medicine",
  "infectious-diseases",
  "clinical-genetics",
  ...ALLIED_SPECIALTIES,
] as const;

export type SpecialtyField = (typeof SPECIALTY_FIELDS)[number];

export function isSpecialtyField(value: unknown): value is SpecialtyField {
  return typeof value === "string" && (SPECIALTY_FIELDS as readonly string[]).includes(value);
}

/**
 * What a doctor says about themselves beyond the clinical record (plan Task 4). Read by Layer 2
 * only. `status` says whether the doctor approved these words or whether the profile is an
 * illustrative example; a surface labels each accordingly and the human-fit explanation carries
 * it as `basis`. Free text (philosophy, whyMedicine, purpose) is mapped to closed labels at
 * BUILD time by src/matching/personal-labels.ts and stored in `labels`; the request path reads
 * labels only.
 */
export interface PersonalProfile {
  /** Free text, mapped to `labels` at build time. Either spelling is read; the data layer writes the long one. */
  philosophy?: string;
  philosophyOfCare?: string;
  whyMedicine?: string;
  purpose?: string;
  professionalPurpose?: string;
  /** Patient concerns and populations the doctor reports enjoying serving (closed vocabulary: condition ids, population ids). */
  enjoysServing?: string[];
  /** Consultation and communication approach, as closed `human_fit` labels from the discipline yaml. */
  communication?: string[];
  /** The same, as the doctor wrote it; labelled at build time like the philosophy. */
  communicationApproach?: string;
  /** Voluntarily shared lived experience, in the doctor's own words. Presence is the signal; the words are never matched. */
  livedExperience?: string | string[];
  hobbies?: string | string[];
  outsideMedicine?: string;
  /** Healthspan work in the doctor's own words (2026-10-19): areas they cover, data they say they welcome, and the sentence that says so. */
  healthspan?: { areas: string[]; opensTo: string[]; evidence: string };
  /** Closed `human_fit` labels derived from the free-text fields at build time (personal-labels.ts). */
  labels?: string[];
  /**
   * `draft` is unpublished (no consent yet) and reads as no profile. `published` is the doctor's
   * own words as they put them on their practice website (found tier): real, attributed to
   * `sourceUrl`, and never edited beyond trimming.
   */
  status: "draft" | "doctor-approved" | "illustrative" | "published";
  approvedAt?: string;
  /** For `published`: where the words were found, and when. */
  sourceUrl?: string;
  sourceName?: string;
  observedAt?: string;
  /** Short verbatim passages (under 60 words) from the same page, each tagged with what it is about. */
  quotes?: { text: string; about: "hobbies" | "why" | "approach" | "lived" | "other" }[];
}

export type Population = "infant" | "child" | "adolescent" | "adult" | "older-adult" | "perinatal";

export type Telehealth = "none" | "some" | "first-appointment" | "only";

export type Billing = "bulk-bills" | "bulk-bills-concession" | "gap" | "private" | "unknown";

export type Capacity = "open" | "waitlist" | "closed" | "unknown";

export type Gender = "woman" | "man" | "non-binary";

export interface Location {
  id: string;
  name: string;
  suburb: string;
  state: "NSW" | "VIC" | "QLD" | "WA" | "SA" | "TAS" | "ACT" | "NT";
  postcode: string;
  lat: number;
  lng: number;
  phone?: Observed<string>;
  website?: Observed<string>;
  wheelchair?: Observed<boolean>;
  /** Appointments at this location are telehealth only (no physical attendance). */
  telehealthOnly?: boolean;
}

export interface Doctor {
  id: string;
  /** Example profiles are fictional and labelled on every surface. Exactly one of these is true. */
  realPerson: boolean;
  synthetic: boolean;
  name: { given: string; family: string; display: string };
  specialty: Specialty;
  /** The title the provider uses, e.g. "Clinical psychologist" or "ADHD coach". Display only: matching reads `specialty`. */
  profession?: string;
  /** Ahpra register fields. Absent on synthetic profiles. */
  register?: {
    ahpraNumber: Observed<string>;
    status: Observed<"registered" | "limited" | "provisional" | "suspended" | "non-practising">;
    fieldOfPractice?: Observed<string[]>;
    endorsements?: Observed<string[]>;
    /** True/false only. The text of conditions is never stored or shown. */
    conditionsApply: Observed<boolean>;
    languages?: Observed<string[]>;
    qualifications?: Observed<string[]>;
    registerUrl: string;
  };
  gender?: Observed<Gender>;
  languages?: Observed<string[]>;
  /** Closed vocabulary from disciplines/<specialty>.yaml. */
  conditions: Observed<string[]>;
  conditionsSometimes?: Observed<string[]>;
  populations: Observed<Population[]>;
  approaches?: Observed<string[]>;
  manner?: Observed<string[]>;
  telehealth: Observed<Telehealth>;
  billing: Observed<Billing>;
  fees?: Observed<{ label: string; amountCents: number }[]>;
  capacity: Observed<Capacity>;
  waitlistWeeks?: Observed<number>;
  referralRequired?: Observed<boolean>;
  yearsInSpecialty?: Observed<number>;
  locations: Location[];
  booking: { via: "phone" | "website" | "platform" | "none"; url?: string; phone?: string; note?: string };
  disclosures?: { label: string; since: string }[];
  /** Layer-2 inputs (plan Task 4 / Task 6). Absent means "no personal profile yet": neutral, never a penalty. */
  personal?: PersonalProfile;
  /** Inferred research topics from verified publications, as condition ids from the discipline yaml. Observed-wrapped when the source is known. */
  researchTopics?: Observed<string[]> | string[];
  /** Documented clinical interests from permitted sources, as condition ids from the discipline yaml. */
  clinicalInterests?: Observed<string[]> | string[];
}

export interface Intent {
  /** The discipline slug the sentence was read under; `rerank` resolves its vocabulary from this. */
  discipline?: string;
  specialty?: SpecialtyField;
  /** Every specialty that appropriately treats one of `conditions` (yaml `conditions[].specialties`). Empty or absent: no specialty filter. */
  specialties?: SpecialtyField[];
  conditions: string[];
  population?: Population;
  constraints: {
    language?: string;
    gender?: Gender;
    telehealth?: "only" | "preferred" | "no";
    billing?: "bulk-bills" | "gap-ok";
    maxKm?: number;
  };
  /**
   * Which constraints the sentence made MANDATORY ("must", "only", "has to be", "need a"): these
   * filter. Every other constraint is flexible and ranks (plan Task 5).
   */
  mandatory?: ("language" | "gender" | "telehealth" | "billing")[];
  manner: string[];
  /** Closed `human_fit` labels the sentence reached (yaml `human_fit`). Read by Layer 2 only. */
  humanFit?: string[];
  urgency: "emergency" | "urgent" | "routine";
  referralInHand: boolean;
  /** Vocabulary terms the sentence explicitly refused ("not medication"). Never matched positively. */
  refused: string[];
}

export interface Place {
  suburb: string;
  state: Location["state"];
  lat: number;
  lng: number;
}

export type FilterReason =
  | "wrong-specialty"
  | "closed-books"
  | "wrong-age-group"
  | "billing-mismatch"
  | "no-telehealth"
  | "out-of-reach"
  | "registration-not-current"
  | "gender-mismatch"
  | "language-mismatch";

export type OrderQuality = "informed" | "tied" | "unmatched" | "unserved";

export interface Evidence {
  /** Closed-vocabulary label, never the patient's words. */
  label: string;
  kind: "condition" | "population" | "constraint" | "approach" | "manner" | "capacity" | "reach";
  tier: Tier;
}

/**
 * One sentence of explanation, in closed vocabulary, with the doctor field it rests on. A test
 * fails whenever a reason is emitted whose `field` is absent on the doctor (or, with `label`,
 * whose field does not hold that label): every visible explanation traces to profile evidence
 * (plan Task 8).
 */
export interface Reason {
  text: string;
  /** Dotted path on `Doctor`, e.g. "conditions", "personal.livedExperience", "manner". */
  field: string;
  /** The closed-vocabulary id the field must contain, when the reason is about one entry. */
  label?: string;
  tier?: Tier;
}

/**
 * Layer 1's verdict. `documented`: declares an asked-for condition. `plausible`: the right
 * specialty for it, no documented evidence (ranks below documented, never removed). `listed`:
 * no condition was asked, so the specialty is all there is to say.
 */
export type ClinicalBand = "documented" | "plausible" | "listed";

export interface ClinicalFit {
  band: ClinicalBand;
  reasons: Reason[];
}

export interface HumanFit {
  /** Weighted overlap, 0 when nothing aligns or there is no personal profile. */
  score: number;
  reasons: Reason[];
  /** Where the personal data came from; "none" means no profile and a neutral score. */
  basis: "doctor-approved" | "illustrative" | "published" | "none";
}

export interface Ranked {
  doctor: Doctor;
  score: number;
  /** Tier A..D breakdown for tests and the compare screen. */
  tiers: { access: number; fit: number; manner: number; coverage: number };
  evidence: Evidence[];
  missed: Evidence[];
  headline: string;
  distanceKm?: number;
  clinicalFit: ClinicalFit;
  humanFit: HumanFit;
  /**
   * Where Layer 1 put this doctor: `band` is the tier vector the ranker sorted on (equal band
   * = equal clinical and access fit), `position` the Layer-1 index. Layer 2 reorders inside a
   * band only and breaks human-fit ties on `position`.
   */
  layer1: { band: string; position: number };
}

export interface MatchResult {
  order: OrderQuality;
  /** One sentence under the heading, from a closed copy table. */
  orderNote: string;
  /** The shown slice (RESULTS_SHOWN) of `survivors`, with headlines. */
  results: Ranked[];
  /** Every doctor that passed Layer 1, in Layer-2 order. `rerank()` takes this list, so a surface can move the weights without re-searching. */
  survivors: Ranked[];
  excluded: { doctor: Doctor; reason: FilterReason }[];
  /** For `unserved`: the unmet ask and how many results dropping each filter would restore. */
  unserved?: { ask: string; restoreCount: number }[];
  clarifiers: { facet: string; question: string; options: string[] }[];
  /**
   * Set when the sentence carried an emergency cue (disciplines/<slug>.yaml `emergency_cues`).
   * No results are ranked: `note` is the emergency-services copy the screen shows instead.
   */
  emergency?: { note: string };
  /** What the sentence was read as, so a surface can show its interpretation and let the reader correct it. */
  intent?: Intent;
  /**
   * Set when the sentence carried an urgent (not emergency) cue: care-seeking guidance shown
   * beside the results, pointing to a GP today or healthdirect.
   */
  careGuidance?: string;
}
