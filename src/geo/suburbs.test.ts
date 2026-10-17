// Ported from adhd.me/src/geo/suburbs.test.ts on 2026-10-15.
import { describe, expect, it } from "vitest";
import { FIXTURE_ROSTER } from "@/src/matching/support/fixture-roster";
import { SUBURBS, coveredSuburbs, describeDistance, distanceKm, resolvePlace, type SuburbPoint, suggestPlaces } from "./suburbs";

const at = (name: string) => resolvePlace(name)!;

describe("the gazetteer covers what the roster claims", () => {
  /**
   * The load-bearing test. A clinician in an unlisted suburb cannot be given a distance, and the
   * failure mode without this is silent: they rank last for every search, forever, and nothing
   * says why. This makes adding a practice in a new suburb fail loudly instead.
   */
  it("has a point for every suburb a clinician practises in", () => {
    for (const clinician of FIXTURE_ROSTER) {
      for (const suburb of [clinician.suburb, ...(clinician.alsoConsultsAt ?? [])]) {
        expect(resolvePlace(suburb), `${suburb} is not in the gazetteer`).not.toBeNull();
      }
    }
  });

  it("has no duplicate suburbs", () => {
    expect(new Set(SUBURBS.map((s) => s.suburb)).size).toBe(SUBURBS.length);
  });

  it("keeps every point inside one of the three focus areas, so a typo in a coordinate is caught", () => {
    // Tight boxes, not one: a single box spanning Beecroft to the Gold Coast is ~700km tall and
    // would wave through a Sydney point mistyped into the Queensland range. Each suburb must sit
    // inside the northern-Sydney box, the eastern-suburbs box (O34: Double Bay), OR the Gold
    // Coast box.
    const inSydney = (s: SuburbPoint) =>
      s.lat > -33.9 && s.lat < -33.6 && s.lon > 150.9 && s.lon < 151.2;
    const inEasternSuburbs = (s: SuburbPoint) =>
      s.lat > -33.95 && s.lat < -33.83 && s.lon > 151.2 && s.lon < 151.31;
    // O251: the whole local-government area, Yatala to Coolangatta and the hinterland to
    // Springbrook and Tamborine Mountain, plus Tweed Heads over the border and Brisbane City.
    const inGoldCoast = (s: SuburbPoint) =>
      s.lat > -28.3 && s.lat < -27.7 && s.lon > 153.15 && s.lon < 153.6;
    // O252: inner Brisbane, where GOALS Psychology is. Brisbane City used to be the single named
    // exception; a box is the same guard once there is more than one point in it.
    // Widened 2026-10-16 to greater Brisbane (Caboolture to Logan, Ipswich to the bay) for the
    // researched practices in src/geo/brisbane.ts, plus a Sunshine Coast box.
    const inBrisbane = (s: SuburbPoint) => s.lat > -27.7 && s.lat < -27.05 && s.lon > 152.7 && s.lon < 153.3;
    const inSunshineCoast = (s: SuburbPoint) => s.lat > -26.9 && s.lat < -26.3 && s.lon > 152.9 && s.lon < 153.2;
    // Regional Queensland (src/geo/regional.ts), 2026-10-17: Cairns to Toowoomba.
    const inRegionalQld = (s: SuburbPoint) => s.lat > -28 && s.lat < -16 && s.lon > 145 && s.lon < 153.3;
    for (const s of SUBURBS) {
      expect(inSydney(s) || inEasternSuburbs(s) || inGoldCoast(s) || inBrisbane(s) || inSunshineCoast(s) || inRegionalQld(s), `${s.suburb} is outside every focus area`).toBe(true);
      expect(s.postcode).toMatch(/^\d{4}$/);
    }
  });
});

