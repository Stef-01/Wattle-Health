// Ported from adhd.me/src/geo/suburbs.ts on 2026-10-15.
// W211: where the practices are, and how far that is from the person searching.
//
//
// WHY THIS REPLACED A STRING. Every clinician carried a hardcoded `distance` like "4.8 km away",
// which is a distance from nowhere in particular. It rendered beside a match reason as though it
// had been calculated for the reader, and it had not: the same 4.8 km showed to somebody in the
// next street and somebody two suburbs over. On a directory whose whole promise is "a practice you
// can get to", a fabricated distance is the worst kind of wrong, because it is actionable.
//
// SUBURB, NOT ADDRESS, AND NOT THE DEVICE'S LOCATION. Two deliberate limits:
//
//   The person types a suburb or postcode. Nothing asks for geolocation, so there is no permission
//   prompt, no coordinate leaving the device and no location in any log. W183 makes the same call
//   for the clinician side: a suburb answers the question a patient is actually asking, and
//   precision beyond the question is disclosure without purpose.
//
//   Distances are STRAIGHT LINE and the surfaces say "about". A real travel time depends on the
//   train line, and a product that printed "12 min" without knowing the timetable would be making
//   the same fabricated-precision mistake in a new unit.
//
// THE TABLE IS SMALL AND HAND-WRITTEN because the roster covers a handful of focus areas — Beecroft
// in northern Sydney, the eastern suburbs, the Gold Coast, and inner Brisbane (O252). A real deployment reads this from a gazetteer;
// the shape of the lookup is what matters here, and the test pins that every suburb a clinician
// claims is present, so a new practice in an unlisted suburb fails the suite rather than silently
// ranking last. The two areas are hundreds of kilometres apart on purpose: distances are always
// computed within an area, and a search resolves to whichever point the person names.

import { BRISBANE } from "./brisbane";
import { REGIONAL } from "./regional";
import { GOLD_COAST } from "./gold-coast";

export interface SuburbPoint {
  suburb: string;
  postcode: string;
  lat: number;
  lon: number;
}

/** Approximate centroids. Good to a few hundred metres, which is the resolution being claimed. */
export const SUBURBS: readonly SuburbPoint[] = [
  // Focus area 1 — Beecroft and its neighbours, northern Sydney, NSW.
  { suburb: "Beecroft", postcode: "2119", lat: -33.7503, lon: 151.0586 },
  // O85: Dr Anu Saxena's second consulting location (founder-supplied 2026-08-20).
  { suburb: "Hornsby", postcode: "2077", lat: -33.7045, lon: 151.0993 },
  { suburb: "Cheltenham", postcode: "2119", lat: -33.7447, lon: 151.0778 },
  { suburb: "Pennant Hills", postcode: "2120", lat: -33.7383, lon: 151.0719 },
  { suburb: "Epping", postcode: "2121", lat: -33.7726, lon: 151.0817 },
  // Focus area 3 — Sydney eastern suburbs, NSW (O34: Bay Health Clinic, Double Bay).
  { suburb: "Double Bay", postcode: "2028", lat: -33.8775, lon: 151.2437 },
  { suburb: "Edgecliff", postcode: "2027", lat: -33.8790, lon: 151.2360 },
  { suburb: "Rose Bay", postcode: "2029", lat: -33.8710, lon: 151.2700 },
  { suburb: "Bondi Junction", postcode: "2022", lat: -33.8912, lon: 151.2469 },
  // O252: Wellness Psychology Clinic is registered in Sydney and sees everybody by video, so the
  // point is the practice's own locality rather than rooms anybody travels to. It earns its place
  // twice over: "Sydney" is the single most likely thing a person in NSW types into the place
  // field, and until now it resolved to nothing at all.
  { suburb: "Sydney", postcode: "2000", lat: -33.8688, lon: 151.2093 },
  // Focus area 2 — the Gold Coast, QLD: every suburb, from `./gold-coast` (O251).
  ...GOLD_COAST,
  ...BRISBANE,
  ...REGIONAL,
  // Focus area 4 — inner Brisbane, QLD (O252): GOALS Psychology, Fortitude Valley. Brisbane City
  // already sat in the Gold Coast table as a place people type; this is a room somebody visits.
  { suburb: "Fortitude Valley", postcode: "4006", lat: -27.4570, lon: 153.0340 },
];

