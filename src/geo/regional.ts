// Regional Queensland centroids (added 2026-10-17 for the fourth research sweep). Same resolution
// claim as suburbs.ts: a few hundred metres.
import type { SuburbPoint } from "./suburbs";

export const REGIONAL: readonly SuburbPoint[] = [
  { suburb: "Cairns", postcode: "4870", lat: -16.9203, lon: 145.771 },
  { suburb: "Earlville", postcode: "4870", lat: -16.95, lon: 145.733 },
  { suburb: "Smithfield", postcode: "4879", lat: -16.837, lon: 145.689 },
  { suburb: "Townsville", postcode: "4810", lat: -19.259, lon: 146.8169 },
  { suburb: "Hyde Park", postcode: "4812", lat: -19.2770, lon: 146.7960 },
  { suburb: "Toowoomba", postcode: "4350", lat: -27.5606, lon: 151.9539 },
  { suburb: "East Toowoomba", postcode: "4350", lat: -27.57, lon: 151.97 },
  { suburb: "Mackay", postcode: "4740", lat: -21.143, lon: 149.186 },
  { suburb: "Rockhampton", postcode: "4700", lat: -23.378, lon: 150.51 },
  { suburb: "Bokarina", postcode: "4575", lat: -26.738, lon: 153.129 },
];
