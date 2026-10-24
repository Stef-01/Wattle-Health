// The ADHDme network on the roster: every clinician in data/adhdme/clinicians.json reaches a
// record with its card, nobody outside the base carries one, and no fee note brings markup with it.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cardFrom, isSiteBoilerplate, noteSegments } from "./adhdme";
import { buildRoster } from "./providers";

const base = JSON.parse(readFileSync(path.join(process.cwd(), "data", "adhdme", "clinicians.json"), "utf8")) as { count: number; clinicians: { id: string; name: string }[] };
const roster = buildRoster();
const network = roster.filter((d) => d.adhdme);

describe("ADHDme network", () => {
  it("brings every clinician in the base onto the roster, once", () => {
    expect(network).toHaveLength(base.count);
    expect(new Set(network.map((d) => d.adhdme!.id))).toEqual(new Set(base.clinicians.map((c) => c.id)));
  });

  it("attributes the words and the card to the ADHDme page", () => {
    for (const d of network) {
      expect(d.adhdme!.profileUrl).toMatch(/^https:\/\/www\.adhdme\.au\/.+\.html$/);
      expect(d.sources.some((s) => s.source === "adhdme" && s.sourceUrl === d.adhdme!.profileUrl)).toBe(true);
    }
  });

  it("never carries markup in a fee note, and drops the site's own commission line", () => {
    for (const d of network) {
      for (const note of d.adhdme!.fees.notes) {
        for (const seg of note) {
          expect(seg.text).not.toMatch(/<|>/);
          if (seg.kind === "link") expect(seg.href).toMatch(/^https?:\/\//);
        }
        expect(isSiteBoilerplate(note.map((s) => s.text).join(""))).toBe(false);
      }
    }
  });

  it("books through the card's own link", () => {
    for (const d of network.filter((x) => x.adhdme!.booking)) expect(d.booking).toMatchObject({ via: "website", url: d.adhdme!.booking!.url });
  });

  it("gives every clinician a reach, and a provider with no stated location no room", () => {
    for (const d of network) expect(d.reach?.states.length ?? 0).toBeGreaterThan(d.adhdme!.id === "toni-ghuman" ? -1 : 0);
    const toni = network.find((d) => d.adhdme!.id === "toni-ghuman")!;
    expect(toni.rooms).toEqual([]);
    expect(toni.adhdme!.evidenceUnclear).toBe(true);
  });

  it("never marks a prescriber as reaching every state", () => {
    for (const d of network.filter((x) => x.specialty === "general-practice" || x.specialty === "psychiatry")) {
      expect(d.reach!.nationalTelehealth).toBe(false);
      expect(d.reach!.states.length).toBeLessThanOrEqual(1);
    }
  });
});

describe("fee notes", () => {
  it("keeps text, emphasis and http(s) links, and nothing else", () => {
    const segs = noteSegments('With a plan, <a class="x" href="https://www9.health.gov.au/mbs">Medicare</a> pays <strong>$149.05</strong> a session.<script>x</script> <a href="javascript:alert(1)">no</a>');
    expect(segs).toEqual([
      { kind: "text", text: "With a plan, " },
      { kind: "link", text: "Medicare", href: "https://www9.health.gov.au/mbs" },
      { kind: "text", text: " pays " },
      { kind: "strong", text: "$149.05" },
      { kind: "text", text: " a session.x no" },
    ]);
  });

  it("decodes entities and drops the commission line from the card", () => {
    const card = cardFrom({ id: "a", slug: "a", category: "gp", profile_url: "https://www.adhdme.au/a.html", fees: { notes: ["Tom &amp; Jerry&#8217;s fee", "<strong>Fees are set and charged by the practice. ADHDme takes no commission.</strong>"] } }, "2026-10-24");
    expect(card.fees.notes).toEqual([[{ kind: "text", text: "Tom & Jerry’s fee" }]]);
  });
});
