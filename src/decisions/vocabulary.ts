// The categories the classifier starts from: every group in disciplines/mvp.yaml (the founder's
// closed vocabulary), one category per id. The yaml stays the place to edit these; /admin adds
// reviewed categories on top (engine.ts). Descriptions are written from the yaml's own cues, so a
// category means to the model what it means to the lexical matcher.
import type { Discipline } from "@/src/disciplines/load";
import { keyOf, type Category, type CategoryGroup } from "./types";

const title = (id: string) => id.replace(/[_-]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());
const cues = (list: string[]) => list.slice(0, 8).map((c) => `“${c}”`).join(", ");

const CONSTRAINT_LABELS: Record<string, string> = {
  telehealth_only: "Telehealth only",
  telehealth_preferred: "Prefers telehealth",
  in_person: "Wants in person",
  bulk_bills: "Needs bulk billing",
  gap_ok: "Happy to pay a gap",
  woman: "Wants a woman",
  man: "Wants a man",
  referral_in_hand: "Has a referral",
  urgent: "Urgent",
};

export function vocabularyCategories(d: Discipline): Category[] {
  const out: Category[] = [];
  const add = (group: CategoryGroup, id: string, label: string, description: string) => out.push({ key: keyOf(group, id), group, id, label, description, origin: "vocabulary", active: true });
  for (const c of d.conditions) add("condition", c.id, c.label, `The transcript is about ${c.label}. Said as: ${cues(c.cues)}.`);
  for (const p of d.populations) add("population", p.id, title(p.id), `Care is for ${p.id === "older-adult" ? "an older adult" : `a ${p.id.replace(/-/g, " ")}`}${p.age ? `, about ${p.age[0]} to ${p.age[1]} years` : ""}. Said as: ${cues(p.cues)}.`);
  for (const a of d.approaches) add("approach", a.id, a.label, `Wants or describes ${a.label.toLowerCase()} care. Said as: ${cues(a.cues)}.`);
  for (const m of d.manner) add("manner", m.id, m.label, `Wants, or the clinician shows, a ${m.label.toLowerCase()} manner. Said as: ${cues(m.cues)}.`);
  for (const h of d.humanFit) add("human_fit", h.id, h.label, `Human fit: ${h.label.toLowerCase()}. Said as: ${cues(h.cues)}.`);
  for (const [id, list] of Object.entries(d.constraints)) add("constraint", id, CONSTRAINT_LABELS[id] ?? title(id), `A practical need: ${(CONSTRAINT_LABELS[id] ?? title(id)).toLowerCase()}. Said as: ${cues(list)}.`);
  return out;
}
