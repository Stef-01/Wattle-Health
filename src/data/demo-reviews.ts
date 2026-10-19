// Demo reviews (founder decision 2026-10-18: "have in demo reviews for now… this is a demo
// platform"). Generated deterministically from each doctor's OWN published themes (how they say they
// work, telehealth, lived experience), so a demo review never says something their page does not.
// Every one is flagged `demo: true` and every surface labels them "Demo reviews, not real patients".
// Turned off with NEXT_PUBLIC_DEMO_REVIEWS=0, and never shown once a doctor has real reviews.
import type { DoctorRecord } from "./types";

export type DemoReview = { id: string; doctor_id: string; rating: number; body: string; visited: string; created_at: string; demo: true };

export const demoReviewsEnabled = () => (process.env.NEXT_PUBLIC_DEMO_REVIEWS ?? "1") !== "0";

function seeded(seed: string) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

const LINES: Record<string, string[]> = {
  listens: ["They really listened and took me seriously from the first appointment.", "I finally felt heard. Nothing was brushed off.", "Listened to the whole story before suggesting anything."],
  collaborative: ["Walked me through the options and we decided on a plan together.", "I felt involved in every decision, not told what to do."],
  "long-appointments": ["The appointment never felt rushed; there was time for all my questions.", "Unhurried and thorough, which made a real difference."],
  holistic: ["Looked at the whole picture, not just the one symptom.", "Asked about sleep, work and stress as well, which helped."],
  gentle: ["Warm and kind, and explained each step before doing it.", "Gentle and calm, which put me at ease straight away."],
  "evidence-based": ["Explained things clearly with the reasons behind each option.", "Clear, practical explanations and a plan that made sense."],
  "lived-experience": ["It helped that they understood what it’s like from the inside.", "You can tell they get it. I didn’t have to over-explain."],
  "neurodiversity-affirming": ["Never made me feel like something was wrong with me. Very affirming.", "Understood how my brain works and adjusted to it."],
  "trauma-informed": ["Asked before every step and checked I was comfortable.", "Felt safe the whole time; they explained everything first."],
  telehealth: ["The telehealth appointment was easy and felt just as personal.", "Being able to see them by video from home made it possible for me."],
  default: ["Explained things clearly and left me with a plan.", "Kind, thorough and easy to talk to.", "Clear next steps and a follow-up that actually happened."],
};
const VISITED = ["this-month", "this-year", "this-year", "earlier"];

export function demoReviewsFor(d: DoctorRecord): DemoReview[] {
  const p = d.personal && d.personal.status !== "draft" ? d.personal : null;
  if (!p) return [];
  const rand = seeded(d.id);
  const themes = [...new Set([...(p.communication ?? []), ...(p.labels ?? [])])].filter((t) => LINES[t]);
  if (p.livedExperience && !themes.includes("lived-experience")) themes.push("lived-experience");
  if (d.declared.telehealth && d.telehealth.value !== "none") themes.push("telehealth");
  if (themes.length === 0) themes.push("default");
  const count = 4 + Math.floor(rand() * 6);
  const out: DemoReview[] = [];
  for (let i = 0; i < count; i++) {
    const a = themes[i % themes.length]!;
    const b = themes[(i + 1 + Math.floor(rand() * themes.length)) % themes.length]!;
    const la = LINES[a]!;
    const lb = LINES[b === a ? "default" : b]!;
    const body = `${la[Math.floor(rand() * la.length)]} ${lb[Math.floor(rand() * lb.length)]}`;
    const rating = rand() < 0.82 ? 5 : 4;
    const day = 3 + Math.floor(rand() * 300);
    out.push({ id: `demo-${d.id}-${i}`, doctor_id: d.id, rating, body, visited: VISITED[Math.floor(rand() * VISITED.length)]!, created_at: new Date(Date.UTC(2026, 9, 18) - day * 86400000).toISOString(), demo: true });
  }
  return out;
}
