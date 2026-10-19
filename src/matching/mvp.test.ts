// The two-layer MVP matcher end to end (writing-block.md Tasks 5 and 6) on disciplines/mvp.yaml
// and the fictional QLD roster in support/fixture-mvp-doctors.ts. Written on 2026-10-15.
//
// Blocks: the intent read over 44 sentences across the plan's three categories (including its
// two example queries), the Layer-1 filters with their named reasons, the clinical bands, Layer
// 2's reorder inside a band with adjustable weights, explanations that trace to evidence, and
// urgency routing. The property tests live in layer2.properties.test.ts.

import { describe, expect, it } from "vitest";
import { lexiconForSlug } from "./needs";
import { extractIntent, isMandatory, specialtiesFor } from "./layer1";
import { CARE_GUIDANCE, EMERGENCY_NOTE, NO_PROFILE_REASON, ZERO_WEIGHTS, match, rerank, shown } from "./index";
import { BRISBANE, MVP, MVP_DOCTORS } from "./support/fixture-mvp-doctors";
import { eachOf } from "./support/non-vacuous";
import type { Doctor, Intent, MatchResult, Place, Ranked, Reason } from "./types";

const TODAY = new Date("2026-10-15T00:00:00Z");
const lexicon = lexiconForSlug("mvp");

const run = (sentence: string, place: Place | null = null, weights?: Record<string, number>): MatchResult =>
  match(sentence, place, MVP_DOCTORS, { discipline: "mvp", today: TODAY, ...(weights ? { weights } : {}) });
const ids = (results: readonly Ranked[]) => results.map((r) => r.doctor.id);
const excludedAs = (result: MatchResult, reason: string) => result.excluded.filter((e) => e.reason === reason).map((e) => e.doctor.id).sort();
const intentOf = (sentence: string): Intent => extractIntent(sentence, lexicon).intent;

const POSTPARTUM = "I'm looking for a female doctor around Brisbane who really understands postpartum depression and won't just dismiss how I'm feeling";
const PELVIC =
  "I've had chronic pelvic pain for years. I feel like nobody listens. I want someone experienced with endometriosis who takes a collaborative approach, and ideally someone who understands what living with a chronic condition feels like.";

type Expect = {
  conditions: string[];
  specialties?: string[];
  gender?: "woman" | "man";
  mandatory?: Intent["mandatory"];
  humanFit?: string[];
  population?: Intent["population"];
  urgency?: Intent["urgency"];
  language?: string;
  telehealth?: Intent["constraints"]["telehealth"];
  billing?: Intent["constraints"]["billing"];
  manner?: string[];
};

