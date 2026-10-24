// Every state and ADHDme mode, end to end over the real roster: a search from each state returns
// only providers who see people there, the prescriber gap is said rather than hidden, ADHDme mode
// narrows the roster to ADHD support, and providers ADHDme leaves out of its navigator never rank.
import { describe, expect, it } from "vitest";
import { coverage } from "./coverage";
import { buildRoster, mvpDiscipline } from "./providers";
import { searchWith } from "./search-core";
import { STATES } from "./types";
import { isAdhdSupport } from "@/src/mode";

const roster = buildRoster();
const discipline = mvpDiscipline();
const CAPITALS: Record<string, string> = { NSW: "Sydney", VIC: "Melbourne", QLD: "Brisbane", WA: "Perth", SA: "Adelaide", TAS: "Hobart", ACT: "Canberra", NT: "Darwin" };

describe("every state", () => {
  for (const state of STATES) {
    it(`an ADHD search from ${CAPITALS[state]} returns only providers who see people in ${state}`, () => {
      const res = searchWith(roster, discipline, { sentence: "I need help with my ADHD", suburb: CAPITALS[state]! }, { mode: "adhdme" });
      expect(res.place.suburb).not.toBeNull();
      expect(res.cards.length).toBeGreaterThan(0);
      for (const c of res.cards) {
        const reach = c.doctor.reach;
        if (reach) expect(reach.states as string[]).toContain(state);
      }
    });
  }

  it("says plainly when no prescriber reaches the state, and keeps the rest", () => {
    // The ADHDme network alone has no prescriber outside QLD, NSW and VIC (prescribing is state by state).
    const network = roster.filter((d) => d.adhdme);
    const res = searchWith(network, discipline, { sentence: "ADHD assessment", suburb: "Adelaide" }, { mode: "adhdme" });
    expect(res.stateNote).toMatch(/No ADHD prescriber we list sees people in SA yet/);
    expect(res.cards.length).toBeGreaterThan(0);
    const inQld = searchWith(network, discipline, { sentence: "ADHD assessment", suburb: "Brisbane" }, { mode: "adhdme" });
    expect(inQld.stateNote).toBeUndefined();
  });

  it("the whole ADHD cohort reaches a prescriber in every state, so the note stays quiet", () => {
    for (const state of STATES) {
      const res = searchWith(roster, discipline, { sentence: "ADHD assessment", suburb: CAPITALS[state]! }, { mode: "adhdme" });
      expect(res.stateNote, state).toBeUndefined();
    }
  });

  it("a Queensland GP's telehealth does not reach Hobart", () => {
    const res = searchWith(roster, discipline, { sentence: "ADHD assessment with a GP", suburb: "Hobart" }, { mode: "adhdme" });
    expect(res.cards.some((c) => c.doctor.adhdme?.category === "gp")).toBe(false);
  });

  it("no place named searches all of Australia, not Brisbane", () => {
    const res = searchWith(roster, discipline, { sentence: "ADHD coach" }, { mode: "adhdme" });
    expect(res.place.suburb).toBeNull();
    expect(res.cards.length).toBeGreaterThan(0);
  });

  it("counts every state, and the prescriber gap shows in the coverage", () => {
    const rows = coverage(roster.filter(isAdhdSupport));
    expect(rows.map((r) => r.state)).toEqual([...STATES]);
    for (const r of rows) expect(r.others.inPerson + r.others.telehealth).toBeGreaterThan(0);
    const network = coverage(roster.filter((d) => d.adhdme));
    for (const s of ["SA", "TAS", "NT"]) {
      const row = network.find((r) => r.state === s)!;
      expect(row.prescribers.inPerson + row.prescribers.telehealth).toBe(0);
    }
  });
});

describe("ADHDme mode", () => {
  it("ranks only the ADHD cohort", () => {
    const res = searchWith(roster, discipline, { sentence: "someone who listens" }, { mode: "adhdme" });
    expect(res.cards.length).toBeGreaterThan(0);
    for (const c of res.cards) expect(isAdhdSupport(c.doctor)).toBe(true);
    expect(res.rosterSize).toBeLessThan(roster.length);
  });

  it("answers an off-topic search with a note, not ADHD providers", () => {
    const res = searchWith(roster, discipline, { sentence: "endometriosis specialist" }, { mode: "adhdme" });
    expect(res.cards).toEqual([]);
    expect(res.scopeNote).toMatch(/ADHDme only covers ADHD support/);
    const wattle = searchWith(roster, discipline, { sentence: "endometriosis specialist" }, { mode: "wattle" });
    expect(wattle.scopeNote).toBeUndefined();
    expect(wattle.cards.length).toBeGreaterThan(0);
  });

  it("keeps a sentence that names ADHD among other things", () => {
    const res = searchWith(roster, discipline, { sentence: "ADHD and anxiety, telehealth" }, { mode: "adhdme" });
    expect(res.scopeNote).toBeUndefined();
    expect(res.cards.length).toBeGreaterThan(0);
  });
});

describe("ADHDme's own exclusions", () => {
  it("never ranks a provider the ADHDme navigator leaves out, in either mode", () => {
    const left = roster.filter((d) => d.adhdme?.evidenceUnclear).map((d) => d.id);
    expect(left.length).toBeGreaterThan(0);
    for (const mode of ["wattle", "adhdme"] as const) {
      const res = searchWith(roster, discipline, { sentence: "ADHD, brain mapping, neurofeedback" }, { mode });
      for (const c of res.cards) expect(left).not.toContain(c.doctor.id);
    }
  });
});
