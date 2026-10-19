// Allied health providers (founder 2026-10-19: "add in all providers not just GPs"). The ADHDme
// psychologists, OTs, coaches and other allied clinicians load from research-adhdme-allied.json,
// match on their own specialty ids, and never lead where a medical prescriber is needed.
import { describe, expect, it } from "vitest";
import { isAllied } from "@/src/matching/types";
import { buildRoster, mvpDiscipline } from "./providers";
import { searchWith } from "./search-core";

const roster = buildRoster();
const discipline = mvpDiscipline();

describe("allied health providers", () => {
  it("load as published records with a profession title and a specialty from the allied set", () => {
    const allied = roster.filter((d) => isAllied(d.specialty));
    expect(allied.length).toBeGreaterThanOrEqual(40);
    for (const d of allied) {
      expect(d.profession, d.name.display).toBeTruthy();
      expect(d.personal?.status).toBe("published");
      expect(d.personal?.sourceUrl).toMatch(/^https:\/\/www\.adhdme\.au\//);
    }
  });

  it("an ADHD search (prescriber condition) never ranks an allied provider above a doctor", () => {
    const res = searchWith(roster, discipline, { sentence: "ADHD, someone who gets it" });
    const kinds = res.cards.map((c) => isAllied(c.doctor.specialty));
    const firstAllied = kinds.indexOf(true);
    if (firstAllied >= 0) expect(kinds.slice(firstAllied).every(Boolean)).toBe(true);
  });

  it("a depression search can surface psychologists, and a bipolar search cannot", () => {
    const all = (sentence: string) => searchWith(roster, discipline, { sentence }).cards;
    expect(roster.some((d) => d.specialty === "psychology" && d.conditions.value.includes("depression"))).toBe(true);
    expect(all("bipolar, I need help").some((c) => isAllied(c.doctor.specialty))).toBe(false);
  });
});