/** 44 sentences, three categories. Every expectation was measured, not guessed. Specialty sets include the allied specialties mvp.yaml names since 2026-10-19 (psychology, occupational-therapy, allied-health). */
const SENTENCES: ReadonlyArray<[string, Expect]> = [
  // ---- Women's health
  [POSTPARTUM, { conditions: ["perinatal-mh"], specialties: ["psychiatry", "obstetrics-gynaecology", "general-practice", "psychology"], gender: "woman", mandatory: [], humanFit: ["listens"], population: "perinatal" }],
  [PELVIC, { conditions: ["pelvic-pain", "endometriosis"], specialties: ["obstetrics-gynaecology", "pain-medicine", "general-practice"], humanFit: ["collaborative", "listens", "lived-experience"], manner: ["collaborative"] }],
  ["painful periods every month and my GP thinks it might be endo", { conditions: ["endometriosis"] }],
  ["PCOS and irregular periods, I want someone who looks at the whole picture not just symptoms", { conditions: ["pcos"], specialties: ["obstetrics-gynaecology", "endocrinology", "general-practice"], humanFit: ["holistic"] }],
  ["perimenopause with hot flushes and I need a woman doctor", { conditions: ["menopause"], gender: "woman", mandatory: ["gender"] }],
  ["postnatal anxiety since the birth, I need to be seen this week", { conditions: ["perinatal-mh"], population: "perinatal", urgency: "urgent" }],
  ["pelvic pain and pain with sex, I've been fobbed off for years", { conditions: ["pelvic-pain"], humanFit: ["listens"] }],
  ["heavy periods and I must see a female gynaecologist", { conditions: ["endometriosis"], gender: "woman", mandatory: ["gender"] }],
  ["endo, bulk billing only", { conditions: ["endometriosis"], billing: "bulk-bills", mandatory: ["billing"] }],
  ["menopause, I want someone with a scientific approach and who does research", { conditions: ["menopause"], humanFit: ["evidence-based", "research-active"] }],
  ["pregnant and anxious all the time, I want longer appointments", { conditions: ["anxiety"], population: "perinatal", humanFit: ["long-appointments"] }],
  ["endometriosis and ADHD, I'm neurodivergent and want someone neurodiversity affirming", { conditions: ["endometriosis", "adhd"], specialties: ["obstetrics-gynaecology", "general-practice", "pain-medicine", "psychiatry", "paediatrics", "psychology", "occupational-therapy", "allied-health"], humanFit: ["neurodiversity-affirming"] }],
  // ---- Mental health
  ["I want an ADHD assessment as an adult", { conditions: ["adhd"], specialties: ["psychiatry", "paediatrics", "general-practice", "psychology", "occupational-therapy", "allied-health"], population: "adult" }],
  ["my 8 year old son might have ADHD and we want a gentle doctor", { conditions: ["adhd"], population: "child", humanFit: ["gentle"], manner: ["gentle"] }],
  ["depression and I'd like someone who is up to date with research", { conditions: ["depression"], specialties: ["psychiatry", "general-practice", "psychology"], humanFit: ["research-active"] }],
  ["panic attacks and social anxiety, telehealth only please", { conditions: ["anxiety"], telehealth: "only", mandatory: ["telehealth"] }],
  ["bipolar, and I only want a man", { conditions: ["bipolar"], specialties: ["psychiatry"], gender: "man", mandatory: ["gender"] }],
  ["hearing voices and my family is worried", { conditions: ["psychosis"], specialties: ["psychiatry"] }],
  ["borderline personality disorder and I need someone trauma informed", { conditions: ["personality", "trauma"], humanFit: ["trauma-informed"] }],
  ["complex trauma from childhood abuse, someone gentle who won't rush me", { conditions: ["trauma"], humanFit: ["gentle"] }],
  ["binge eating and body image, I'd prefer a woman", { conditions: ["eating-disorders"], gender: "woman", mandatory: [] }],
  ["ocd intrusive thoughts and I want someone direct and straight talking", { conditions: ["ocd"], humanFit: ["direct"], manner: ["direct"] }],
  ["drinking too much and I want to talk to someone who won't judge", { conditions: ["substance-use"] }],
  ["my teenager has anxiety and is restricting food", { conditions: ["eating-disorders", "anxiety"], population: "adolescent" }],
  ["I'm a trans woman with depression and need someone LGBTQ affirming", { conditions: ["depression"], humanFit: ["lgbtq-affirming"], manner: ["lgbtq-affirming"] }],
  ["I'm Aboriginal and want a culturally safe doctor for my anxiety", { conditions: ["anxiety"], humanFit: ["culturally-safe"] }],
  ["depression, must speak Arabic", { conditions: ["depression"], language: "arabic", mandatory: ["language"] }],
  ["my mum in her 70s has low mood and no motivation", { conditions: ["depression"], population: "older-adult" }],
  ["ADHD, I don't want medication, just someone who listens", { conditions: ["adhd"], humanFit: ["listens"] }],
  ["adhd and autism assessment for my daughter", { conditions: ["autism", "adhd"], population: "child" }],
  ["I want to die tonight", { conditions: [], urgency: "emergency" }],
  ["I had a thought of harming my baby", { conditions: [], urgency: "emergency" }],
  ["hello I would like some help please", { conditions: [], specialties: [] }],
  // ---- Overlooked chronic conditions
  ["I've had chronic pain for years and nobody takes me seriously", { conditions: ["chronic-pain"], specialties: ["pain-medicine", "rheumatology", "rehabilitation-medicine", "psychiatry", "general-practice"], humanFit: ["listens"] }],
  ["chronic fatigue syndrome, mostly housebound so telehealth only", { conditions: ["chronic-fatigue"], telehealth: "only", mandatory: ["telehealth"] }],
  ["fibromyalgia and I want evidence based care", { conditions: ["fibromyalgia"], specialties: ["rheumatology", "pain-medicine", "general-practice"], humanFit: ["evidence-based"] }],
  ["long covid with brain fog and I'm exhausted all the time", { conditions: ["chronic-fatigue", "long-covid"] }],
  ["POTS, my heart races when I stand and I keep being told it's anxiety", { conditions: ["pots", "anxiety"], specialties: ["cardiology", "neurology", "general-practice", "psychiatry", "psychology"] }],
  ["functional neurological disorder and I want someone who doesn't think it's all in my head", { conditions: ["fnd"], specialties: ["neurology", "psychiatry", "rehabilitation-medicine"], humanFit: ["listens"] }],
  ["hypermobility and my joints dislocate, has to be a woman", { conditions: ["hypermobility"], gender: "woman", mandatory: ["gender"] }],
  ["IBS and bloating and pain for years, I want someone holistic", { conditions: ["ibs"], specialties: ["gastroenterology", "general-practice"], humanFit: ["holistic"] }],
  ["nerve pain since my surgery and I cannot wait, it's getting worse fast", { conditions: ["chronic-pain"], urgency: "urgent" }],
  ["migraines every week and I want someone who speaks Mandarin", { conditions: ["chronic-pain"], language: "mandarin", mandatory: [], urgency: "routine" }],
  ["chronic pain and lived experience matters to me, someone who has been through it", { conditions: ["chronic-pain"], humanFit: ["lived-experience"] }],
];

