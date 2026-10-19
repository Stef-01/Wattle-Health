# Wattle Health — working rules

Read `PRD.md` §4, §7, §8 before touching anything. Contracts live in `src/matching/types.ts`; vocabularies in `disciplines/*.yaml`.

- **Matching is ported from ADHD.ME** (`src/matching`, the finder ranker in `src/demo/clinicians.ts`, `src/finder/filters.ts`, `src/geo/suburbs.ts`); keep provenance comments naming the source file.
- **No API keys, no model calls in the request path.** Extraction and rationale are lexical and deterministic.
- **No emails.** Outreach is a founder action and is not drafted here.
- **Three tiers, three badges**: register / declared / found, each with a date. "Not declared" is a rendered value, never a blank.
- **Personal profiles come in four statuses**: `published` (the doctor's own words from their practice website, source URL on the record; 110 QLD doctors in `data/enriched/personal/research-*.json`, incl. 6 healthspan doctors with `healthspan.evidence` from their own pages), `doctor-approved` (the /join flow), `illustrative` (fictional, `synthetic: true`, off by default, labelled everywhere) and `draft` (reads as no profile). Never paraphrase a review into a profile.
- **Deploy target is Vercel only.** No static export, no GitHub Pages, ever (founder decision 2026-10-16).
- **Text budget**: 20 to 60 words per whole screen at 390 px, including header and footer chrome. `pnpm gate:text` fails the build over 60.
- **Reviews (founder decision 2026-10-18)**: only verified patient reviews written in Wattle (`/api/reviews`, `supabase/migrations/0005_patient_reviews.sql`), held as pending until a person approves them, with clinical-outcome claims and medicine names removed (National Law s133). Never import or scrape a review. Exception (founder 2026-10-18, demo platform): generated demo reviews from `src/data/demo-reviews.ts`, built only from the doctor's own published themes, labelled "Demo reviews, not real patients" wherever shown, never once real reviews exist, off with NEXT_PUBLIC_DEMO_REVIEWS=0. The amalgamated "What patients say" is lexical (`src/data/review-themes.ts`).
- **Copy**: no testimonials in marketing copy, no superlatives, "specialist" outside an Ahpra specialty, medicine brand names. `pnpm gate:copy` fails the build.
- **Ranking rules are properties, not examples**: `src/matching/*.properties.test.ts` uses fast-check.
- Stack: Next.js 15, React 19, TypeScript strict, Tailwind 4, vitest, fast-check, pnpm. Newsreader display over Inter. Dev server port 3300.
- Commit to main and push after every meaningful change.
