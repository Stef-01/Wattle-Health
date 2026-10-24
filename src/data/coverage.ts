// Who sees people in each state (every state, 2026-10-24). Pure over the roster, no fs: the
// /about/coverage page and the tests read it. A record with a `reach` (the ADHDme network) says
// where it sees people; any other record sees people in the states its rooms are in, in person,
// and by telehealth only there too, because nothing on it says otherwise.
import { STATES, type DoctorRecord, type StateCode } from "./types";

/** Specialties that prescribe. ADHD medication needs one of them. */
export const PRESCRIBING = new Set(["general-practice", "psychiatry", "paediatrics"]);

const isState = (s: string): s is StateCode => (STATES as readonly string[]).includes(s);

export function statesOf(d: Pick<DoctorRecord, "reach" | "rooms" | "telehealth">): { inPerson: StateCode[]; telehealth: StateCode[] } {
  if (d.reach) return { inPerson: d.reach.inPersonStates, telehealth: d.reach.telehealthStates };
  const rooms = [...new Set(d.rooms.map((r) => r.state).filter(isState))];
  return { inPerson: rooms, telehealth: d.telehealth.value === "none" ? [] : rooms };
}

export interface StateCoverage {
  state: StateCode;
  /** Prescribers with rooms in the state, and those who see people there by telehealth only. */
  prescribers: { inPerson: number; telehealth: number };
  /** Everyone else: psychology, occupational therapy, allied health, coaching. */
  others: { inPerson: number; telehealth: number };
}

export function coverage(doctors: readonly DoctorRecord[]): StateCoverage[] {
  return STATES.map((state) => {
    const row: StateCoverage = { state, prescribers: { inPerson: 0, telehealth: 0 }, others: { inPerson: 0, telehealth: 0 } };
    for (const d of doctors) {
      const s = statesOf(d);
      const bucket = PRESCRIBING.has(d.specialty) ? row.prescribers : row.others;
      if (s.inPerson.includes(state)) bucket.inPerson += 1;
      else if (s.telehealth.includes(state)) bucket.telehealth += 1;
    }
    return row;
  });
}

export const STATE_NAMES: Record<StateCode, string> = {
  NSW: "New South Wales",
  VIC: "Victoria",
  QLD: "Queensland",
  WA: "Western Australia",
  SA: "South Australia",
  TAS: "Tasmania",
  ACT: "Australian Capital Territory",
  NT: "Northern Territory",
};

/** One line per state, in the closed copy the page shows. A state with no prescriber says so. */
export function coverageLine(row: StateCoverage): string {
  const p = row.prescribers.inPerson + row.prescribers.telehealth;
  const o = row.others.inPerson + row.others.telehealth;
  const lead = p === 0 ? "No prescriber yet" : `${p} ${p === 1 ? "prescriber" : "prescribers"}`;
  return `${lead} · ${o} ${o === 1 ? "other" : "others"}`;
}
