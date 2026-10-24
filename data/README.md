# Provider data

Two layers. `raw/` is what each source said, untouched except for shape. `providers/` is one record per doctor per specialty, with every contributing source listed on the record. `coverage.json` is the honesty report: how much of the Ahpra register each specialty file reaches.

## Layout

```
data/
  raw/<source>/<YYYY-MM-DD>.jsonl   one line per source record; every line carries
                                    source, source_url, observed_at, legal_basis, tier
  providers/<specialty>.jsonl       merged; see pipeline/merge.py for the shape
  coverage.json                     per specialty: doctors, share of register, field fill, by state
```

Rebuild: `PYTHONUTF8=1 python -I pipeline/merge.py` (stdlib only, Python 3.13).

## Rules

- Nothing enters `raw/` without a `legal_basis` string on every record, and nothing is written for a source whose robots.txt or terms forbid it (ACD's robots blocks everyone but Google and Bing; healthdirect's terms forbid commercial reuse; both are recorded in `research/raw/` and not collected).
- Facts only. No bios, summaries, photos or emails, even when the source exposes them.
- `tier` is `found` for everything collected from a public page. `register` arrives only with Ahpra data under agreement; `declared` only through the claim flow.
- Same name is not the same person. Records merge only on a shared source id, or across sources when they agree on a state.
- The register denominator in `coverage.json` is Ahpra specialist registrations at 30 June 2026 (`research/raw/02-medical-disciplines.md`). For O&G it counts Fellows only; GP obstetricians (RANZCOG Associates) are kept but not counted against the specialist register.

## Sources collected so far (2026-10-15)

| Source | Specialty | Records | What it carries | Basis |
|---|---|---|---|---|
| `ranzcp-find` RANZCP Find a Psychiatrist | psychiatry | 1,299 | wait time to first appointment, "not taking new patients", telehealth, in-person, expertise tags, services, age groups, languages, geocoded addresses with phone and website, faculty accreditations, source last-updated date | opt-in public directory; terms assert copyright, no automated-access clause; robots allows all |
| `ranzcog_find` RANZCOG Find a Women's Health Doctor | obstetrics-gynaecology | 2,277 AU (1,468 Fellows; 809 GP obstetricians) | scope tags, workplaces with address, languages | opt-in public directory; robots allows the page; terms say personal use and no on-selling, so a college feed is needed before public display |
| Hospital groups: `healthscope` 445, `ramsay` 945, `sjog` 222, `epworth` 207, `calvary` 116, `mater` 132, `cabrini` 61, `sah` 69 | all three | 2,197 rows | name, specialty, subspecialty tags, consulting rooms with address and phone, admitting hospital, telehealth where stated | accredited-specialist directories; robots checked per host (Healthscope and SJOG APIs disallowed, sitemaps used instead); facts only |
| `ascia_find` ASCIA locate-a-specialist | paediatrics (allergy) | 182 doctors | address, phone, Ahpra number as published | robots allows; copyright notice, no automation clause |
| `rch_staff` RCH Melbourne department pages | paediatrics | 159 doctors | department, role, Parkville address | robots allows |
| `anzsped_units` ANZSPED endocrine units | paediatrics | 22 doctors | unit, hospital | WordPress default robots |
| `qld_health_facilities`, `qld_services_mvp`, `qld_outpatient_waits` (service-level, not merged into providers) | Queensland services | 435 facilities; 382 MVP-category services (CYMHS, menopause, endometriosis/pelvic pain, child development, persistent pain, perinatal MH); 6,700 elective-surgery wait rows | address, geocode, phone, referral route, HHS | CC BY 4.0 (data.qld.gov.au) and CC BY-ND 4.0 facts only (HHS sites); 10 s crawl delay honoured |
| Open data (not doctors): `ndis_register` 65,277, `aged_care_service_list` 5,378, `headspace_centres` 177, `medicare_mental_health_centres` 55, `abr_bulk` sample, `medicare_acc` PDF | services | | | NDIS Commission CSV; GEN CC BY; public lists |

**Merged (2026-10-15):** psychiatry 1,604 (30% of register), obstetrics-gynaecology 2,630 (74% of Fellows on register), paediatrics 502 (11%). Queensland: 311 / 504 / 61.

Not collected: healthdirect public site (terms), ACD Find a Derm (robots), HealthShare (commercial, no reuse right), Ahpra register (terms; extract or PCA only), Macquarie University Hospital (host returns 421). Queensland Health specialist-outpatient waits exist only as Power BI embeds.

## The ADHDme network (2026-10-24)

The 59 clinicians on adhdme.au are the founder's own network, and their base of record is the
`CLINICIANS` literal in `revamped-adhd.me/scripts/build-profiles.py`, the list that writes every
profile page on that site. `pipeline/adapters/adhdme.py` reads it and writes three files. Two of
them are generated, so don't edit them by hand:

```
data/adhdme/clinicians.json                        the base, verbatim, with source and date
data/enriched/personal/research-adhdme.json        15 prescribers (GPs, psychiatrists)
data/enriched/personal/research-adhdme-allied.json 44 psychology, OT, allied health and coaching
```

`data/adhdme/personal.json` is hand-owned: it holds the researched split of each clinician's own
words (philosophy, lived experience, quotes), and the generator prefers it over its own derivation.

```
python -I pipeline/adapters/adhdme.py --source ../revamped-adhd.me   # refresh from the site repo
python -I pipeline/adapters/adhdme.py                                 # rebuild from the snapshot
python -I pipeline/adapters/adhdme.py --check                         # exit 1 if anything is stale
```

Each record carries the full ADHDme card (fees, pathway, qualifications, booking link, disclosure)
and a `reach`: the states the clinician sees people in. `schema.area: "Australia"` on the source is
the only thing that makes reach national, and it is set on no prescriber, because ADHD prescribing
is authorised state by state. Measured 2026-10-24: inside the network, prescribers reach QLD, NSW
and VIC only, while 33 non-prescribing providers reach every state by telehealth. Across Wattle's
whole ADHD cohort (the network plus every provider who declares ADHD or autism, 730 in all),
every state has a prescriber: `/about/coverage` shows the counts.

