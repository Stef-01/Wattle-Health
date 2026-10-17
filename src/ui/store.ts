// Browser-side state. The sentence and the last results live in sessionStorage (gone when the
// tab closes, never in a URL). Saved doctors and the compare pair live in localStorage.
import type { SearchResponse, Weights } from "@/src/data/search-types";
import type { DoctorRecord } from "@/src/data/types";

const ASK = "wattle.ask";
const RESULTS = "wattle.results";
const SAVED = "wattle.saved";
const COMPARE = "wattle.compare";

export interface Ask {
  sentence: string;
  suburb: string;
  removed: string[];
  weights: Weights;
}

function read<T>(storage: () => Storage, key: string): T | null {
  try {
    const raw = storage().getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function write(storage: () => Storage, key: string, value: unknown): void {
  try {
    storage().setItem(key, JSON.stringify(value));
  } catch {
    /* storage may be unavailable; the screen still renders */
  }
}

export const getAsk = () => read<Ask>(() => sessionStorage, ASK);
export const setAsk = (ask: Ask) => write(() => sessionStorage, ASK, ask);
export const getResults = () => read<SearchResponse>(() => sessionStorage, RESULTS);
export const setResults = (r: SearchResponse) => write(() => sessionStorage, RESULTS, r);

export const getSaved = () => read<DoctorRecord[]>(() => localStorage, SAVED) ?? [];
export function toggleSaved(doctor: DoctorRecord): DoctorRecord[] {
  const current = getSaved();
  const next = current.some((d) => d.id === doctor.id) ? current.filter((d) => d.id !== doctor.id) : [...current, doctor];
  write(() => localStorage, SAVED, next);
  return next;
}

export const getCompare = () => read<DoctorRecord[]>(() => localStorage, COMPARE) ?? [];
/** Up to two. Adding a third replaces the oldest. */
export function toggleCompare(doctor: DoctorRecord): DoctorRecord[] {
  const current = getCompare();
  let next: DoctorRecord[];
  if (current.some((d) => d.id === doctor.id)) next = current.filter((d) => d.id !== doctor.id);
  else next = [...current, doctor].slice(-2);
  write(() => localStorage, COMPARE, next);
  return next;
}
export function clearCompare(): void {
  write(() => localStorage, COMPARE, []);
}

/* ------------------------------------------------------------------ patient-a (P01–P05) */
// Keys shared across the Figma patient screens. Saved doctors by id live under `wattle.saved.v1`
// (the other agents read the same key); a search's response is parked in sessionStorage under
// its request id so the sentence never travels in a URL.

export const SAVED_KEY = "wattle.saved.v1";
const NAME = "wattle.name";
const RECENT = "wattle.recent.v1";
const SPLASH = "wattle.splash.seen";
const CURRENT = "wattle.req.current";
const DRAFT = "wattle.draft";

/** Bump when the stored card shape changes; older stored searches are re-run on load. */
export const REQUEST_VERSION = 2;

export interface StoredRequest {
  id: string;
  /** REQUEST_VERSION at the time it was stored; absent on the oldest. */
  v?: number;
  sentence: string;
  suburb: string;
  removed: string[];
  /** Drop the distance origin (the "Brisbane, 20 km" pill was turned off). */
  anywhere?: boolean;
  response: SearchResponse;
  at: string;
}

export interface RecentSearch {
  id: string;
  label: string;
  matches: number;
  at: string;
}

export const getSavedIds = () => read<string[]>(() => localStorage, SAVED_KEY) ?? [];
export const isSavedId = (id: string) => getSavedIds().includes(id);
export function toggleSavedId(id: string): string[] {
  const current = getSavedIds();
  const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
  write(() => localStorage, SAVED_KEY, next);
  return next;
}

export const getName = () => read<string>(() => localStorage, NAME);
export const setName = (name: string) => write(() => localStorage, NAME, name);

export const splashSeen = () => read<boolean>(() => localStorage, SPLASH) === true;
export const markSplashSeen = () => write(() => localStorage, SPLASH, true);

export const getDraft = () => read<string>(() => sessionStorage, DRAFT) ?? "";
export const setDraft = (text: string) => write(() => sessionStorage, DRAFT, text);

export const getRecent = () => read<RecentSearch[]>(() => localStorage, RECENT) ?? [];
export function pushRecent(entry: RecentSearch): void {
  const next = [entry, ...getRecent().filter((r) => r.id !== entry.id && r.label !== entry.label)].slice(0, 5);
  write(() => localStorage, RECENT, next);
}

export const newRequestId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
export const getRequest = (id: string) => read<StoredRequest>(() => sessionStorage, `wattle.req.${id}`);
export function setRequest(req: StoredRequest): void {
  write(() => sessionStorage, `wattle.req.${req.id}`, req);
  write(() => sessionStorage, CURRENT, req.id);
}
export const getCurrentRequestId = () => read<string>(() => sessionStorage, CURRENT);
export function getCurrentRequest(): StoredRequest | null {
  const id = getCurrentRequestId();
  return id ? getRequest(id) : null;
}

/* ------------------------------------------------------------------ patient-b (P06–P11) */
// What /adjust needs between screens: the Layer-1 survivors of the current request (full
// `Ranked`, so a surface can rerank without re-searching) and the pills the person chose. Both
// are parked in sessionStorage under the request id, never in a URL.

import type { Intent, Ranked } from "@/src/matching/types";

export interface StoredMatch {
  requestId: string;
  intent: Intent;
  survivors: Ranked[];
  at: string;
}

export interface AdjustChoices {
  requestId: string;
  on: string[];
}

export const getMatch = (requestId: string) => read<StoredMatch>(() => sessionStorage, `wattle.match.${requestId}`);
export const setMatch = (m: StoredMatch) => write(() => sessionStorage, `wattle.match.${m.requestId}`, m);
export const getAdjust = (requestId: string) => read<AdjustChoices>(() => sessionStorage, `wattle.adjust.${requestId}`);
export const setAdjust = (c: AdjustChoices) => write(() => sessionStorage, `wattle.adjust.${c.requestId}`, c);

/** A stable id for the ask when no request id has been issued yet (legacy `wattle.ask` flow). */
export function requestIdFor(ask: { sentence: string; suburb: string }): string {
  let h = 0;
  const s = `${ask.sentence}\n${ask.suburb}`;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return `ask-${(h >>> 0).toString(36)}`;
}
