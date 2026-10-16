# Wattle Health

A patient-first map of the Australian healthcare system. Sibling venture of ADHD.ME under Wattle Technologies.

**Status (2026-10-16):** Queensland MVP running on real data. 4,736 doctors nationally (psychiatry, obstetrics-gynaecology, paediatrics) from 12 public sources; 876 in Queensland; 195 Queensland doctors linked to 1,077 verified publications. Patient journey and clinician onboarding implemented to the Figma design (file `NEbiukDE3TyWFptwaCBhwV`), 19 screens, two-layer matching ported from ADHD.ME (600 tests). Supabase project `wattle-health` (ap-southeast-2) holds the same data behind `published_*` views.

**v3 (2026-10-16):** 53 real Queensland doctors (four research sweeps) with genuinely personal bios on their own practice websites (women's health, mental health, overlooked chronic conditions) are merged in as `published` personal profiles (`src/data/published.ts`, research in `data/enriched/personal/research-*.json`, every record names its source page). Fictional illustrative profiles are off by default. The patient flow is now one field → results → profile; result cards carry matched chips, one quote in the doctor's published words and the practical line; the profile reads hero → in their words → how they practise → outside the clinic → sees → research / practical / why this match (folded) → source → call. Layout: edge to edge on phones, a device frame on tablets, a 560 px column on laptops.

## Live demo

**Production:** https://wattlehealth.vercel.app (Vercel project `wattlehealth`, linked to this repo, deploys every push to `main`; public). Verify a deploy with `BASE=https://wattlehealth.vercel.app pnpm walk` and `BASE=https://wattlehealth.vercel.app node qa/figma/demos.mjs`. Deployment target is Vercel only; there is no static export and no GitHub Pages site (founder decision 2026-10-16). The clinician `/join` flow runs in labelled local mode until `SUPABASE_SERVICE_ROLE_KEY` is set in the Vercel project (the MCP token cannot read or write env; set it in the dashboard).

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

No scraping of the Ahpra register. No Google Places content stored. No reviews, ratings or testimonials. No model calls in the request path and no API keys. Every fact carries a source tier (register / declared / found) and a date; "Not declared" is rendered, never invented.
