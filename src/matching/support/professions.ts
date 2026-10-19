// Ported from adhd.me/src/support/professions.ts on 2026-10-15 (the label/plural slice
// `rosterNoun` reads). ADHD.ME's eleven allied professions are not carried; Wattle Health
// lists the Ahpra specialties in `src/matching/types.ts` plus the GP the roster noun defaults to.

export const PROFESSIONS = ["gp", "psychiatrist", "paediatrician", "obstetrician-gynaecologist", "psychologist", "occupational-therapist", "allied-health"] as const;
export type Profession = (typeof PROFESSIONS)[number];

export interface ProfessionEntry {
  readonly id: Profession;
  readonly label: string;
  readonly plural: string;
}

export const PROFESSION_ENTRIES: readonly ProfessionEntry[] = [
  { id: "gp", label: "GP", plural: "GPs" },
  { id: "psychiatrist", label: "Psychiatrist", plural: "psychiatrists" },
  { id: "paediatrician", label: "Paediatrician", plural: "paediatricians" },
  { id: "obstetrician-gynaecologist", label: "Obstetrician-gynaecologist", plural: "obstetrician-gynaecologists" },
  { id: "psychologist", label: "Psychologist", plural: "psychologists" },
  { id: "occupational-therapist", label: "Occupational therapist", plural: "occupational therapists" },
  { id: "allied-health", label: "Allied health provider", plural: "allied health providers" },
];

export function isProfession(value: unknown): value is Profession {
  return typeof value === "string" && (PROFESSIONS as readonly string[]).includes(value);
}

export function profession(id: Profession): ProfessionEntry {
  const entry = PROFESSION_ENTRIES.find((p) => p.id === id);
  if (!entry) throw new Error(`unknown profession "${id}"`);
  return entry;
}

/** The specialty slugs in `types.ts`, as the profession noun the roster sentence uses. */
export const PROFESSION_FOR_SPECIALTY: Readonly<Record<string, Profession>> = {
  psychiatry: "psychiatrist",
  paediatrics: "paediatrician",
  "obstetrics-gynaecology": "obstetrician-gynaecologist",
  psychology: "psychologist",
  "occupational-therapy": "occupational-therapist",
  "allied-health": "allied-health",
};
