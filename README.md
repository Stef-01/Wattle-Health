# Wattle Health

A patient-first map of the Australian healthcare system. Sibling venture of ADHD.ME under Wattle Technologies.

**Status (2026-10-16):** Queensland MVP running on real data. 4,736 doctors nationally (psychiatry, obstetrics-gynaecology, paediatrics) from 12 public sources; 876 in Queensland; 195 Queensland doctors linked to 1,077 verified publications. Patient journey and clinician onboarding implemented to the Figma design (file `NEbiukDE3TyWFptwaCBhwV`), 19 screens, two-layer matching ported from ADHD.ME (600 tests). Supabase project `wattle-health` (ap-southeast-2) holds the same data behind `published_*` views.

**v7 (2026-10-18):** Zocdoc's guided questions, recovered with REA (morluto/rea) from the shipped SearchAI bundle in the Wayback archive (`qa/benchmark-zocdoc/archive`), rebuilt one question per screen with progress, Back and "Just show my matches": specific issue, experience with care, type of care, medication management, open to a GP (excludes GPs on "no"), who it's for, age, video or in person, plus Wattle's "what matters most", then "Here's what you'll be searching for". No insurance. Verified patient reviews on every profile: average, count, "Highly recommended by Wattle patients" at 3+ reviews averaging 4.5+, "Write a review" (rating, when, words, "I saw this doctor"); every review is held as pending by row-level security until approved in Supabase (`update reviews set status='approved', moderated_at=now() where id=…`). Profiles start with no reviews; none are imported or invented.

**v6 (2026-10-18):** Zocdoc SearchAI pattern without insurance. The search API ranks per-patient highlights for every match on the server (`src/data/highlights.ts`: conditions asked about, how they work in their own words, lived experience, who they see, access, research, one personal line); each match leads with "Highlights for you" (three shown, the rest on a toggle, ticks on what you asked for). A Refine sheet of switches (telehealth only, all of Queensland, a woman doctor, sees children) replaces filter pills; each profile opens with the opening quote and folds the rest under "More about…". Zocdoc blocks automated capture, so the pattern comes from its public guided-search and how-search-works pages plus the parameters of its SearchAI URL.

**v5 (2026-10-17):** guided flow. Home takes the sentence; `/narrow` asks up to three questions (who it is for, in person or telehealth, what matters most), skipping any the sentence already answered; then one match at a time as a full profile on `/results`, the second and third revealed as you reach the bottom, then "Search again". 65 published profiles after a fourth sweep (regional Queensland and Brisbane paediatrics, portraits inline). `node qa/figma/journey.mjs` checks the whole flow.

**v4 (2026-10-16):** editorial strip-back after founder review: no chips, Newsreader names and quotes, the doctor's own opening statement on each card, results cards to Figma P05 with practice-site portraits (51 of 53), a searching screen with a breathing wattle orb, page ease-in, portrait shimmer, staggered sections, faces on home and recent rows, tinted drill-down panels with "More" opening every quote from the doctor's page. All motion off under reduced motion.

