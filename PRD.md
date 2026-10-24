# Wattle Health — Product Requirements

**Status:** v0.2, 2026-10-15. Founder review pending.
**Owner:** Wattle Technologies. Wattle Health is a sibling venture of ADHD.ME, not a feature of it.
**Companions:** `RESEARCH-PLAN.md` (sources, access, cost, order of work), `DATA-MODEL.md` (schema), `research/raw/` (source-by-source findings with URLs).

---

## 1. What it is

A person describes what they need, in their own words. Wattle Health returns the three doctors who fit, says why, says what it will cost and whether they are taking new patients, and hands off to book. It starts with three specialties, extends to every doctor in Australia, then to allied health and the service system. ADHD.ME proved the search feels right for one condition; Wattle Health generalises the feel without reusing the code.

## 2. The problem

Finding the *right* doctor in Australia is a referral-letter lottery. The only comprehensive list of doctors is the Ahpra register, which has no contact details, no fees and no capacity. healthdirect's directory is a taxonomy browse ranked by distance. College "find a" pages are opt-in and thin: RACS lists about 100 of 6,745 surgeons; RACP, RANZCO, ACEM and RANZCR publish no patient directory at all. Booking platforms list only paying practices. Nobody in the country publishes which specialists are accepting new referrals or what they charge. (Sources: `research/raw/02-medical-disciplines.md` §0, §3, §4, §18.)

The cost is the gap between need and first appointment. Psychiatry referral waits rose from 51 to 77 days nationally between 2011 and 2022; 30% of private child psychiatry practices were closed to new referrals in a secret-shopper study. Public dental waits run 200 to 1,300 days by state. The Senate's 2023 ADHD inquiry recorded waits of months to years. Access is prior to quality: a doctor you cannot find has no quality to measure.

## 3. Who it is for

| Persona | Arrives with | Leaves with |
|---|---|---|
| **The searcher** (primary): an adult on a phone, often for someone else, often anxious | A paragraph and a suburb | Three doctors who fit, why, cost tier, capacity signal, a way to book |
| **The parent or carer** | A child's or parent's need plus travel limits | Age-group fit, languages, access, carer-friendly hours |
| **The referrer** (GP, nurse, school counsellor) | A patient in the room and a referral to write | Current capacity, referral requirements, fee tier, secure-messaging endpoint |
| **The doctor or practice manager** | A listing they did not write | A claim flow, corrections within 24 h, declarations that are shown as theirs, nothing that breaches s.133 |

## 4. Rules carried from ADHD.ME

Each of these was learned by getting it wrong first (`C:\Users\stefa\adhd.me`, ROADMAP.md and `docs/design/text-budget-postmortem.md`). They are requirements here.

1. **One sentence, not a form.** Specialty, condition, population, manner, language, gender preference, telehealth, billing are read from free text. Clarifiers come *after* results and only for facets the roster actually splits on.
2. **Access constraints sort first.** Language, gender, telehealth, billing. A doctor who fails a stated constraint never outranks one who meets it by stacking soft matches.
3. **Condition before manner.** A clinical-interest match outranks any number of bedside-manner traits.
4. **Capacity at equal fit.** Fresh-open (declared ≤90 days) before stale-open before closed. Closed books stay visible with the reason.
5. **Say what the order means.** One sentence under the heading: informed, tied, unmatched, or unserved. When nobody fits, name the gap; never blame the reader.
6. **"Why matched" uses closed vocabulary**, never the patient's own words. Compare shows rows, never a score.
7. **No fabricated availability.** Booking is a handoff unless a platform gives us real slots.
8. **Declarations are not verifications.** Every fact is tagged with where it came from.
9. **Text budget 20 to 60 words per whole screen**, 40 target, measured in CI including footer chrome.
10. **No testimonials, ratings, superlatives, or "specialist" outside an Ahpra specialty.** We are the advertiser under s.133.
11. **Disclosure beside the listing, never in the rank.**
12. **Telehealth-first doctors are not sorted by distance.** Distance uses the nearest of a doctor's locations.