const byName = new Map(SUBURBS.map((s) => [s.suburb.toLowerCase(), s]));

/** Trailing state names and country, commas and doubled spaces — the noise around a place name. */
const STATE_WORDS = /\b(nsw|qld|vic|wa|sa|tas|nt|act|new south wales|queensland|australia)\b/g;
const normalise = (input: string): string =>
  input.toLowerCase().replace(/,/g, " ").replace(STATE_WORDS, " ").replace(/\s+/g, " ").trim();

/**
 * Resolve what somebody typed to a point, or null.
 *
 * Exact on the suburb name, or a four-digit postcode anywhere in what was typed — "4220",
 * "Burleigh Heads 4220", "Southport QLD", "Coolangatta, 4225" all resolve; a state name and a
 * comma are noise, not meaning. No fuzzy matching, for W189's reason: a near-miss silently
 * becoming a hit is the product deciding what somebody meant, and here it would send them to the
 * wrong side of the country. What a person half-typed is `suggestPlaces`'s job — a list they
 * choose from, never a guess made for them. An unresolved input is reported as unresolved so the
 * surface can say so.
 *
 * A postcode can cover several suburbs. When the typed text also names one of them, that one;
 * otherwise the first, and the caller shows which (the surface prints "Suburb (postcode)"),
 * because silently picking one of four and not saying is the same guess in a quieter voice.
 */
export function resolvePlace(input: string): SuburbPoint | null {
  const cleaned = normalise(input);
  if (!cleaned) return null;
  const exact = byName.get(cleaned);
  if (exact) return exact;
  const postcode = /(?:^|\s)(\d{4})(?:\s|$)/.exec(cleaned)?.[1];
  if (postcode) {
    const named = SUBURBS.find((s) => s.postcode === postcode && cleaned.includes(s.suburb.toLowerCase()));
    return named ?? SUBURBS.find((s) => s.postcode === postcode) ?? null;
  }
  return null;
}

/**
 * A place named inside a sentence ("ADHD assessment, Sydney"): the longest gazetteer name that appears as whole
 * words, or null. Used only when no suburb was given, so a typed suburb always wins.
 */
export function placeInSentence(sentence: string): SuburbPoint | null {
  const text = ` ${normalise(sentence).replace(/[^a-z0-9 ]/g, " ")} `;
  let best: SuburbPoint | null = null;
  for (const s of SUBURBS) {
    const name = s.suburb.toLowerCase();
    if (name.length >= 5 && text.includes(` ${name} `) && (!best || name.length > best.suburb.length)) best = s;
  }
  return best;
}

/**
 * O251: the places a half-typed input could mean, for the profile's suggestion list.
 *
 * Name prefixes first (what somebody is most likely still typing), then names containing the
 * text, then postcode prefixes — at most `limit`, in gazetteer order within each band. Two
 * characters or more; a single letter would list half the coast. The person picks; nothing here
 * resolves anything on its own.
 */
export function suggestPlaces(input: string, limit = 6): SuburbPoint[] {
  const cleaned = normalise(input);
  if (cleaned.length < 2) return [];
  const bands: SuburbPoint[][] = [[], [], []];
  for (const s of SUBURBS) {
    const name = s.suburb.toLowerCase();
    if (name === cleaned) continue;
    if (name.startsWith(cleaned)) bands[0]!.push(s);
    else if (name.includes(cleaned)) bands[1]!.push(s);
    else if (/^\d{2,4}$/.test(cleaned) && s.postcode.startsWith(cleaned)) bands[2]!.push(s);
  }
  return bands.flat().slice(0, limit);
}

const EARTH_KM = 6371;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in kilometres. Straight line, which is what the copy claims. */
export function distanceKm(a: SuburbPoint, b: SuburbPoint): number {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * How a distance is said out loud.
 *
 * "About" on every one, and never a travel time. Under a kilometre rounds to 100m because the
 * difference between 300m and 900m is a decision and the difference between 8.1km and 8.4km is not.
 */
export function describeDistance(km: number): string {
  if (km < 0.1) return "in your suburb";
  if (km < 1) return `about ${Math.round(km * 10) / 10} km away`;
  return `about ${Math.round(km)} km away`;
}

/** Suburb names for a datalist, so somebody can be shown what is actually covered. */
export function coveredSuburbs(): string[] {
  return SUBURBS.map((s) => s.suburb);
}