**v3 (2026-10-16):** 53 real Queensland doctors (four research sweeps) with genuinely personal bios on their own practice websites (women's health, mental health, overlooked chronic conditions) are merged in as `published` personal profiles (`src/data/published.ts`, research in `data/enriched/personal/research-*.json`, every record names its source page). Fictional illustrative profiles are off by default. The patient flow is now one field → results → profile; result cards carry matched chips, one quote in the doctor's published words and the practical line; the profile reads hero → in their words → how they practise → outside the clinic → sees → research / practical / why this match (folded) → source → call. Layout: edge to edge on phones, a device frame on tablets, a 560 px column on laptops.

## Live demo

**Production:** https://wattlehealth.vercel.app (Vercel project `wattlehealth`, linked to this repo, deploys every push to `main`; public). Verify a deploy with `BASE=https://wattlehealth.vercel.app pnpm walk` and `BASE=https://wattlehealth.vercel.app node qa/figma/demos.mjs`. Deployment target is Vercel only; there is no static export and no GitHub Pages site (founder decision 2026-10-16). Portraits on the cards are hotlinked from the same practice page each profile cites (`data/enriched/personal/portraits.json`, founder instruction 2026-10-16; 51 shown, one page had no portrait, one practice image was excluded because its file name says it is AI-generated). The clinician `/join` flow runs in labelled local mode until `SUPABASE_SERVICE_ROLE_KEY` is set in the Vercel project (the MCP token cannot read or write env; set it in the dashboard).

Preview deployment (Vercel, built from branch `wattle-health-demo` of `Stef-01/Wattle`, the Vercel-linked company repo): https://wattle-git-wattle-health-demo-stefan01-7725s-projects.vercel.app — the company project has Vercel Authentication on previews, so open it while logged into Vercel, or use a share link generated from the Vercel dashboard. To get a public production URL: create a `wattle-health` Vercel project linked to this repo (the MCP token cannot; `npx vercel login` then `vercel link`), add the env from `.env.production`, and `SUPABASE_SERVICE_ROLE_KEY` for clinician writes.

## Run

```
pnpm install
pnpm dev            # http://localhost:3300
pnpm typecheck && pnpm test && pnpm build
node qa/figma/walk.mjs   # full-journey screenshots against `pnpm start`
```

Copy `.env.example` to `.env.local`. The publishable key is safe; `SUPABASE_SERVICE_ROLE_KEY` is needed only for clinician onboarding writes (without it the join flow runs in local mode).

## Documents

- `PRD.md` — product requirements (v0.2)
- `RESEARCH-PLAN.md` — how the provider map is built, discipline by discipline
- `DATA-MODEL.md` — entity schema (FHIR AU Provider Directory shape) and MVP additions
- `data/README.md` — every source collected, with legal basis, and the merged totals
- `research/raw/01..06` — registry, legal and competitive research with URLs
- `pipeline/` — adapters (`pipeline/adapters`), merge (`pipeline/merge.py`), enrichment (`pipeline/enrich`), Supabase load (`pipeline/load`)
- `supabase/migrations` — schema 0001–0004
- `qa/figma` — Figma renders and the screenshot walk

## Rules that do not bend

No scraping of the Ahpra register. No Google Places content stored. No reviews, ratings or testimonials. Patient search makes no model calls: it is lexical and deterministic. The decisions loop below is the one place a model is called. Every fact carries a source tier (register / declared / found) and a date; "Not declared" is rendered, never invented.

## Decisions loop and admin (2026-10-24)

A transcript goes in; every category comes back scored 0 to 1; a decision tree trained on the
founder's case studies turns the scores into a decision and shows the rule it took. A second pass
finds what the transcript says that no category covers and queues it for a person in `/admin`.
Approving one makes it a category: the next transcript is scored on it, and the next training run
can split on it. Nothing is weighted up front; the tree learns which parameters matter.

| | |
|---|---|
| Categories | `disciplines/mvp.yaml` (conditions, populations, approaches, manner, human fit, practical needs) plus categories approved in review |
| Model | OpenAI Responses API, strict JSON schema, `OPENAI_MODEL` (default `gpt-5.4-mini`), `store: false` |
| Tree | CART on the scores, Gini, depth 4, deterministic; leave-one-out accuracy reported |
| Storage | Supabase `decision_docs` (migration 0006) with `SUPABASE_SERVICE_ROLE_KEY`; else a gitignored local file in development; else memory |
| Privacy | Transcripts are never stored (a run keeps its SHA-256 and length). Case studies stay in the store, never in git |

Environment (`.env.local` locally, Vercel env in production):

```
OPENAI_API_KEY=                 # required to classify
OPENAI_MODEL=gpt-5.4-mini       # optional
ADMIN_PASSWORD=                 # opens /admin; unset keeps it shut
DECISIONS_API_KEY=              # bearer key for outside tools
DECISIONS_REVIEW_WEBHOOK_URL=   # optional: new candidates are POSTed here for external review
DECISIONS_REVIEW_WEBHOOK_TOKEN= # optional bearer token for that webhook
```

API (every route needs the admin session or `Authorization: Bearer $DECISIONS_API_KEY`):

```
POST  /api/decisions/classify          {transcript, discover?} → scores, decision, candidates
GET   /api/decisions/categories        everything the classifier outputs
PATCH /api/decisions/categories/:key   {label?, description?, active?}   reviewed categories only
GET   /api/decisions/candidates        review queue (?status=pending)
PATCH /api/decisions/candidates/:id    {action: approve | reject | update, label?, description?, group?}
GET   /api/decisions/cases             case studies
POST  /api/decisions/cases             {title, text, decision, source?, sourceRef?} or an array
POST  /api/decisions/cases/extract     {notes} → draft case studies from meeting notes (not saved)
POST  /api/decisions/train             re-score stale cases, fit the tree
GET   /api/decisions/model             the tree, its rules and feature importance
```

An external validator receives `candidates.created` at the webhook and answers with the same PATCH
the dashboard uses.

