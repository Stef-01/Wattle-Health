// The researched practice-website profiles (data/enriched/personal/research-*.json) merge into
// the roster as `published` personal profiles: attached to an existing record when the name and
// specialty match, appended otherwise, always with the page as a found source.
import { describe, expect, it } from "vitest";
import { buildRoster, mvpDiscipline } from "./providers";
import { nameKey, readResearch, withPublished, type ResearchedDoctor } from "./published";

const base = (over: Partial<ResearchedDoctor> = {}): ResearchedDoctor => ({
  name: "Dr Test Person",
  given: "Test",
  family: "Person",
  specialty: "general-practice",
  gender: "woman",
  practice: { name: "Test Rooms", suburb: "Spring Hill", postcode: "4000", phone: "07 3000 0000", website: "https://example.org" },
  telehealth: "some",
  fee_initial_dollars: 250,
  conditions: ["menopause", "not-a-condition"],
  populations: ["adult"],
  personal: {
    philosophy_of_care: "I take time to listen and we decide together.",
    hobbies: ["Trail running at Mt Coot-tha", "Sourdough"],
    communication: ["listens"],
    quotes: [{ text: "I take time to listen.", about: "approach" }],
  },
  source: { url: "https://example.org/team/test", observed_at: "2026-10-16" },
  ...over,
});

describe("published profiles", () => {
  it("normalises names for matching", () => {
    expect(nameKey("Dr. Tal Jacobson")).toBe("tal jacobson");
    expect(nameKey("A/Prof Jane O'Neil")).toBe("jane o'neil");
  });

  it("appends a new found record with a published personal block, labels, and a geocoded room", () => {
    const out = withPublished([], mvpDiscipline(), [base()]);
    expect(out).toHaveLength(1);
    const d = out[0]!;
    expect(d.id).toBe("general-practice:test-person");
    expect(d.realPerson).toBe(true);
    expect(d.synthetic).toBe(false);
    expect(d.personal?.status).toBe("published");
    expect(d.personal?.sourceUrl).toBe("https://example.org/team/test");
    expect(d.personal?.labels).toContain("listens");
    expect(d.personal?.labels).toContain("collaborative");
    expect(d.conditions.value).toEqual(["menopause"]);
    expect(d.clinicalInterests && "value" in d.clinicalInterests ? d.clinicalInterests.value : d.clinicalInterests).toEqual(["menopause"]);
    expect(d.fees?.value[0]?.amountCents).toBe(25000);
    expect(d.locations[0]?.lat).toBeCloseTo(-27.46, 1);
    expect(d.sources[0]?.source).toBe("practice-website");
    expect(d.sources[0]?.legalBasis).toMatch(/own published words/);
  });

  it("attaches to an existing roster record with the same specialty and name", () => {
    const roster = buildRoster();
    const existing = roster.find((d) => d.personal?.status !== "published" && d.specialty === "psychiatry")!;
    const researched = base({ name: existing.name.display, given: existing.name.given, family: existing.name.family, specialty: "psychiatry", conditions: ["adhd"] });
    const out = withPublished([existing], mvpDiscipline(), [researched]);
    expect(out).toHaveLength(1);
    expect(out[0]!.id).toBe(existing.id);
    expect(out[0]!.personal?.status).toBe("published");
    expect(out[0]!.sources.length).toBe(existing.sources.length + 1);
    expect(out[0]!.conditions.value).toContain("adhd");
  });

  it("skips doctors whose page says they are not taking new patients", () => {
    const out = withPublished([], mvpDiscipline(), [base({ taking_new_patients: false })].filter((d) => d.taking_new_patients !== false));
    expect(out).toHaveLength(0);
  });

  it("every researched doctor on disk loads, geocodes, and carries their own words", () => {
    const researched = readResearch();
    expect(researched.length).toBeGreaterThanOrEqual(25);
    const roster = buildRoster();
    const published = roster.filter((d) => d.personal?.status === "published");
    expect(published.length).toBe(new Set(researched.map((r) => `${r.specialty}|${nameKey(r.name)}`)).size);
    for (const d of published) {
      // A provider whose practice is outside Queensland (ADHDme allied, 2026-10-19) is listed as
      // telehealth-only with no geocoded room; everyone else must geocode.
      if (d.rooms.every((r) => r.state !== "QLD")) expect(d.telehealth.value, `${d.name.display} is out of state and not telehealth-only`).toBe("only");
      else expect(d.locations.length, `${d.name.display} has no geocoded room`).toBeGreaterThan(0);
      expect(d.personal?.sourceUrl).toMatch(/^https?:\/\//);
      expect(d.sources.some((s) => s.source === "practice-website")).toBe(true);
    }
  });
});
