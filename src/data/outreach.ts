// The outreach queue (2026-10-19). Ordered for demo impact: doctors already published in their own
// words but missing pieces first (one call completes them), then listed doctors with a website,
// then the rest. Each row carries the interview questions for exactly what's missing.
import { completeness } from "./completeness";
import { getDoctors } from "./providers";

export type OutreachRow = { id: string; name: string; specialty: string; suburb: string | null; phone: string | null; website: string | null; status: "published" | "listed"; score: number; questions: string[]; missing: string[] };

export async function outreachQueue(): Promise<OutreachRow[]> {
  const rows: OutreachRow[] = [];
  for (const d of await getDoctors()) {
    const c = completeness(d);
    if (c.missing.length === 0) continue;
    const room = d.rooms[0];
    rows.push({
      id: d.id,
      name: d.name.display,
      specialty: d.specialty,
      suburb: room?.suburb ?? null,
      phone: room?.phone ?? d.booking?.phone ?? null,
      website: room?.website ?? d.personal?.sourceUrl ?? null,
      status: d.personal?.status === "published" ? "published" : "listed",
      score: c.score,
      questions: c.missing.map((m) => m.question),
      missing: c.missing.map((m) => m.label),
    });
  }
  const rank = (r: OutreachRow) => (r.status === "published" ? 0 : r.website ? 1 : 2);
  return rows.sort((a, b) => rank(a) - rank(b) || b.score - a.score || a.name.localeCompare(b.name));
}
