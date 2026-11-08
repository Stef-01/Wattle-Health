"use client";
// Onboarding state lives in sessionStorage until Publish (C08) writes personal_profiles.
import { useCallback, useEffect, useRef, useState } from "react";
import type { ProfileText } from "@/src/server/clinician";
import { QUESTIONS, type ShareKey } from "./questions";

export { QUESTIONS, TOTAL, type ShareKey } from "./questions";

export interface Answer {
  raw: string;
  draft: string;
  show: boolean;
}

export interface JoinState {
  backend?: "supabase" | "inbox" | "memory";
  ahpra?: string;
  name?: string;
  email?: string;
  doctorId?: string | null;
  specialtyLine?: string;
  registerChecked?: boolean;
  registered?: boolean;
  conditions?: boolean;
  practitionerId?: string;
  claimId?: string;
  practice?: string;
  fee?: string;
  telehealth?: boolean;
  referral?: boolean;
  bulkBilling?: boolean;
  answers: Record<number, Answer>;
  shares: Record<ShareKey, boolean>;
  photo?: string;
  submitted?: boolean;
}

const KEY = "wattle.join";
const EMPTY: JoinState = { answers: {}, shares: { lived: true, outside: true, books: true, why: true } };

export function loadJoin(): JoinState {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<JoinState>;
    return { ...EMPTY, ...parsed, answers: parsed.answers ?? {}, shares: { ...EMPTY.shares, ...(parsed.shares ?? {}) } };
  } catch {
    return EMPTY;
  }
}

export function saveJoin(state: JoinState) {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* private mode: state lives in memory for this render only */
  }
}

/** Hydrates after mount (sessionStorage is client-only); `ready` is false during SSR. */
export function useJoin() {
  const [state, setState] = useState<JoinState>(EMPTY);
  const [ready, setReady] = useState(false);
  const latest = useRef<JoinState>(EMPTY);
  useEffect(() => {
    latest.current = loadJoin();
    setState(latest.current);
    setReady(true);
  }, []);
  // Persist synchronously from a ref: a router.push right after update() must not lose the write.
  const update = useCallback((patch: Partial<JoinState> | ((s: JoinState) => Partial<JoinState>)) => {
    const s = latest.current;
    const next = { ...s, ...(typeof patch === "function" ? patch(s) : patch) };
    latest.current = next;
    saveJoin(next);
    setState(next);
  }, []);
  return { state, update, ready };
}

/** Short name for the draft ("Dr Reilly"). */
export function drName(name: string | undefined): string {
  const clean = (name ?? "").replace(/^dr\.?\s+/i, "").trim();
  const family = clean.split(/\s+/).at(-1);
  return family ? `Dr ${family}` : "The doctor";
}

/** What Publish writes: answers switched on, with the C07 share toggles applied. */
export function profileFrom(state: JoinState): ProfileText {
  const out: ProfileText = {};
  for (const q of QUESTIONS) {
    const a = state.answers[q.n];
    if (!a || !a.draft.trim() || !a.show) continue;
    if (q.share && !state.shares[q.share]) continue;
    out[q.field] = a.draft.trim();
  }
  return out;
}
