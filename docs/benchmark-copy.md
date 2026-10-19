# Copy and flow benchmark: Wattle against similar apps

2026-10-19. The sources are public pages read today, plus the archived Zocdoc SearchAI bundle and the founder's Zocdoc PDF already in `qa/benchmark-zocdoc/`.

| | Zocdoc SearchAI | Headway (therapists, US) | HotDoc (AU) | Healthshare (AU) | Wattle now |
|---|---|---|---|---|---|
| Search entry | Guided yes/no questions: "Do you want the appointment to be over video or in person?", "Are you open to seeing a primary care provider?" | Location page, list of therapists | Specialty and "next 14 days" filter | Name, specialty or "Cardiologist Perth" | One sentence, then guided questions in the same style (/narrow) |
| What a result leads with | Name, rating, highlights badges | **The provider's first-person quote** ("My approach is warm, collaborative…") | **Availability**, then book | Name, specialty, address | **The doctor's own words**, portrait, then "Outside the clinic" hobbies |
| Personal detail | Little | Sometimes ("dancer and Qigong instructor", "strength coach") | None | None | Hobbies on every published doctor's match (64 of 65 at first count) |
| Trait words | Highlight badges | Three per card ("Affirming, Empowering, Warm") | None | None | None by founder decision (no abstract labels). Highlights tab instead |
| Availability | Next times shown | "Accepting new patients" | Next available is the core | None | **Added today**: "Next opening Thu 4:30 pm · demo" on every match, plus Openings and alerts |
| Reviews | Star rating plus review count | None | None | None | Labelled demo reviews and one combined "What patients say" paragraph |

## What we took and what we didn't

- **Took from Headway** the quote-first card. Every match and saved card now opens with the doctor's own sentence.
- **Took from HotDoc** availability up front. It shows as demo openings until real practice availability is connected.
- **Took from Zocdoc** the question wording and the one-line summary of what you asked for. The summary was fixed today so it reads as a sentence and doesn't repeat itself.
- **Did not take** Headway's three trait words or Zocdoc's insurance questions. The founder ruled out abstract labels and insurance.
- **Wattle-only:** hobbies on every match, healthspan matching on the doctor's own prevention words, and calendar-fit openings from saved doctors.

## Screen word counts, iPhone 15, above the fold

Measured with `qa/iphone/words.mjs`:

| Screen | Words above the fold |
|---|---|
| Home | 46 |
| Me | 47 |
| Openings | 40 |
| Context | 45 |
| Discover | 55 (was 72; tile copy trimmed, text arrows replaced by a chevron icon) |
| Healthspan | 75, an editorial landing on purpose |
| About | 102, an editorial page on purpose |

Re-measured 2026-10-19 after the Zocdoc token pass (sans semibold headings everywhere outside the doctor's own words and the editorial landings; 8 px cards, 6 px controls and fields, 56 px r6 CTA). Big portraits stay on matches, profiles, healthspan results and Saved (founder, same day: big faces are more personable). Re-measured again after merging the same day's main (picks, no green, calendar and connector cards).
