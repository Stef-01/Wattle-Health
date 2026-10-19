"use client";
// Openings watcher (demo MVP). Your calendar's busy times, preferred windows and which openings you've
// already been told about live only on this device (localStorage). Saved doctors come from both
// saved stores. A check runs when the app opens and every 15 minutes while it's open; a new opening
// that fits fires a browser notification if you've allowed them.
import type { DoctorRecord } from "@/src/data/types";
import { demoBusy, demoOpenings, fitting, type Busy, type Opening, type Window } from "@/src/data/calendar";
import { getSaved, getSavedIds } from "./store";

const KEY = "wattle.openings.v1";
export type CalendarSource = "ics-file" | "ics-link" | "demo" | "google" | "apple" | "outlook";
export type OpeningsState = {
  calendar: { source: CalendarSource; label: string; busy: Busy[]; at: number } | null;
  windows: Window[];
  notify: boolean;
  seen: string[];
  /** Saved doctors you've switched off in Saved; Openings skips them. */
  muted?: string[];
  /** Openings the person said "Not now" to, and ones they booked from the prompt. */
  dismissed?: string[];
  booked?: { id: string; doctorId: string; start: number; mode: string }[];
};
const EMPTY: OpeningsState = { calendar: null, windows: ["morning", "midday", "afternoon", "evening"], notify: false, seen: [] };

export function getOpeningsState(): OpeningsState {
  try {
    return { ...EMPTY, ...(JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<OpeningsState> | null) };
  } catch {
    return EMPTY;
  }
}
export function setOpeningsState(next: Partial<OpeningsState>): OpeningsState {
  const s = { ...getOpeningsState(), ...next };
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* private mode */
  }
  window.dispatchEvent(new Event("wattle:openings"));
  return s;
}

export const savedDoctorIds = () => [...new Set([...getSavedIds(), ...getSaved().map((d) => d.id)])];

const cache = new Map<string, DoctorRecord>();
export async function loadDoctors(ids: string[]): Promise<DoctorRecord[]> {
  const missing = ids.filter((id) => !cache.has(id));
  if (missing.length) {
    const res = await fetch(`/api/doctors?ids=${encodeURIComponent(missing.join(","))}`).then((r) => r.json()).catch(() => ({ doctors: [] }));
    for (const d of (res as { doctors: DoctorRecord[] }).doctors) cache.set(d.id, d);
  }
  return ids.map((id) => cache.get(id)).filter((d): d is DoctorRecord => Boolean(d));
}

const offersTelehealth = (d: DoctorRecord) => d.declared?.telehealth === true && d.telehealth?.value !== "none";

export type FitOpening = Opening & { doctor: DoctorRecord };

/** Every fitting opening across saved doctors, soonest first, and the ones not announced yet. */
export async function checkOpenings(now = Date.now()): Promise<{ fit: FitOpening[]; fresh: FitOpening[]; doctors: DoctorRecord[] }> {
  const s = getOpeningsState();
  const muted = new Set(s.muted ?? []);
  const doctors = await loadDoctors(savedDoctorIds().filter((id) => !muted.has(id)));
  const busy = s.calendar?.busy ?? demoBusy(now);
  const fit = doctors
    .flatMap((d) => fitting(demoOpenings(d.id, offersTelehealth(d), now), busy, s.windows).map((o) => ({ ...o, doctor: d })))
    .sort((a, b) => a.start - b.start);
  const fresh = fit.filter((o) => !s.seen.includes(o.id));
  return { fit, fresh, doctors };
}

export const whenLabel = (t: number) =>
  new Date(t).toLocaleString("en-AU", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/** Announce fresh openings once each. Returns how many were announced. */
export async function notifyFresh(): Promise<number> {
  const s = getOpeningsState();
  const { fresh, fit } = await checkOpenings();
  if (!fresh.length) return 0;
  if (!(s.notify && typeof Notification !== "undefined" && Notification.permission === "granted")) return 0;
  {
    const first = fresh[0]!;
    const more = fresh.length > 1 ? ` and ${fresh.length - 1} more` : "";
    new Notification(`An appointment with ${first.doctor.name.display} just opened up`, {
      body: `${whenLabel(first.start)}. You're free then. Book a follow-up?${more}`,
      tag: "wattle-openings",
    });
  }
  setOpeningsState({ seen: [...new Set([...s.seen, ...fresh.map((o) => o.id)])].filter((id) => fit.some((o) => o.id === id) || Number(id.split("@")[1]) > Date.now()) });
  return fresh.length;
}
