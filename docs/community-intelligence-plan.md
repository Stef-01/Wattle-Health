# Community intelligence: finding the doctors people recommend

Wattle Health · plan v1 · 2026-10-19 · status: plan, nothing collected yet

## The goal

Build a separate backend that finds Queensland doctors whom patients recommend in public. It should surface two groups:

- **Quiet achievers.** Patients recommend them often, but they have little web presence.
- **Loud achievers.** Doctors with real public followings who explain medicine well.

The backend has three outputs:

1. Doctors we haven't listed yet go into onboarding.
2. Doctors we have listed but who have thin profiles move up the outreach queue (`/team/outreach`).
3. An internal signal that helps rank and choose demo doctors.

It is a separate system from the patient app. It feeds the app only through doctor records and the outreach queue. Social posts never appear in the app.

## Two hard constraints that shape everything

1. **Testimonials (National Law s133).** Advertising a regulated health service may not use testimonials. Wattle is commercial and lists doctors. If it republished "Dr X fixed my endo" from Reddit, that could be a testimonial in advertising.
   - Community signal is used to **discover and prioritise** doctors.
   - It is **never** used to quote or display what patients said.
   - The patient-facing review system stays as it is: verified, moderated and held as pending (migration 0005).
   - Get a health-law opinion before anything community-derived is shown to patients, even a count.
2. **Privacy Act 1988, APP 3.** A post recommending a doctor usually reveals the poster's own health. That is sensitive information. We do not collect it.
   - We store the **doctor**, the source URL, the date and coarse theme tags.
   - We never store the poster's handle, the text of the post or anything about the patient.
   - Raw text is processed in memory to find the doctor's name and then discarded.
   - The statutory tort for serious invasions of privacy, in force since 2025, raises the cost of getting this wrong.

Platform terms come third. They decide **how** each source can be read (see Sources).

## Sources, by value and by how we may use them

| Tier | Source | What it gives | How we access it | Risk |
|---|---|---|---|---|
| A | Doctors' **own** public content: Instagram, TikTok, YouTube, LinkedIn, podcasts, practice blogs | Their own words, hobbies and a tone of voice. This is the best fuel for profiles, the same as practice pages. | Manual research plus the official YouTube Data API. Profile pages are fetched like websites, within each site's terms. | Low. These are their own words, attributed. |
| A | **In-app nominations**: "Recommend a doctor who changed things for you" | First-party signal with consent. It also reaches closed communities such as Facebook mums' groups and CALD networks, because members bring the names themselves. | Our own form. It stores the doctor and why, and the consent is explicit. | Low. Consented. |
| B | Public **Reddit** threads, e.g. r/brisbane, r/GoldCoast, r/sunshinecoast, r/endometriosis, r/ADHDAustralia, r/menopause | "Who's a good GP in X" threads are dense with recommendations. | The Reddit Data API under its commercial terms, which require an agreement for commercial use. No scraping. | Medium. Commercial terms, and the privacy controls above. |
| B | Public **community press and podcasts**: local news "best GP" features, patient-advocacy podcasts, Endometriosis Australia, ADHD Australia | Curated recognition | Manual or RSS | Low |
| C | **Facebook and Instagram** comments and closed groups | Highest volume of local recommendations | Not scraped. Meta prohibits it, and closed groups are private. Reach them through nominations (tier A) and community partners only. | High. Excluded. |
| C | **Google reviews, Healthshare, RateMDs, Whitecoat, Productreview** | Existing review corpora | Not imported. Their terms forbid it, and our own rule bans importing reviews. Read by hand only as a lead, then verified independently. | High. Excluded as a data source. |
| C | **X and TikTok** comments | Sparse for local GPs | Skipped in v1. Paid API, low yield. TikTok's research API is academic only. | Medium |

## Pipeline

```
sources ──► collectors ──► mention finder ──► resolver ──► signals ──► outputs
 (A/B)      (API, manual,     (doctor names     (match to      (per doctor,   onboarding queue
            nominations)      + place, then     our roster or  per source,    outreach priority
                              text discarded)   a new candidate) dated)       quiet/loud lists
```

1. **Collectors** run as scheduled batch jobs, never in the request path. Reddit uses the API with a stored cursor. YouTube uses the API. Tier-A own-content collection is manual research, like the profile sweeps.
2. **Mention finder.** Deterministic patterns pick out "Dr Firstname Lastname" and "Dr Lastname at Clinic", plus a Queensland place near the name. Optional offline enrichment can use Claude through the subscription CLI, with no API key, in batch only. The output is `(doctor name, practice/suburb hint, theme tags, polarity)`. **The text is then dropped.**
3. **Resolver.** It matches against the roster on name key, suburb and specialty.
   - Unmatched names become `doctor_candidates`. A person confirms registration on the public Ahpra register by hand. We never scrape Ahpra.
   - We then find the doctor's own practice page and onboard them as a `published` record, even with a thin bio. Thin is fine: they rank lower until outreach fills the gaps.