describe("the intent read: 44 sentences across the three categories", () => {
  it("covers at least 40 sentences", () => {
    expect(SENTENCES.length).toBeGreaterThanOrEqual(40);
  });

  it.each(SENTENCES.map(([sentence, expected], index) => [index + 1, sentence, expected] as const))("%i. %s", (_n, sentence, expected) => {
    const intent = intentOf(sentence);
    expect(intent.discipline).toBe("mvp");
    expect([...intent.conditions].sort()).toEqual([...expected.conditions].sort());
    if (expected.specialties) expect([...(intent.specialties ?? [])].sort()).toEqual([...expected.specialties].sort());
    if (expected.gender) expect(intent.constraints.gender).toBe(expected.gender);
    else expect(intent.constraints.gender).toBeUndefined();
    if (expected.mandatory) expect(intent.mandatory).toEqual(expected.mandatory);
    if (expected.humanFit) expect(intent.humanFit).toEqual(expected.humanFit);
    if (expected.population) expect(intent.population).toBe(expected.population);
    expect(intent.urgency).toBe(expected.urgency ?? "routine");
    if (expected.language) expect(intent.constraints.language).toBe(expected.language);
    if (expected.telehealth) expect(intent.constraints.telehealth).toBe(expected.telehealth);
    if (expected.billing) expect(intent.constraints.billing).toBe(expected.billing);
    if (expected.manner) expect(intent.manner).toEqual(expected.manner);
    // The specialty set is exactly the union the yaml declares for the conditions read.
    expect(intent.specialties).toEqual(specialtiesFor(intent.conditions, MVP));
  });

  it("the plan's postpartum query reads as the plan says it should", () => {
    const intent = intentOf(POSTPARTUM);
    // Allied health (2026-10-19): psychologists treat perinatal mental health too (mvp.yaml).
    expect(new Set(intent.specialties)).toEqual(new Set(["psychiatry", "obstetrics-gynaecology", "general-practice", "psychology"]));
    expect(intent.constraints.gender).toBe("woman");
    expect(intent.humanFit).toEqual(["listens"]);
    expect(intent.population).toBe("perinatal");
    expect(intent.mandatory).toEqual([]); // "looking for a female doctor" is a preference, not a must
  });

  it("mandatory phrasing: must, only, has to be, need a; preference phrasing stays flexible", () => {
    expect(isMandatory("I need a female doctor", "female doctor")).toBe(true);
    expect(isMandatory("it must be a woman", "woman")).toBe(true);
    expect(isMandatory("women only please", "woman")).toBe(false); // inflection is "women", not "woman"; the lexicon hears the ask, the mandate needs the matched phrase
    expect(isMandatory("female only", "female")).toBe(true);
    expect(isMandatory("has to be by telehealth", "telehealth")).toBe(true);
    expect(isMandatory("I would prefer a woman", "woman")).toBe(false);
    expect(isMandatory("ideally a woman", "woman")).toBe(false);
  });
});

