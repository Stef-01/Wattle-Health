import { describe, expect, it } from "vitest";
import { demoBusy, demoOpenings, fitting, icsFor, parseIcs } from "./calendar";

const MON_9AM = new Date(2026, 9, 19, 9, 0).getTime(); // Monday 19 Oct 2026, local

describe("parseIcs", () => {
  it("reads timed, UTC, all-day and folded events and skips free (transparent) ones", () => {
    const ics = ["BEGIN:VCALENDAR", "BEGIN:VEVENT", "DTSTART:20261019T100000", "DTEND:20261019T110000", "SUMMARY:Work", "END:VEVENT", "BEGIN:VEVENT", "DTSTART:20261020T", " 000000Z", "DTEND:20261020T010000Z", "END:VEVENT", "BEGIN:VEVENT", "DTSTART;VALUE=DATE:20261021", "END:VEVENT", "BEGIN:VEVENT", "DTSTART:20261022T100000", "DTEND:20261022T110000", "TRANSP:TRANSPARENT", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    const b = parseIcs(ics);
    expect(b).toHaveLength(3);
    expect(b[0]).toEqual({ start: new Date(2026, 9, 19, 10).getTime(), end: new Date(2026, 9, 19, 11).getTime() });
    expect(b[1]!.start).toBe(Date.UTC(2026, 9, 20, 0, 0));
    expect(b[2]!.end - b[2]!.start).toBe(86400000);
  });
});

describe("openings", () => {
  it("are deterministic, weekday-only, in the future and labelled demo", () => {
    const a = demoOpenings("gp:x", true, MON_9AM);
    expect(a).toEqual(demoOpenings("gp:x", true, MON_9AM));
    expect(a.length).toBeGreaterThan(0);
    for (const o of a) {
      expect(o.demo).toBe(true);
      expect(o.start).toBeGreaterThan(MON_9AM);
      expect([0, 6]).not.toContain(new Date(o.start).getDay());
    }
    expect(demoOpenings("gp:x", false, MON_9AM).every((o) => o.mode === "in-person")).toBe(true);
  });

  it("fitting never returns an opening that overlaps busy time or sits outside the chosen windows", () => {
    const busy = demoBusy(MON_9AM);
    const all = ["a", "b", "c", "d", "e"].flatMap((id) => demoOpenings(id, true, MON_9AM));
    const fit = fitting(all, busy, ["morning", "midday", "afternoon", "evening"]);
    for (const o of fit) {
      const pad = o.mode === "in-person" ? 1800000 : 0;
      expect(busy.some((b) => b.start < o.end + pad && b.end > o.start - pad)).toBe(false);
    }
    const mornings = fitting(all, [], ["morning"]);
    expect(mornings.every((o) => new Date(o.start).getHours() < 10)).toBe(true);
  });

  it("icsFor writes one event", () => {
    const [o] = demoOpenings("gp:y", true, MON_9AM);
    const ics = icsFor(o!, "Dr Y", "Brisbane");
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(parseIcs(ics)[0]!.start).toBe(Math.floor(o!.start / 1000) * 1000);
  });
});