4. **Signals** hold one row per doctor, source and month:
   - mention count
   - number of distinct threads
   - theme tags, from a closed vocabulary: listens, explains, unhurried, warm, gets-it, telehealth, women's health, neurodiversity-affirming and similar
   - first and last seen
5. **Scores**, internal only:
   - **Community signal.** Independent mentions across at least 2 sources and at least 3 threads, decayed with a 12-month half-life. A single viral thread counts as one.
   - **Quiet achiever.** High community signal and low web presence, meaning no own-content and a thin practice page.
   - **Loud achiever.** A large own-content following plus community mentions. Following alone doesn't count.

## Storage (Supabase, separate schema `community`)

- `community.sources(id, platform, url, title, observed_at)`. Thread-level only, no post text.
- `community.mentions(id, source_id, doctor_id null, candidate_id null, themes text[], polarity smallint, observed_at)`. No author or text column, and that is enforced by the schema.
- `community.candidates(id, name, suburb_hint, specialty_hint, first_seen, mentions, status: new|verified|onboarded|rejected, ahpra_checked_at, practice_url)`
- `community.signals`. A materialised view per doctor: score, quiet/loud flags, theme counts, sources count.
- `community.nominations(id, doctor_text, why_tags, consent_at)`. From the in-app form, with free text discarded after tagging.
- RLS: service role only. Nothing is readable with the publishable key. A daily job writes priorities into the outreach queue.

## Integrity

- **Astroturf.** Discount mentions from new accounts and bursts within 48 hours. Count each thread once. Exclude anything posted by the doctor or their clinic. The resolver flags any thread linking to the clinic's booking page.
- **Negative mentions** are stored as polarity only and never shown. They don't lower ranking in v1 because of defamation and fairness risk. They stop a doctor being featured, and a person reviews it.
- **Doctor right of reply.** Any doctor can see their own signal summary and opt out of the community signal.
- **Human gate.** Nothing community-derived changes a patient-facing surface without a person's sign-off.

## Phases

| Phase | Weeks | Ships | Done when |
|---|---|---|---|
| 0 | 1 | Health-law opinion on s133 and community signal. Privacy impact assessment. Reddit commercial-terms request. | Written opinion. PIA signed off. |
| 1 | 2–3 | In-app "Recommend a doctor" nomination (tier A). Candidates table and resolver. Manual Ahpra check flow. | 50 nominations resolved and 20 new doctors onboarded. |
| 2 | 3–5 | Doctors' own-content collection (YouTube API plus manual Instagram, TikTok and LinkedIn bios). Hobbies and own words go into profiles. | Profile richness of 4 or more for 50% of published doctors. |
| 3 | 5–8 | Reddit collector under commercial terms. Mention finder, signals and quiet/loud lists. Outreach priority feed. | Precision of 90% or more on name resolution in a 200-mention audit, with zero stored post text. |
| 4 | 8+ | Community partners (endometriosis, ADHD and CALD groups) running nomination drives. Quarterly integrity audit. | Nominations from at least 3 regions and at least 3 language communities. |

Separately and continuously: keep amassing doctors from practice pages. The fifth research sweep is running. Every new doctor is onboarded even with a thin bio. They are deprioritised in matching (`src/data/completeness.ts`) and flagged on `/team/outreach` with the exact interview questions that fill their gaps.

## Six lenses (Research Skill Graph)

- **First principles.** A recommendation is a transfer of trust between people with the same problem. The scarce fact isn't "good doctor" but "good for someone like me". So theme tags (listens, gets-it) matter more than star counts, and the resolver keeps the condition context of the thread.
- **Historical.** RateMDs and Healthshare stalled on thin data, defamation threats and doctor hostility. Zocdoc built trust with **verified** reviews. Ahpra's 2020 testimonial guidance made Australian review use narrow. The lesson: discovery is safe, republishing is not.
- **Contrarian.** Social recommendations over-represent young, online, English-speaking, metro patients. Mining Reddit alone would find "loud patients", not quiet achievers. Regional, older and CALD communities recommend by word of mouth. That is why nominations and community partners are tier A and Reddit is tier B.
- **Technical.** Name resolution is the hard part: common surnames, "Dr Sarah at Noosa", locums. Requiring name plus place plus specialty, a human check and a precision audit keeps false matches out. Deterministic extraction keeps the no-model request path intact.
- **Economic.** Platforms now charge for data (Reddit 2023, X), so cheap scraping is both against terms and fragile. Owning the nomination channel builds a first-party asset that compounds. Doctors gain from being found, so a doctor's own opt-in content is a supply incentive, not a cost.
- **Geopolitical.** Australian privacy reform, the 2024 amendments and the 2025 tort are tightening. Ahpra is actively enforcing advertising rules. Meta has shut researcher access before. Design for the strictest reading now. Keep collection minimal and doctor-centred so a policy change can't strand the system.

## Open decisions for the founder

1. Is commercial Reddit access worth the cost and terms, or should v1 run on nominations plus own content only? The recommendation is to start with nominations and own content.
2. Should a community signal ever be patient-facing, for example a "Recommended in the community" mark? This is blocked on the s133 legal opinion.
3. Who in the team owns the human gate and the Ahpra checks?