describe("Layer 1: hard filters with named reasons", () => {
  it("wrong specialty is read against the condition's specialty set, not one discipline", () => {
    const result = run("endometriosis");
    expect(excludedAs(result, "wrong-specialty")).toEqual(["mvp-aoki", "mvp-brandt", "mvp-faure", "mvp-gill", "mvp-hart", "mvp-ivers", "mvp-jensen"]);
    expect(ids(result.survivors).sort()).toEqual(["mvp-costa", "mvp-dunne", "mvp-eze"]);
    expect(excludedAs(result, "closed-books")).toEqual(["mvp-closed"]);
  });

  it("perinatal mental health passes psychiatrists AND gynaecologists, and excludes the paediatrician", () => {
    const result = run("postpartum depression");
    expect(excludedAs(result, "wrong-specialty")).toEqual(["mvp-gill"]);
    expect(ids(result.survivors)).toEqual(expect.arrayContaining(["mvp-aoki", "mvp-brandt", "mvp-costa"]));
  });

  it("no condition asked means no specialty filter", () => {
    const result = run("hello I would like some help please");
    expect(excludedAs(result, "wrong-specialty")).toEqual([]);
    expect(result.survivors).toHaveLength(MVP_DOCTORS.length - 1); // only the closed books go
    expect(result.order).toBe("unmatched");
  });

  it("a MANDATORY gender filters; an undeclared gender is not a mismatch", () => {
    const result = run("I need a woman doctor for chronic pain");
    expect(excludedAs(result, "gender-mismatch")).toEqual(["mvp-brandt", "mvp-ivers"]);
    expect(ids(result.survivors)).toContain("mvp-hart"); // gender not declared: passes, ranks below
    expect(ids(result.survivors)).toContain("mvp-jensen");
    expect(result.intent?.mandatory).toEqual(["gender"]);
  });

  it("a FLEXIBLE gender ranks: nobody is excluded, the woman leads the constraint tier", () => {
    const result = run("I'd prefer a woman for my depression");
    expect(excludedAs(result, "gender-mismatch")).toEqual([]);
    expect(result.survivors[0]!.doctor.gender?.value).toBe("woman");
    expect(result.intent?.mandatory).toEqual([]);
  });

  it("a mandatory language filters to the declared speakers", () => {
    const result = run("depression, must speak Arabic");
    expect(ids(result.survivors)).toEqual(["mvp-ivers"]);
    // Eleven listed: one passes, five are the wrong specialty, five declare no Arabic.
    expect(result.excluded.filter((e) => e.reason === "language-mismatch").length).toBe(5);
    expect(run("depression and ideally someone who speaks Arabic").excluded.filter((e) => e.reason === "language-mismatch")).toEqual([]);
  });

  it("telehealth only and bulk billing only remain hard, with the ported reasons", () => {
    expect(excludedAs(run("anxiety, telehealth only"), "no-telehealth")).toEqual(["mvp-ivers", "mvp-jensen"]);
    expect(excludedAs(run("endo, bulk billing only"), "billing-mismatch")).toEqual(["mvp-costa", "mvp-dunne", "mvp-eze"]);
  });

  it("out of reach from Brisbane excludes Toowoomba rooms, and a telehealth-only doctor carries no distance", () => {
    const result = run("depression", BRISBANE);
    expect(excludedAs(result, "out-of-reach")).toEqual(["mvp-jensen"]);
    const hart = run("chronic pain", BRISBANE).survivors.find((r) => r.doctor.id === "mvp-hart")!;
    expect(hart.distanceKm).toBeUndefined();
  });

  it("everyone filtered: the unserved breakdown names each filter with its restore count", () => {
    const result = run("fibromyalgia");
    expect(result.order).toBe("unserved");
    expect(result.results).toEqual([]);
    expect(result.unserved).toEqual([
      { ask: "a different specialty", restoreCount: MVP_DOCTORS.length },
    ]);
    expect(result.intent?.specialties).toEqual(["rheumatology", "pain-medicine", "general-practice"]);
  });
});

