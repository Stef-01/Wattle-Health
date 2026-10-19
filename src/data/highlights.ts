// Highlights (2026-10-18): the few facts about a doctor that matter most for THIS patient, ranked,
// computed on the server with each search and returned on the card. Pattern after Zocdoc's
// SearchAI result highlights, without insurance and personalised to what the person said.
// Every highlight is read from the record or the engine's reasons; nothing is invented. Pure.
import type { Intent } from "@/src/matching/types";
import type { DoctorRecord } from "./types";

export type HighlightKind = "clinical" | "approach" | "lived" | "access" | "research" | "personal" | "people";

export interface Highlight {
  id: string;
  kind: HighlightKind;
  /** Short, bold line ("Sees endometriosis"). */
  label: string;
  /** One supporting line, often in the doctor's words ("“I take time to listen…”"). */
  detail?: string;
  /** True when this answers something the person asked for. */
  matched: boolean;
}

const POP_WORDS: Record<string, string> = { child: "children", adolescent: "teenagers", adult: "adults", "older-adult": "older adults", perinatal: "new and expecting parents" };
const APPROACH_WORDS: Record<string, string> = {
  listens: "Takes time to listen",
  collaborative: "Decides with you, not for you",
  "evidence-based": "Evidence-based",
  holistic: "Looks at the whole person",
  gentle: "Gentle and unhurried",
  direct: "Straight answers",
  "long-appointments": "Longer appointments",
  "trauma-informed": "Trauma-informed",
  "neurodiversity-affirming": "Neurodiversity-affirming",
  "lgbtq-affirming": "LGBTQ+ affirming",
  "culturally-safe": "Culturally safe",
  "research-active": "Research active",
  "lived-experience": "Has lived experience",
};

const clip = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1).replace(/\s+\S*$/, "")}…` : t);
const list = (v: string | string[] | undefined) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

export function highlightsFor(d: DoctorRecord, intent: Intent | undefined, labels: Record<string, string>): Highlight[] {
  const out: Highlight[] = [];
  const add = (h: Highlight) => {
    if (!out.some((o) => o.id === h.id || o.label === h.label)) out.push(h);
  };
  const p = d.personal && d.personal.status !== "draft" ? d.personal : null;
  const quotes = p?.quotes ?? [];
  const quoteAbout = (about: string) => quotes.find((q) => q.about === about)?.text;
  const asked = new Set(intent?.conditions ?? []);
  const askedHuman = new Set(intent?.humanFit ?? []);
  const label = (id: string) => labels[id] ?? id.replace(/-/g, " ");

  // 1. The conditions they asked about that this doctor sees.
  for (const id of d.conditions.value) {
    if (asked.has(id)) add({ id: `c:${id}`, kind: "clinical", label: `Sees ${label(id).replace(/^[A-Z](?=[a-z])/, (c) => c.toLowerCase())}`, matched: true });
  }
  // 2. How they work, where it answers what was asked; their own words as the detail.
  const styles = new Set([...(p?.communication ?? []), ...(p?.labels ?? [])]);
  for (const id of askedHuman) {
    if (id === "lived-experience") continue;
    if (styles.has(id) && APPROACH_WORDS[id]) add({ id: `a:${id}`, kind: "approach", label: APPROACH_WORDS[id]!, detail: quoteAbout("approach") ? `“${clip(quoteAbout("approach")!, 110)}”` : undefined, matched: true });
  }
  // 3. Lived experience, when shared (always worth surfacing; matched if asked).
  const lived = list(p?.livedExperience)[0];
  if (lived) add({ id: "lived", kind: "lived", label: "Has lived experience", detail: clip(lived, 120), matched: askedHuman.has("lived-experience") });
  // 4. Who they see, when a population was asked.
  if (intent?.population && d.populations.value.includes(intent.population)) add({ id: `pop:${intent.population}`, kind: "people", label: `Sees ${POP_WORDS[intent.population] ?? intent.population}`, matched: true });
  // 5. Access facts the record declares.
  if (d.declared.telehealth && d.telehealth.value !== "none") add({ id: "tele", kind: "access", label: d.telehealth.value === "only" ? "Telehealth only" : "Offers telehealth", matched: intent?.constraints?.telehealth === "only" || intent?.constraints?.telehealth === "preferred" });
  if (d.declared.capacity && d.capacity.value === "open") add({ id: "open", kind: "access", label: "Taking new patients", matched: false });
  if (styles.has("long-appointments") && !out.some((h) => h.id === "a:long-appointments")) add({ id: "long", kind: "approach", label: "Longer appointments", matched: askedHuman.has("long-appointments") });
  // 6. Research, from identifier-matched publications.
  const papers = d.publications.filter((x) => x.verification === "identifier-matched" || x.verification === "doctor-confirmed");
  if (papers.length > 0) add({ id: "research", kind: "research", label: `${papers.length} published ${papers.length === 1 ? "paper" : "papers"}`, detail: clip(papers[0]!.title, 90), matched: askedHuman.has("research-active") });
  // 7. One personal line: the thing that makes them a person.
  const hobby = list(p?.hobbies)[0];
  if (hobby || p?.outsideMedicine) add({ id: "personal", kind: "personal", label: "Outside the clinic", detail: clip(hobby ? list(p?.hobbies).slice(0, 3).join(", ") : p!.outsideMedicine!, 100), matched: false });
  // 8. Other approach styles they describe, after the asked ones.
  for (const id of styles) if (APPROACH_WORDS[id] && id !== "research-active" && id !== "lived-experience") add({ id: `a:${id}`, kind: "approach", label: APPROACH_WORDS[id]!, matched: false });

  // Matched first, then the order above; personal stays visible near the top.
  const rank = (h: Highlight) => (h.matched ? 0 : h.kind === "personal" ? 1 : h.kind === "lived" ? 1 : 2);
  return out.map((h, i) => ({ h, i })).sort((a, b) => rank(a.h) - rank(b.h) || a.i - b.i).map(({ h }) => h).slice(0, 9);
}
