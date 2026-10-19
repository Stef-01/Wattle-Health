// Proactive openings (2026-10-18, demo MVP). Pure helpers shared by the server and the browser:
// read busy time from an iCalendar (.ics) file, generate DEMO openings for a doctor, and keep the
// openings that fall in the patient's free time and preferred windows. Real practice availability
// is a later stage; every demo opening carries `demo: true` and is labelled where shown.

export type Busy = { start: number; end: number };
export type Opening = { id: string; doctorId: string; start: number; end: number; mode: "telehealth" | "in-person"; demo: true };
export type Window = "morning" | "midday" | "afternoon" | "evening";

export const WINDOWS: Record<Window, { label: string; from: number; to: number }> = {
  morning: { label: "Mornings, before 10", from: 7, to: 10 },
  midday: { label: "Around lunch, 11 to 2", from: 11, to: 14 },
  afternoon: { label: "Afternoons, 2 to 5", from: 14, to: 17 },
  evening: { label: "After work, 5 to 7", from: 17, to: 19 },
};

/** Unfold lines, then read DTSTART/DTEND of every VEVENT. Times without Z or TZID read as local time. */
export function parseIcs(text: string): Busy[] {
  const lines = text.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
  const out: Busy[] = [];
  let cur: { s?: number; e?: number; transparent?: boolean } | null = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") cur = {};
    else if (line === "END:VEVENT" && cur) {
      if (cur.s !== undefined && !cur.transparent) out.push({ start: cur.s, end: cur.e ?? cur.s + 3600000 });
      cur = null;
    } else if (cur) {
      const m = line.match(/^(DTSTART|DTEND)([^:]*):(\d{8})(?:T(\d{6})(Z)?)?/);
      if (m) {
        const [, key, params, date, time, z] = m;
        const y = +date!.slice(0, 4), mo = +date!.slice(4, 6) - 1, d = +date!.slice(6, 8);
        const h = time ? +time.slice(0, 2) : 0, mi = time ? +time.slice(2, 4) : 0;
        const t = z ? Date.UTC(y, mo, d, h, mi) : new Date(y, mo, d, h, mi).getTime();
        if (key === "DTSTART") cur.s = t;
        else cur.e = t;
        if (!time && key === "DTSTART" && /VALUE=DATE/.test(params!)) cur.e = cur.e ?? t + 86400000;
      } else if (/^TRANSP:TRANSPARENT/.test(line)) cur.transparent = true;
    }
  }
  return out.filter((b) => b.end > b.start).sort((a, b) => a.start - b.start);
}

function seeded(seed: string) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

const startOfDay = (t: number) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/**
 * Demo openings: a doctor releases 0 to 3 thirty-minute slots on some weekdays, as cancellations do.
 * Seeded by doctor and day so every visit shows the same week; a slot appearing on a later day is
 * what a "new opening" notification announces.
 */
export function demoOpenings(doctorId: string, telehealth: boolean, now: number, days = 14): Opening[] {
  const out: Opening[] = [];
  const day0 = startOfDay(now);
  for (let i = 0; i < days; i++) {
    const day = day0 + i * 86400000;
    const dow = new Date(day).getDay();
    if (dow === 0 || dow === 6) continue;
    const rand = seeded(`${doctorId}:${new Date(day).toDateString()}`);
    const n = Math.floor(rand() * 4) - (rand() < 0.4 ? 1 : 0);
    for (let k = 0; k < n; k++) {
      const half = 16 + Math.floor(rand() * 20); // 8:00 to 17:30
      const start = day + half * 1800000;
      if (start < now + 2 * 3600000) continue;
      const mode = telehealth && rand() < 0.5 ? "telehealth" : "in-person";
      out.push({ id: `${doctorId}@${start}`, doctorId, start, end: start + 1800000, mode, demo: true });
    }
  }
  return out.filter((o, i, a) => a.findIndex((x) => x.start === o.start) === i).sort((a, b) => a.start - b.start);
}

/** Keep openings in a preferred window that clear every busy block (in-person adds 30 min travel each side). */
export function fitting(openings: Opening[], busy: Busy[], windows: Window[]): Opening[] {
  return openings.filter((o) => {
    const h = new Date(o.start).getHours() + new Date(o.start).getMinutes() / 60;
    if (windows.length && !windows.some((w) => h >= WINDOWS[w].from && h < WINDOWS[w].to)) return false;
    const pad = o.mode === "in-person" ? 1800000 : 0;
    return !busy.some((b) => b.start < o.end + pad && b.end > o.start - pad);
  });
}

/** A believable demo week of busy time (work blocks, school run, gym) for people who don't connect a calendar. */
export function demoBusy(now: number): Busy[] {
  const out: Busy[] = [];
  const day0 = startOfDay(now);
  for (let i = 0; i < 14; i++) {
    const day = day0 + i * 86400000;
    const dow = new Date(day).getDay();
    if (dow === 0 || dow === 6) continue;
    const at = (h: number) => day + h * 3600000;
    out.push({ start: at(9), end: at(12) }, { start: at(13), end: at(15.5) });
    if (dow === 2 || dow === 4) out.push({ start: at(17.5), end: at(18.5) });
  }
  return out;
}

/** One-event .ics so "Add to calendar" works in Google, Apple and Outlook. */
export function icsFor(o: Opening, title: string, location: string): string {
  const f = (t: number) => new Date(t).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Wattle//Openings//EN", "BEGIN:VEVENT", `UID:${o.id.replace(/[^\w@.-]/g, "")}@wattle`, `DTSTAMP:${f(Date.now())}`, `DTSTART:${f(o.start)}`, `DTEND:${f(o.end)}`, `SUMMARY:${title}`, `LOCATION:${location}`, "DESCRIPTION:Demo opening from Wattle. Call the practice to book.", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
}