describe("Layer 1: clinical bands", () => {
  it("documented declarers rank above plausible ones, and plausible ones are kept with the specialty reason", () => {
    const result = run("chronic pain");
    const bands = result.survivors.map((r) => [r.doctor.id, r.clinicalFit.band] as const);
    expect(bands[0]).toEqual(["mvp-hart", "documented"]);
    const plausible = result.survivors.filter((r) => r.clinicalFit.band === "plausible");
    expect(plausible.map((r) => r.doctor.id).sort()).toEqual(["mvp-aoki", "mvp-brandt", "mvp-faure", "mvp-ivers", "mvp-jensen"]);
    for (const card of plausible) {
      expect(card.clinicalFit.reasons[0]!.text).toBe("Listed under psychiatry, which treats Persistent pain; no documented focus on it yet");
      expect(card.clinicalFit.reasons[0]!.field).toBe("specialty");
    }
    const hart = result.survivors[0]!;
    expect(hart.clinicalFit.reasons[0]).toEqual({ text: "Declares Persistent pain as a condition they see", field: "conditions", label: "chronic-pain", tier: "declared" });
  });

  it("a 'sometimes' declaration is documented, at the sometimes tier and half weight", () => {
    const result = run("postpartum depression");
    const costa = result.survivors.find((r) => r.doctor.id === "mvp-costa")!;
    expect(costa.clinicalFit.band).toBe("documented");
    expect(costa.clinicalFit.reasons[0]!.text).toBe("Sees Perinatal mental health sometimes");
    expect(costa.clinicalFit.reasons[0]!.field).toBe("conditionsSometimes");
    expect(costa.score).toBeLessThan(result.survivors.find((r) => r.doctor.id === "mvp-brandt")!.score);
  });

  it("no condition asked: every card is 'listed' with its specialty", () => {
    const result = run("hello I would like some help please");
    for (const card of eachOf(result.survivors, "the survivors")) {
      expect(card.clinicalFit.band).toBe("listed");
      expect(card.clinicalFit.reasons[0]!.text).toMatch(/^Listed under /);
    }
  });

  it("a population the doctor declares is a reason; one they do not is not", () => {
    const result = run("postpartum depression");
    const aoki = result.survivors.find((r) => r.doctor.id === "mvp-aoki")!;
    expect(aoki.clinicalFit.reasons.map((r) => r.text)).toContain("Sees patients during pregnancy and after birth");
    const costa = result.survivors.find((r) => r.doctor.id === "mvp-costa")!;
    expect(costa.clinicalFit.reasons.map((r) => r.field)).not.toContain("populations");
  });
});