describe("O251 the Gold Coast, as a room of Gold Coast GPs would type it", () => {
  it("resolves a postcode, and says which suburb it took", () => {
    expect(resolvePlace("4220")?.suburb).toBe("Burleigh Heads");
    expect(resolvePlace("4217")?.suburb).toBe("Surfers Paradise");
  });
  it("prefers the suburb the person also named when a postcode covers several", () => {
    expect(resolvePlace("Main Beach 4217")?.suburb).toBe("Main Beach");
    expect(resolvePlace("4217 benowa")?.suburb).toBe("Benowa");
  });
  it("ignores a state name, a comma and doubled spaces", () => {
    expect(resolvePlace("Southport QLD")?.suburb).toBe("Southport");
    expect(resolvePlace("Coolangatta, 4225")?.suburb).toBe("Coolangatta");
    expect(resolvePlace("  helensvale   queensland ")?.suburb).toBe("Helensvale");
    expect(resolvePlace("Tweed Heads NSW")?.postcode).toBe("2485");
  });
  it("still refuses to guess a half-typed name", () => {
    expect(resolvePlace("Burleigh")).toBeNull();
    expect(resolvePlace("Coolang")).toBeNull();
  });
  it("suggests from two characters, prefixes first, then contains, then postcodes", () => {
    expect(suggestPlaces("b")).toEqual([]);
    expect(suggestPlaces("burl").map((s) => s.suburb)).toEqual(["Burleigh Heads", "Burleigh Waters"]);
    expect(suggestPlaces("coom").map((s) => s.suburb)).toEqual(["Coomera", "Coombabah", "Upper Coomera"]);
    expect(suggestPlaces("422").map((s) => s.postcode).every((p) => p.startsWith("422"))).toBe(true);
    expect(suggestPlaces("42").length).toBe(6);
    expect(suggestPlaces("Southport")).toEqual([]);
  });
  it("covers every Gold Coast suburb a persona consults in", () => {
    for (const name of ["Burleigh Heads", "Coolangatta", "Helensvale", "Nerang", "Varsity Lakes", "Palm Beach"]) {
      expect(resolvePlace(name)?.suburb).toBe(name);
    }
  });
});

describe("resolving what somebody typed", () => {
  it("matches a suburb name regardless of case or padding", () => {
    expect(resolvePlace("  beeCROFT ")?.suburb).toBe("Beecroft");
  });

  it("matches a postcode", () => {
    expect(resolvePlace("4215")?.suburb).toBe("Southport");
  });

  it("returns null rather than guessing at a near miss", () => {
    // W189's rule, and here it has teeth: "Beecrof" resolving to Beecroft is harmless, but the
    // same leniency sends "Richmond" to the nearest string match in the wrong state.
    for (const miss of ["Beecrof", "Bee croft", "Bondi", "9999", "", "   "]) {
      expect(resolvePlace(miss), `${miss} should not resolve`).toBeNull();
    }
  });

  it("offers the covered suburbs, so somebody can see what is in range", () => {
    expect(coveredSuburbs()).toContain("Beecroft");
    expect(coveredSuburbs().length).toBe(SUBURBS.length);
  });
});

describe("distance", () => {
  it("is zero from a place to itself", () => {
    expect(distanceKm(at("Beecroft"), at("Beecroft"))).toBeCloseTo(0, 5);
  });

  it("is symmetric", () => {
    const a = distanceKm(at("Beecroft"), at("Epping"));
    const b = distanceKm(at("Epping"), at("Beecroft"));
    expect(a).toBeCloseTo(b, 9);
  });

  it("puts Southport to Surfers Paradise in the right ballpark", () => {
    // Roughly 5km straight line. A wide band on purpose: this asserts the maths is not broken,
    // not that the centroids are survey-grade.
    const km = distanceKm(at("Southport"), at("Surfers Paradise"));
    expect(km).toBeGreaterThan(3);
    expect(km).toBeLessThan(8);
  });

  it("orders near before far, including across the two focus areas", () => {
    // Cheltenham is a neighbour of Beecroft; Southport is in the other state. The straight-line
    // maths must put the neighbour first.
    const origin = at("Beecroft");
    expect(distanceKm(origin, at("Cheltenham"))).toBeLessThan(distanceKm(origin, at("Southport")));
  });
});

describe("how a distance is said", () => {
  it("never states a travel time, only a straight-line distance, and hedges it", () => {
    // The failure this prevents is the one the hardcoded "12 min by train" string was already
    // making: a travel time this product cannot know, printed as though it could.
    for (const km of [0.05, 0.4, 1.2, 4.9, 18]) {
      const said = describeDistance(km);
      expect(said).not.toMatch(/min|hour|train|bus|walk/i);
      if (km >= 0.1) expect(said).toMatch(/^about /);
    }
  });

  it("says 'in your suburb' rather than 'about 0 km away'", () => {
    expect(describeDistance(0.02)).toBe("in your suburb");
  });

  it("keeps one decimal under a kilometre and whole numbers above", () => {
    expect(describeDistance(0.44)).toBe("about 0.4 km away");
    expect(describeDistance(4.4)).toBe("about 4 km away");
    expect(describeDistance(4.6)).toBe("about 5 km away");
  });
});
