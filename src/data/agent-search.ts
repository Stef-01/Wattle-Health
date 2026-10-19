// The search as an assistant (ChatGPT, Claude) sees it: the same matcher and highlights, flattened
// to plain JSON with each doctor's own words, highlights and a link. Used by /api/mcp and
// /api/gpt/search. Server only.
import { doctorHref } from "./doctor-slug";
import { getDoctor, getDoctors, mvpDiscipline } from "./providers";
import { searchWith } from "./search-core";

const ORIGIN = process.env.NEXT_PUBLIC_SITE_URL ?? "https://wattlehealth.vercel.app";

const hobbiesOf = (h: string | string[] | undefined) => (Array.isArray(h) ? h : h ? [h] : []);

export async function agentSearch(sentence: string, suburb?: string) {
  const res = searchWith(await getDoctors(), mvpDiscipline(), { sentence: sentence.slice(0, 1200), suburb: suburb || "Brisbane" });
  return {
    understood: res.chips.map((c) => c.label),
    note: res.emergency?.note ?? res.careGuidance ?? null,
    matches: res.cards.slice(0, 3).map((c) => {
      const d = c.doctor;
      const room = d.rooms.find((r) => r.state === "QLD") ?? d.rooms[0];
      return {
        id: d.id,
        name: d.name.display,
        specialty: d.specialty,
        practice: room?.name ?? null,
        suburb: room?.suburb ?? null,
        distance_km: c.distanceKm ?? null,
        in_their_words: d.personal?.philosophyOfCare ?? d.personal?.philosophy ?? null,
        outside_the_clinic: hobbiesOf(d.personal?.hobbies),
        highlights: (c.highlights ?? []).map((h) => ({ label: h.label, detail: h.detail ?? null, matches_request: h.matched })),
        telehealth: d.declared.telehealth ? d.telehealth.value : "not listed",
        referral_needed: d.referralRequired?.value ?? null,
        phone: room?.phone ?? null,
        source: d.personal?.sourceUrl ?? d.sources[0]?.sourceUrl ?? null,
        url: `${ORIGIN}${doctorHref(d.id)}`,
      };
    }),
    disclaimer: "Wattle lists facts each doctor or their practice published, with sources. It does not give medical advice. In an emergency call 000.",
  };
}

export async function agentDoctor(id: string) {
  const d = await getDoctor(id);
  if (!d) return null;
  return { id: d.id, name: d.name.display, specialty: d.specialty, personal: d.personal ?? null, conditions: d.conditions.value, rooms: d.rooms, url: `${ORIGIN}${doctorHref(d.id)}` };
}