describe("Layer 2: human fit reorders inside a Layer-1 band only", () => {
  const SAME_BAND = "postpartum depression and someone who won't just dismiss how I'm feeling";

  it("two psychiatrists in one band: the listener's profile lifts her; zero weights restore Layer-1 order", () => {
    const result = run(SAME_BAND);
    const aoki = result.survivors.find((r) => r.doctor.id === "mvp-aoki")!;
    const brandt = result.survivors.find((r) => r.doctor.id === "mvp-brandt")!;
    expect(aoki.layer1.band).toBe(brandt.layer1.band);
    expect(ids(result.survivors).indexOf("mvp-aoki")).toBeLessThan(ids(result.survivors).indexOf("mvp-brandt"));
    expect(aoki.humanFit).toEqual({
      score: 2,
      basis: "doctor-approved",
      reasons: [
        { text: "Their philosophy of care reads as listens and takes you seriously", field: "personal.labels", label: "listens" },
        { text: "Says they particularly enjoy working with new and expecting parents", field: "personal.enjoysServing", label: "perinatal" },
      ],
    });
    expect(brandt.humanFit).toEqual({ score: 0, basis: "none", reasons: [{ text: NO_PROFILE_REASON, field: "personal" }] });

    const flat = rerank(result.survivors, result.intent!, ZERO_WEIGHTS, MVP);
    expect(ids(flat)).toEqual([...result.survivors].sort((a, b) => a.layer1.position - b.layer1.position).map((r) => r.doctor.id));
    for (const card of flat) expect(card.humanFit.score).toBe(0);
  });

  it("the plan's pelvic-pain query: Costa leads on both layers, with lived experience, collaboration and research named", () => {
    const result = run(PELVIC);
    expect(result.results[0]!.doctor.id).toBe("mvp-costa");
    const costa = result.results[0]!;
    expect(costa.clinicalFit.band).toBe("documented");
    expect(costa.humanFit.basis).toBe("illustrative");
    expect(costa.humanFit.reasons.map((r) => r.text)).toEqual([
      "Their philosophy of care reads as collaborative",
      "Shares lived experience they chose to disclose",
      "Has published on endometriosis",
      "Lists persistent pelvic pain among their clinical interests",
      "Lists endometriosis among their clinical interests",
    ]);
    expect(costa.humanFit.score).toBe(5);
    // Eze declares both conditions too but offers evidence-based/direct, which this reader did not ask for.
    const eze = result.survivors.find((r) => r.doctor.id === "mvp-eze")!;
    expect(eze.humanFit.score).toBe(0);
    expect(eze.humanFit.basis).toBe("doctor-approved");
    expect(eze.humanFit.reasons).toEqual([]);
  });

  it("weights move what matters without re-searching: research off drops the research reason and score", () => {
    const result = run(PELVIC);
    const adjusted = rerank(result.survivors, result.intent!, { research: 0, clinicalInterests: 0 }, MVP);
    const costa = adjusted.find((r) => r.doctor.id === "mvp-costa")!;
    expect(costa.humanFit.score).toBe(2);
    expect(costa.humanFit.reasons.map((r) => r.field)).toEqual(["personal.labels", "personal.livedExperience"]);
    // The data layer's shorter names are accepted too.
    const aliased = rerank(result.survivors, result.intent!, { communication: 3, lived: 0, research: 0, clinicalInterests: 0 }, MVP);
    expect(aliased.find((r) => r.doctor.id === "mvp-costa")!.humanFit.score).toBe(3);
    // And the discipline can be left to the intent.
    expect(ids(rerank(result.survivors, result.intent!, { research: 0 }))).toEqual(ids(rerank(result.survivors, result.intent!, { research: 0 }, MVP)));
  });

  it("the shown slice is re-headlined after the reorder", () => {
    const result = run(PELVIC);
    expect(result.results).toEqual(shown(result.survivors));
    expect(result.results[0]!.headline).toBe("In common: Persistent pelvic pain");
    expect(result.results[1]!.headline).toBe("In common: Endometriosis");
    // Every survivor carries a headline, and the shown slice is the first RESULTS_SHOWN of the Layer-2 order.
    expect(ids(result.results)).toEqual(ids(result.survivors).slice(0, 3));
  });

  it("a draft profile reads as no profile; a profile that aligns with nothing scores zero with its basis", () => {
    const adhd = run("adhd for my daughter, someone who listens");
    const gill = adhd.survivors.find((r) => r.doctor.id === "mvp-gill")!;
    expect(gill.humanFit).toEqual({ score: 0, basis: "none", reasons: [{ text: NO_PROFILE_REASON, field: "personal" }] });
    const depression = run("depression and someone who listens");
    const jensen = depression.survivors.find((r) => r.doctor.id === "mvp-jensen")!;
    expect(jensen.humanFit).toEqual({ score: 0, basis: "illustrative", reasons: [] });
  });

  it("declared communication labels and declared manner both count as evidence, with their fields", () => {
    const result = run("chronic pain and someone trauma informed and gentle");
    const hart = result.survivors.find((r) => r.doctor.id === "mvp-hart")!;
    expect(hart.humanFit.reasons.map((r) => [r.text, r.field])).toEqual([
      ["Describes their approach as gentle", "personal.communication"],
      ["Describes their approach as trauma-informed", "personal.communication"],
      ["Lists persistent pain among their clinical interests", "clinicalInterests"],
    ]);
    const brandt = run("bipolar and someone direct").survivors.find((r) => r.doctor.id === "mvp-brandt")!;
    expect(brandt.humanFit).toEqual({ score: 1, basis: "none", reasons: [{ text: "Declares a direct manner", field: "manner", label: "direct", tier: "declared" }] });
  });

  it("research-active and lived-experience asks read presence, never the words", () => {
    const research = run("adhd and someone up to date with research");
    const faure = research.survivors.find((r) => r.doctor.id === "mvp-faure")!;
    expect(faure.humanFit.reasons.map((r) => r.text)).toEqual(["Has published research", "Has published on adhd"]);
    const lived = run("adhd and someone who has been through it");
    expect(lived.survivors.find((r) => r.doctor.id === "mvp-faure")!.humanFit.reasons.map((r) => r.text)).toEqual(["Shares lived experience they chose to disclose", "Has published on adhd"]);
    const enjoys = run("postpartum depression").survivors.find((r) => r.doctor.id === "mvp-aoki")!;
    expect(enjoys.humanFit.reasons.map((r) => r.text)).toContain("Says they particularly enjoy working with new and expecting parents");
  });
});

