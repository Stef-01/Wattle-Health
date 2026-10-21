// Where the person is. The hand-written gazetteer first (src/geo/suburbs.ts), then the rooms in
// the roster itself: a suburb with geocoded consulting rooms is a point we can honestly use.
import "@/src/geo/national";
import { resolvePlace, stateOfPostcode } from "@/src/geo/suburbs";
import type { Place } from "@/src/matching/types";
import type { DoctorRecord } from "./types";

const ALIASES: Record<string, string> = { brisbane: "Brisbane City", "gold coast": "Southport", "sunshine coast": "Maroochydore" };

export function resolveSuburb(input: string, doctors: readonly DoctorRecord[]): Place | null {
  const typed = input.trim();
  if (!typed) return null;
  const alias = ALIASES[typed.toLowerCase()];
  const fromTable = resolvePlace(alias ?? typed);
  if (fromTable) return { suburb: fromTable.suburb, state: (fromTable.state ?? stateOfPostcode(fromTable.postcode) ?? "QLD") as Place["state"], lat: fromTable.lat, lng: fromTable.lon };
  const key = (alias ?? typed).toLowerCase().replace(/,?\s*(qld|queensland|nsw|vic|wa|sa|tas|nt|act)\s*$/i, "").trim();
  const postcode = /^\d{4}$/.test(key) ? key : null;
  for (const d of doctors) {
    for (const r of d.rooms) {
      if (r.lat === null || r.lng === null) continue;
      if (r.suburb.toLowerCase() === key || (postcode && r.postcode === postcode)) {
        return { suburb: r.suburb, state: r.state as Place["state"], lat: r.lat, lng: r.lng };
      }
    }
  }
  return null;
}
