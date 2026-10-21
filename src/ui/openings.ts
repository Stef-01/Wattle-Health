"use client";
// Openings watcher (demo MVP). Your calendar's busy times, preferred windows and which openings you've
// already been told about live only on this device (localStorage). Saved doctors come from both
// saved stores. A check runs when the app opens and every 15 minutes while it's open; a new opening
// that fits fires a browser notification if you've allowed them.
import type { DoctorRecord } from "@/src/data/types";
import { demoOpenings, fitting, type Busy, type Opening, type Window } from "@/src/data/calendar";
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
  /** When the last opening prompt showed; prompts are at most daily. */
  lastPromptAt?: number;
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
  // Nothing fits, and nothing is announced, until a calendar is connected (founder 2026-10-20).
  if (!s.calendar) return { fit: [], fresh: [], doctors };
  const busy = s.calendar.busy;
  const fit = doctors
    .flatMap((d) => fitting(demoOpenings(d.id, offersTelehealth(d), now), busy, s.windows).map((o) => ({ ...o, doctor: d })))
    .sort((a, b) => a.start - b.start);
  const fresh = fit.filter((o) => !s.seen.includes(o.id));
  return { fit, fresh, doctors };
}

export const whenLabel = (t: number) =>
  new Date(t).toLocaleString("en-AU", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/** At most one opening alert every three days, push or in-app (founder 2026-10-20: "shows very rarely"). */
export const PROMPT_GAP_MS = 3 * 24 * 3600 * 1000;
export const promptDue = (s: OpeningsState, now = Date.now()) => Boolean(s.calendar) && !(s.lastPromptAt && now - s.lastPromptAt < PROMPT_GAP_MS);

/** Push is the channel when it's on: the alert lands on the home screen, never as an in-app pop-up. */
export const pushOn = (s: OpeningsState) => Boolean(s.notify && typeof Notification !== "undefined" && Notification.permission === "granted");

/** Announce one fresh opening as a system notification (service worker, so it reaches an installed home-screen app). */
export async function notifyFresh(): Promise<number> {
  const s = getOpeningsState();
  if (!pushOn(s) || !promptDue(s)) return 0;
  const { fresh, fit } = await checkOpenings();
  if (!fresh.length) return 0;
  {
    const first = fresh[0]!;
    const title = `${first.doctor.name.display} has an opening`;
    const opts = { body: `${whenLabel(first.start)}. You're free. Book a follow-up?`, tag: "wattle-openings", icon: "/figma/leaf.svg", data: { url: `/?opening=${encodeURIComponent(first.id)}` } };
    const reg = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration().catch(() => undefined) : undefined;
    if (reg) await reg.showNotification(title, opts);
    else new Notification(title, opts);
  }
  setOpeningsState({ lastPromptAt: Date.now() });
  setOpeningsState({ seen: [...new Set([...s.seen, ...fresh.map((o) => o.id)])].filter((id) => fit.some((o) => o.id === id) || Number(id.split("@")[1]) > Date.now()) });
  return fresh.length;
}