## 5. MVP: three specialties first

### 5.1 The choice

| Specialty | Doctors (Ahpra, June 2026) | Why first |
|---|---|---|
| **Psychiatry** | 5,343 | Highest unmet demand of any specialty with the worst discovery. Mean referral wait 77 days; a third of child practices closed to new referrals. RANZCP's directory is opt-in and incomplete. Patients arrive with a paragraph ("my son is 15, school says ADHD, we've tried a psychologist, bulk-billing matters"), not a specialty name. Adjacent to ADHD.ME's roster, evidence and copy linters. |
| **Paediatrics** (general and subspecialty) | 4,469 | No public directory exists at all: RACP's member directory is login-only. Parents are the highest-intent, highest-volume searchers in health, and the need is usually a condition (autism, ADHD, feeding, growth, developmental delay) that maps badly to "paediatrician near me". Waits for developmental assessment are the longest in the system. |
| **Obstetrics, gynaecology and women's health** | 2,470 O&G plus GP obstetricians and GPs with women's-health interests | The brief's "commonly overlooked conditions" live here: endometriosis (7 to 9 years to diagnosis), PCOS, menopause, pelvic pain, perinatal mental health. RANZCOG's directory mixes Fellows, procedural GPs and certificants, so credential tier is the first thing a patient cannot tell. Fee opacity is extreme (private obstetric packages). Wattle Technologies' earlier CareYield work on PCOS and perinatal care gives a tested care-area vocabulary. |

**Why not GPs first.** Everyone needs one, but the GP problem is capacity and billing, not *which one*, and the two facts a patient wants (bulk-bills, taking new patients) are now a mandated NHSD flag (BBPIP practices must register as bulk-billing-only since 1 Nov 2025) and a HotDoc field. GPs are the spine of Phase 2 because every specialist search ends in a GP referral; they are not the proof of the matching idea.

**Why these three together.** They share the same intent shape (a condition, a person, a constraint), the same hard gap (nobody publishes capacity or fees), the same referral pathway (GP letter), and the same compliance surface. One matcher, three vocabularies.

### 5.2 Launch geography