/** Walk a dotted path on the doctor. */
function at(doctor: Doctor, path: string): unknown {
  return path.split(".").reduce<unknown>((value, key) => (value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined), doctor);
}

function holds(value: unknown, label: string): boolean {
  if (Array.isArray(value)) return value.includes(label);
  if (value && typeof value === "object" && "value" in value) return holds((value as { value: unknown }).value, label);
  return value === label;
}

describe("explanations trace to evidence on the doctor (plan Task 8)", () => {
  const check = (reason: Reason, doctor: Doctor) => {
    if (reason.text === NO_PROFILE_REASON) {
      expect(reason.field).toBe("personal");
      expect(doctor.personal === undefined || doctor.personal.status === "draft").toBe(true);
      return;
    }
    const value = at(doctor, reason.field);
    expect(value, `${doctor.id}: "${reason.text}" names ${reason.field}, which is absent`).not.toBeUndefined();
    const inner = value && typeof value === "object" && "value" in (value as object) ? (value as { value: unknown }).value : value;
    expect(Array.isArray(inner) ? inner.length > 0 : typeof inner === "string" ? inner.length > 0 : true, `${doctor.id}: ${reason.field} is empty`).toBe(true);
    if (reason.label !== undefined) expect(holds(value, reason.label), `${doctor.id}: ${reason.field} does not hold ${reason.label}`).toBe(true);
  };

  it("every clinical-fit and human-fit reason across all 44 sentences names a present field that holds its label", () => {
    for (const [sentence] of SENTENCES) {
      const result = run(sentence);
      for (const card of result.survivors) {
        for (const reason of card.clinicalFit.reasons) check(reason, card.doctor);
        for (const reason of card.humanFit.reasons) check(reason, card.doctor);
      }
    }
  });

  it("fails on a reason without evidence (the test's own teeth)", () => {
    const doctor = MVP_DOCTORS.find((d) => d.id === "mvp-brandt")!;
    expect(() => check({ text: "Shares lived experience they chose to disclose", field: "personal.livedExperience" }, doctor)).toThrow();
    expect(() => check({ text: "Declares X", field: "conditions", label: "fibromyalgia" }, doctor)).toThrow();
  });
});

describe("urgency", () => {
  it("an emergency cue routes to 000 and ranks nothing", () => {
    const result = run("I had a thought of harming my baby");
    expect(result.emergency).toEqual({ note: EMERGENCY_NOTE });
    expect(result.results).toEqual([]);
    expect(result.careGuidance).toBeUndefined();
  });

  it("an urgent cue keeps the ranking and adds care guidance; routine sentences carry none", () => {
    const urgent = run("postnatal anxiety since the birth, I need to be seen this week");
    expect(urgent.careGuidance).toBe(CARE_GUIDANCE);
    expect(urgent.results.length).toBeGreaterThan(0);
    expect(urgent.intent?.urgency).toBe("urgent");
    expect(run("postnatal anxiety since the birth").careGuidance).toBeUndefined();
    // Guidance is carried even when the filters leave nobody.
    expect(run("fibromyalgia, getting worse fast").careGuidance).toBe(CARE_GUIDANCE);
  });
});

describe("the call shapes", () => {
  it("the ported positional call and the options call agree, and a sixth-argument options bag is read", () => {
    const positional = match(PELVIC, null, MVP_DOCTORS, MVP, TODAY);
    const options = match(PELVIC, null, MVP_DOCTORS, { discipline: MVP, today: TODAY });
    expect(ids(positional.survivors)).toEqual(ids(options.survivors));
    const extra = match(PELVIC, null, MVP_DOCTORS, MVP, TODAY, { weights: ZERO_WEIGHTS });
    expect(extra.survivors.find((r) => r.doctor.id === "mvp-costa")!.humanFit.score).toBe(0);
  });

  it("the psychiatry discipline still runs through the same pipeline with its own vocabulary", () => {
    const result = match("I need an ADHD assessment", null, MVP_DOCTORS, { discipline: "psychiatry", today: TODAY });
    expect(result.intent?.specialties).toEqual(["psychiatry"]);
    expect(excludedAs(result, "wrong-specialty")).toEqual(["mvp-closed", "mvp-costa", "mvp-dunne", "mvp-eze", "mvp-gill"]);
  });
});
