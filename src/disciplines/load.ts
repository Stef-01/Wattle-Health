// Loads disciplines/<slug>.yaml into a typed Discipline. PRD §8.1 step 1:
// the vocabulary is closed, so the loader is strict: duplicate ids and empty
// cue lists are configuration bugs and throw at load time.
import { readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import { isSpecialtyField, type Population, type SpecialtyField } from "@/src/matching/types";

export interface CueGroup {
  id: string;
  label: string;
  cues: string[];
}

/** A condition with the specialties that appropriately treat it (`conditions[].specialties`). */
export interface ConditionGroup extends CueGroup {
  /** Empty when the yaml names none: the condition then puts no specialty filter on the roster. */
  specialties: SpecialtyField[];
  /** yaml `prescriber: true`: care needs a medical prescriber, so doctors rank above allied providers (src/matching/index.ts). */
  prescriber?: boolean;
}

export interface PopulationCues {
  id: Population;
  cues: string[];
  /** Inclusive lower bound, exclusive upper bound, in years. */
  age?: [number, number];
}

export interface RefusedCue {
  /** Regex source, applied to the normalised sentence. */
  pattern: string;
  /** Vocabulary ids that must not be matched positively when the pattern hits. */
  refuses: string[];
  /** Constraint values the pattern sets, e.g. { gender: "woman" }. */
  sets: Record<string, string>;
}

export interface Discipline {
  slug: string;
  label: string;
  populations: PopulationCues[];
  conditions: ConditionGroup[];
  approaches: CueGroup[];
  manner: CueGroup[];
  /** Preference cues → closed human-fit labels (yaml `human_fit`). Read by Layer 2; empty when the yaml has none. */
  humanFit: CueGroup[];
  /** Constraint facet (telehealth_only, bulk_bills, woman, ...) to cue phrases. */
  constraints: Record<string, string[]>;
  refusedCues: RefusedCue[];
  emergencyCues: string[];
  /** Language id to cue phrases. */
  languages: Record<string, string[]>;
  forbiddenPublicTerms: string[];
}

const POPULATIONS: Population[] = ["infant", "child", "adolescent", "adult", "older-adult", "perinatal"];

function strings(value: unknown, where: string): string[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${where}: empty cues`);
  return value.map((v) => {
    const s = String(v).trim();
    if (!s) throw new Error(`${where}: blank cue`);
    return s;
  });
}

function groups(value: unknown, where: string): CueGroup[] {
  if (!Array.isArray(value)) throw new Error(`${where}: expected a list`);
  const seen = new Set<string>();
  return value.map((raw) => {
    const item = raw as { id?: unknown; label?: unknown; cues?: unknown };
    const id = String(item.id ?? "");
    if (!id) throw new Error(`${where}: entry without id`);
    if (seen.has(id)) throw new Error(`${where}: duplicate id "${id}"`);
    seen.add(id);
    return { id, label: String(item.label ?? id), cues: strings(item.cues, `${where}.${id}`) };
  });
}

function record(value: unknown, where: string): Record<string, string[]> {
  if (!value || typeof value !== "object") throw new Error(`${where}: expected a map`);
  const out: Record<string, string[]> = {};
  for (const [key, cues] of Object.entries(value as Record<string, unknown>)) out[key] = strings(cues, `${where}.${key}`);
  return out;
}

function conditionGroups(value: unknown, where: string): ConditionGroup[] {
  const base = groups(value, where);
  return base.map((group, i) => {
    const item = (value as { specialties?: unknown; prescriber?: unknown }[])[i];
    const raw = item?.specialties;
    const specialties: SpecialtyField[] = [];
    if (raw !== undefined) {
      if (!Array.isArray(raw)) throw new Error(`${where}.${group.id}: specialties must be a list`);
      for (const item of raw) {
        if (!isSpecialtyField(item)) throw new Error(`${where}.${group.id}: unknown specialty "${String(item)}"`);
        if (!specialties.includes(item)) specialties.push(item);
      }
    }
    return item?.prescriber === true ? { ...group, specialties, prescriber: true } : { ...group, specialties };
  });
}

export function parseDiscipline(text: string): Discipline {
  const doc = parse(text) as Record<string, unknown>;
  if (!doc || typeof doc !== "object") throw new Error("discipline: empty document");
  const slug = String(doc.slug ?? "");
  if (!slug) throw new Error("discipline: missing slug");

  const populations = groups(doc.populations, "populations").map((g, i) => {
    if (!POPULATIONS.includes(g.id as Population)) throw new Error(`populations: unknown id "${g.id}"`);
    const age = (doc.populations as { age?: unknown }[])[i]?.age;
    const out: PopulationCues = { id: g.id as Population, cues: g.cues };
    if (Array.isArray(age) && age.length === 2) out.age = [Number(age[0]), Number(age[1])];
    return out;
  });

  const refusedCues = ((doc.refused_cues as unknown[]) ?? []).map((raw, i) => {
    const item = raw as { pattern?: unknown; refuses?: unknown; sets?: unknown };
    const pattern = String(item.pattern ?? "");
    if (!pattern) throw new Error(`refused_cues[${i}]: missing pattern`);
    new RegExp(pattern); // throws on an invalid pattern
    const refuses = Array.isArray(item.refuses) ? item.refuses.map(String) : [];
    const sets = item.sets && typeof item.sets === "object" ? Object.fromEntries(Object.entries(item.sets).map(([k, v]) => [k, String(v)])) : {};
    if (refuses.length === 0 && Object.keys(sets).length === 0) throw new Error(`refused_cues[${i}]: refuses nothing and sets nothing`);
    return { pattern, refuses, sets };
  });

  const emergencyCues = strings(doc.emergency_cues, "emergency_cues");
  for (const cue of emergencyCues) new RegExp(cue);

  const languagesDoc = (doc.languages as { cues?: unknown } | undefined)?.cues ?? {};

  return {
    slug,
    label: String(doc.label ?? slug),
    populations,
    conditions: conditionGroups(doc.conditions, "conditions"),
    approaches: groups(doc.approaches, "approaches"),
    manner: groups(doc.manner, "manner"),
    humanFit: doc.human_fit === undefined ? [] : groups(doc.human_fit, "human_fit"),
    constraints: record(doc.constraints ?? {}, "constraints"),
    refusedCues,
    emergencyCues,
    languages: record(languagesDoc, "languages"),
    forbiddenPublicTerms: Array.isArray(doc.forbidden_public_terms) ? doc.forbidden_public_terms.map(String) : [],
  };
}

export function loadDiscipline(slug: string, root: string = process.cwd()): Discipline {
  const file = path.join(root, "disciplines", `${slug}.yaml`);
  const discipline = parseDiscipline(readFileSync(file, "utf8"));
  if (discipline.slug !== slug) throw new Error(`${file}: slug "${discipline.slug}" does not match file name`);
  return discipline;
}