Greater Sydney and Greater Melbourne for the three specialties (roughly 60% of each specialty's registrations), telehealth included nationally. Register coverage is national from day one; enrichment and claim outreach concentrate where the density pays back.

### 5.3 MVP success

| Measure | Target at week 12 |
|---|---|
| Doctors in the three specialties resolved to at least one location | ≥ 85% of Ahpra registrations in launch cities |
| Doctors with a fee tier (bulk-bills / gap / private) from a public or declared source | ≥ 40% |
| Doctors with a capacity signal ≤ 90 days old | ≥ 25% (healthdirect: ~0%) |
| Claimed profiles | 300 |
| Match quality (§8): queries where ≥ 2 of the 3 results are rated "would refer" by blinded clinician raters | ≥ 80% (baseline healthdirect/Google: measure, expect < 40%) |
| Zero-bad-match rate: queries with no result rated "wrong" | ≥ 95% |
| Sentence to three results, P75 on a phone | ≤ 45 s |

## 6. The patient experience (seven screens)

1. **Ask.** One box. "Tell us what's going on." Type or speak. One line: "Leave out names and anything urgent." Emergency language (chest pain, overdose, self-harm) replaces the screen with 000 and the nearest ED.
2. **Where.** Suburb or current location. Required for Medicare and state pathways even when telehealth is wanted.
3. **Results.** Three cards. One sentence stating what the order means. Pills derived from the sentence (Bulk-billing, Telehealth, Woman doctor, Language, Open books). "One answer would narrow it": up to three clarifiers. Map behind a toggle.
4. **Profile.** §7.
5. **Compare.** Two side by side, a row per ask, yes / no / not declared.
6. **Book.** Practice phone, practice site, or platform deep link. Referral requirement stated plainly ("Needs a GP referral for the Medicare rebate; here is what to ask for"). "This was wrong" link.
7. **Afterwards.** Optional, one tap: "Did you get seen?" Feeds capacity freshness. It is a fact, not a rating.

## 7. The doctor profile

Conventional directories show name, specialty, address, phone. Patients decide on five other things. The profile is built around those, with three source tiers and no more.

| Tier | Badge | What qualifies |
|---|---|---|
| **Register** | "On the Ahpra register" | Pulled from Ahpra data under agreement or via Provider Connect Australia; refreshed; linked |
| **Declared** | "From Dr X" with a date | Entered by the doctor or practice through the claim flow; expires at 90 days for capacity and fees, 365 for everything else |
| **Found** | "From [source]" with a date | Inferred from a public page we are permitted to use: practice site, college directory, hospital directory, PubMed. Facts only, never prose or photos |

Anything with no tier renders "not declared". That is the whole verification system. It is three labels and a date; there is no scoring of trustworthiness.

### 7.1 Sections, in order

1. **Best for.** Two lines in closed vocabulary: conditions and populations this doctor treats most (Declared, else Found from practice site and college tags).
2. **Register check.** Ahpra number, registration status, specialty and field of practice, endorsements, "conditions apply: see register" as a boolean, languages (Ahpra publishes spoken languages), qualifications. Link to the register entry. (Register)
3. **What it costs.** Fee tier; initial and review consult fees where declared or published; whether a referral is needed for the rebate; Medical Costs Finder typical fee for the specialty and postcode as a fallback, labelled as such. (Declared / Found)
4. **Can you get in.** Accepting new referrals: yes / waitlist (weeks) / no / unknown, with the date. Telehealth: none / some / first appointment / only. Age groups seen. (Declared, else Found from practice site)
5. **How they work.** Clinical interests, treatment approaches (closed list per specialty: e.g. psychiatry: medication-led, psychotherapy-led, combined, ADHD assessment, perinatal, eating disorders, neurodevelopmental), what a first appointment looks like, years in the specialty. (Declared)
6. **Where they work.** Each location with hours, access, parking note, public hospital appointments and private rooms. Nearest-first. (Found from NHSD/PCA, Declared)
7. **Published work.** Up to five publications matched on name and affiliation via PubMed/ORCID, shown only once the doctor confirms them in the claim flow, so a false match never appears. (Declared after Found)
8. **Why matched.** Closed-vocabulary evidence against each ask in the sentence. (Computed)
9. **Disclosures.** Any relationship with Wattle. (Wattle)

Not shown, ever: reviews, ratings, star counts, "top", "leading", patient quotes, generated photos, inferred gender, Medicare provider numbers, the text of register conditions.

## 8. Matching

### 8.1 Pipeline

```
sentence ─► intent extraction ─► hard filters ─► tiered rank ─► order honesty ─► rationale
                 │                     │              │
          closed schema          named reasons   doctor-side hook (P2)
```

1. **Intent extraction.** Lexical, not an LLM call (ADHD.ME showed a closed vocabulary with synonym cues reads a sentence well enough, and ranking stays deterministic and property-tested; the decisions loop in `src/decisions` is where a model is used, 2026-10-24). Output is a closed schema per specialty: `specialty`, `conditions[]`, `population` (child / adolescent / adult / older / perinatal), `constraints` (language, gender, telehealth, billing, max distance), `manner[]`, `urgency`, `referral_in_hand`. Each vocabulary term carries cue phrases and refused cues (negations, "not", "other than"). Anything outside the vocabulary is dropped, not invented. Extraction is deterministic and unit-tested against the golden set. The sentence is never stored with an identifier; the extraction is.
2. **Hard filters**, each with a named reason the UI can show: wrong specialty, not accepting and no waitlist, wrong age group, billing mismatch when the patient said "bulk-billing only", no telehealth when "telehealth only", out of reach (> 30 km in-person, or "either" and no telehealth), registration not current.
3. **Tiered rank** (ADHD.ME's rule set, generalised):
   - Tier A: access constraints met (language, gender, telehealth, billing).
   - Tier B: condition and population fit: cosine similarity between the extracted intent and the doctor's profile embedding (closed-concept layer plus hashed-stem layer, as in ADHD.ME, specialty-specific vocabulary; a dense model is swappable behind the same interface). "Sometimes" interests count half.
   - Tier C: manner, contributory only.
   - Tier D: coverage (answers more distinct asks), then capacity freshness, then distance (unless telehealth-first), then a deterministic hash for exact ties.
4. **Order honesty.** `informed` when top scores separate by the ratio threshold; `tied` otherwise; `unmatched` when extraction found no specialty; `unserved` when filters leave nobody, naming the unmet ask and how many results dropping each filter would restore.
5. **Rationale.** "In common: &lt;top shared concept&gt;" plus up to five closed-vocabulary points. Each card's headline must differ from the others' or the second-best concept is used (fixes the "same rationale three times" problem ADHD.ME logged on 2026-09-21).

### 8.2 Doctor-side hook

The ranker takes a doctor-side score function from day one. In v1 it returns a constant. In P2 it reads declared caseload preferences (ages, complexity, styles, capacity, minimum fit) and the pipeline becomes ADHD.ME's two-sided deferred acceptance (ADR 0007). No schema change is needed to turn it on.

### 8.3 Evaluation: real queries, independent judgement

The goal is substantially better than healthdirect and Google, not a publishable IR paper.

- **Golden set.** 300 real brain-dumps per specialty, collected from (a) consented patient intake at ADHD.ME and the Wattle Health "Ask" box once live, (b) de-identified requests posted publicly on Australian forums (Reddit r/australia, r/AusParents, Beyond Blue forums), rewritten to remove identifiers, (c) 50 written by clinicians to cover edge cases: emergencies, wrong specialty, two conditions, non-English, rural, telehealth-only, under-18 with adult wording.
- **Raters.** Two clinicians per specialty (a GP and a specialist), blinded to system, rating each result 1 to 4: wrong / plausible / good / would refer. Agreement checked with Cohen's kappa; disagreements adjudicated.
- **Metrics.** Would-refer@3 (share of queries with ≥ 2 results at 4), nDCG@3, zero-wrong rate, extraction accuracy on the closed schema (spot-checked on 100 per release), `unserved` rate and whether the named gap was real.
- **Baselines.** healthdirect Service Finder (specialty + suburb), Google ("psychiatrist &lt;suburb&gt;"), and RANZCP / RANZCOG find-a tools. Same raters, same scale.
- **Cadence.** Every release runs the golden set in CI and fails on regression of would-refer@3 by more than 2 points. Monthly: 100 live queries sampled, de-identified, rated, folded into the golden set. Vocabulary changes come from the misses: every `unmatched` and every rater "wrong" is a ticket.
- **Learning loop.** "Did you get seen?" and "this was wrong" feed a bounded reweighting (minimum 50 records, weights move at most half per cycle), as ADHD.ME does. Nothing learns from clicks alone.

## 9. Provider side

- **Claim.** Ahpra number plus an email at the practice domain, or a code posted to the practice. The register lookup during a claim is a single personal-use query, which Ahpra's terms permit.
- **Declare.** Capacity (slider plus "declared on"), fees by consult type, interests, approaches, populations, telehealth, languages, locations, hours, referral requirements. Expiry nudges by email at 75 days.
- **Correct.** Any Found fact can be corrected or removed; the profile shows "corrected by the practice, &lt;date&gt;".
- **Nothing to pay. Nothing affects rank.** If Wattle ever sells anything, it is tooling and data to practices and commissioners, visually separated and disclosed per ACCC comparator guidance.
- **Provider Connect Australia.** Once Wattle is a PCA business partner, a practice that already maintains PCA sees its details flow in automatically; claiming is then a confirmation, not data entry.

## 10. Requirements

### P0

| ID | Requirement | Acceptance |
|---|---|---|
| R1 | Three specialties, every registered doctor present | Count of profiles = Ahpra specialist registrations ± 2% at refresh; each has register section populated and linked |
| R2 | Intent extraction to closed schema | ≥ 95% of golden-set queries extract the correct specialty; ≥ 85% extract every stated constraint; nothing outside the vocabulary is emitted |
| R3 | Tiered ranking | Property tests: a constraint-failing doctor never ranks above a constraint-meeting one; a condition match beats any number of manner traits; closed books never lose fit points |
| R4 | Order honesty | Four states render with correct copy; `unserved` names the ask and the count each filter would restore |
| R5 | Three-tier source badges | No fact renders without Register / Declared / Found and a date; "not declared" is rendered, never blank |
| R6 | Emergency intercept | Red-flag language routes to the 000 screen; no results shown; tested on 50 phrasings |
| R7 | Handoff booking with referral guidance | Phone, site, or platform link; referral requirement stated; never a fabricated time |
| R8 | Claim, declare, correct | Live within 24 h; expiry at 90/365 days visible on profile |
| R9 | Text-budget gate | CI fails any route over 60 words whole-screen at 390 px |
| R10 | s.133 and TGA copy linter | CI fails testimonials, superlatives, "specialist" outside Ahpra specialties, comparative claims, medicine brand names |
| R11 | Coverage dashboard, public | Per specialty × state × MMM: on register, resolved to a location, with fee tier, with capacity ≤ 90 d, claimed |
| R12 | Golden-set evaluation in CI | Release blocked on would-refer@3 regression > 2 points |
| R13 | Privacy | Sentence never stored with identifiers; request id is session-only and deletable; APP 1 policy names every source; ADM disclosure in place before 10 Dec 2026 |

### P1

- Referrer mode: secure-messaging endpoints from NHSD/PCA, referral template, fax flag.
- Interpreter (TIS National) facet; language-matched search from Ahpra spoken-languages field.
- Medical Costs Finder per-practitioner fees ingested the week they publish (late 2026 / early 2027).
- "Did you get seen?" loop live and feeding capacity freshness.
- Commissioner view with gap export by PHN.

### P2 (design for, do not build)

- Doctor-side preferences and deferred acceptance (ADR 0007).
- Real availability from HotDoc/HealthEngine via the NHSD Provider Appointments API; the model accepts slot data without change.
- HCAPD (ADHA's national provider directory, 2027) as a source and a destination: everything is modelled as FHIR AU Provider Directory resources so the export is a serialiser, not a migration.
- Multilingual UI.

## 11. Non-goals

- **Booking slots.** We hand off. Holding availability means integrating every PMS; that is HotDoc's business.
- **Symptom checking and triage.** healthdirect keeps the symptom checker and the nurse line. We route; we never diagnose. Emergencies get the 000 screen.
- **Reviews and ratings.** s.133 bans clinical testimonials and Ahpra holds the platform responsible once it advertises; HealthEngine paid $2.9m in 2020 for suppressing 17,000 reviews and selling 135,000 patients' details. Facts and declarations only.
- **My Health Record integration.** No IHI handling; no portal-operator registration.
- **Unregulated modalities.** No checkable credential, no listing.
- **Paid placement.** Ranking is never for sale.
- **Replacing college directories.** Every profile links to the authoritative source.

## 12. Architecture

- Next.js 15 / React 19 / TypeScript strict / Tailwind 4; Newsreader over Inter; wattle palette. Same house as ADHD.ME and wattletech.au. No ADHD.ME code is copied; the matcher is re-derived from the rules in §4 and §8.
- Supabase Postgres with PostGIS (geo) and pgvector (profile embeddings). Entities are FHIR-shaped (`Practitioner`, `PractitionerRole`, `Organization`, `Location`, `HealthcareService`) so NHSD, PCA and HCAPD ingest and export without remodelling.
- Ingestion is a Python pipeline of per-source adapters with a required `legal_basis` field; an adapter without one does not run. Scheduled through the existing fleet pattern (claude CLI and Task Scheduler on subscription, no API keys).
- Intent extraction and rationale are lexical and deterministic (closed vocabulary with cue phrases); no model call sits in the request path and no API key exists in the deploy.
- CI gates: typecheck, text budget, s.133/TGA linter, contrast, golden-set evaluation, coverage snapshot.

## 13. Legal posture (summary; detail in `research/raw/05-legal-competitive-strategy.md`)

- We are the advertiser under s.133 for every profile. No testimonials, no comparatives, no protected titles outside the register.
- Never scrape the Ahpra register in bulk (terms forbid it; Ahpra shut a scraper down in 2015). Get register data by paid extract ($2,000 per board per snapshot), by the PIE API for claimed profiles ($1 per practitioner per year after $4,000 setup), and via Provider Connect Australia (clause 11 register data to business partners).
- NHSD by licence: FHIR R4 Bulk Export, full every 3 months plus daily deltas, free to integration partners after onboarding. Infoxchange by API agreement for the community long tail.
- Facts from practice websites are not copyright (Telstra v Phone Directories); prose and photos are. Respect robots and rate limits; never create accounts to scrape.
- Practitioner profiles are personal information under the Privacy Act even when public: collection notice in the claim flow, correction and removal path, no "publicly available" exemption exists.
- Patient data is never shared with anyone. Outreach to practices only to published role addresses with identify and unsubscribe (Spam Act).
- Describe services, never medicines (TGA, June 2026 guidance on condition landing pages).

## 14. Open questions

| # | Question | Owner | Blocking |
|---|---|---|---|
| Q1 | PCA business-partner eligibility for a new entrant, delivery mechanism (push, FHIR pull, portal), fees. Email pca@digitalhealth.gov.au. | Founder | Yes, for the enrichment spine |
| Q2 | Ahpra Medical Board extract: scope, cost (expect $2,000 per snapshot), shareability under the Data Use Agreement, refresh cadence. | Founder | Yes, for R1 |
| Q3 | NHSD integration-partner licence terms, display and attribution rules, quota. | Founder | Yes, for locations |
| Q4 | RANZCP, RANZCOG, ACD: will they supply a feed of their opt-in directories? | Founder | No |
| Q5 | Does ADHD.ME's finder become the psychiatry/paediatrics ADHD view of Wattle Health? | Founder | No |
| Q6 | Legal entity for Wattle Health: same ABN questions still open on wattletech.au. | Founder + legal | No |
| Q7 | Clinician raters for the evaluation panel: two per specialty, paid or in-kind. | Founder | Yes, for R12 |

## 15. Phasing

| Phase | Weeks | Scope |
|---|---|---|
| 0 | 1 to 4 | Repo, FHIR-shaped schema, discipline vocabulary, seven screens on a fictional example roster, copy and text-budget gates, golden set v1 as data, coverage dashboard, pipeline skeleton with legal-basis guard. The matching engine is deferred by founder decision (2026-10-15); the UI runs a plain keyword ranker until then. Founder actions outside the repo: Ahpra extract, PCA application, NHSD licence. |
| 1 | 5 to 12 | Paediatrics and O&G/women's health. Ahpra extract loaded nationally. Claim flow live and outreach begun. Evaluation panel rating weekly. Medical Costs Finder typical fees. Launch in two cities. |
| 2 | 13 to 24 | All doctors: GPs via NHSD + BBPIP flag, then specialties ordered by directory quality (`RESEARCH-PLAN.md` §4). Referrer mode. Per-practitioner fees from Medical Costs Finder as released. |
| 3 | 25 to 40 | Allied health, Ahpra professions first, then NASRHP. NDIS and aged-care flags from open data. Service system (ACCHOs, UCCs, Medicare Mental Health centres, headspace, hospitals, pharmacies). |
| 4 | 40+ | Doctor-side matching, platform availability, HCAPD integration. |
