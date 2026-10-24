# Handover — 2026-10-24

Where the ADHDme port and the decisions loop stand, and what is left. Read `CLAUDE.md` first; it
holds the rules this work added (API keys allowed, modes, no default place, the generated ADHDme
base).

## Start the next session with

> Read HANDOVER.md in ~/Wattle-Health. Granola is signed in. Find the case studies in my Granola
> meeting notes, show me the drafted cases and decisions, then save them and train the tree.

## Done and on `main`

| Commit | What |
|---|---|
| `8c778f8` | The whole ADHDme clinician base (59) ported, generated from `revamped-adhd.me` by `pipeline/adapters/adhdme.py`; fees, pathway, training, booking and disclosure on every profile; `reach` by state; no default place (no more silent Brisbane); `/about/coverage`; ADHDme mode (`src/mode.ts`) narrows the whole app to ADHD support |
| `66b8ae6` | The decisions loop and `/admin` (below) |

Checks at `66b8ae6`: typecheck, 681 tests, `next build`, Apple audit and behaviour, text budget, and a
live run against OpenAI.

## The decisions loop (`src/decisions`, `/admin`, `/api/decisions/*`)

1. **Score**: every category is scored 0 to 1, with no weighting. That is 63 categories from
   `disciplines/mvp.yaml`, plus any approved in review.
2. **Decide**: a CART decision tree trained on case studies (`tree.ts`) turns the scores into a
   decision and shows the rule it took.
3. **Find**: a second pass queues what no category covers for human review, and sends it to
   `DECISIONS_REVIEW_WEBHOOK_URL` if one is set.
4. **Review** in `/admin/review`: rename, describe and approve. The approved idea becomes a category
   the classifier outputs next time, and the next training run can split on it.
5. **Case studies** in `/admin/cases`: add them by hand, as JSON, or with **Import from meeting
   notes**. That step drafts each case and its decision from pasted notes for a person to check
   before saving, with the decision kept out of the case text.

Verified live: 63 categories scored sensibly on a real transcript; "School refusal" was found,
approved, and scored 1.0 on the next run; a tree trained on test cases (100% fit, 83% held out) and
made decisions; three cases were extracted from a sample note. No real training data exists yet.

## Not done

1. **Granola is not signed in.** The official server was added to Claude Code (local config for
   `~`, `claude mcp add --transport http granola https://mcp.granola.ai/mcp`), but
   `claude mcp get granola` still says *Needs authentication*. Typing `/mcp` in the desktop app did
   not complete it. To finish:
   ```bash
   cd ~ && claude
   ```
   then `/mcp` → granola → Authenticate → finish in the browser → start a new session. Granola's free
   plan covers only the last 30 days of notes; older notes need Business or Enterprise, or paste them
   into `/admin/cases` instead.
2. **Import and train.** Once Granola loads, search the notes for case studies and run each note
   through `POST /api/decisions/cases/extract`. Show the drafts to the founder, then save the
   approved ones with `POST /api/decisions/cases` (`source: "granola"`, `sourceRef` = the note
   title), then `POST /api/decisions/train` and report the fit, the held-out accuracy and the rules.
   Use a dev or production server with the **file** store (the default locally), not
   `DECISIONS_STORE=memory`, or the cases are lost when it stops.
3. **Production environment (Vercel).** Set `OPENAI_API_KEY`, `ADMIN_PASSWORD`, `DECISIONS_API_KEY`
   and optionally `OPENAI_MODEL`. To keep reviews and case studies, set `SUPABASE_SERVICE_ROLE_KEY`
   and run `supabase/migrations/0006_decisions.sql`. Until then, the deployed `/admin` stays shut and
   classifying is off.
4. **Rotate the OpenAI key.** It was pasted into chat. Replace it in `.env.local` and in Vercel; no
   code change is needed.

## Local setup

- `.env.local` (gitignored) holds `OPENAI_API_KEY`, `OPENAI_MODEL=gpt-5.4-mini`, `ADMIN_PASSWORD`
  and `DECISIONS_API_KEY`. The `/admin` password is there.
- The local decisions store is `data/decisions/.local/store.json` (gitignored; case studies never
  go to git).
- Run with `pnpm build && pnpm start` (port 3300), then open `http://localhost:3300/admin`.
- Outside tools call the API with `Authorization: Bearer $DECISIONS_API_KEY`; README "Decisions loop
  and admin" lists every route.
- ADHDme base: run `python -I pipeline/adapters/adhdme.py --source ~/revamped-adhd.me` to refresh it,
  and add `--check` to see whether it has drifted.
- Playwright's bundled browser is not downloaded on this Mac. QA scripts take
  `CHROME="$HOME/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"`.

## Worth knowing

- A search with no place now ranks the whole national roster: about 0.9 s, against 0.4 s when it
  silently meant Brisbane. `src/data/allied.test.ts` once timed out at 5 s under full-suite load; it
  passed on a rerun.
- The prescriber gap is only inside the 59-person ADHDme network (no prescriber outside QLD, NSW and
  VIC). Wattle's wider ADHD cohort (730) has a prescriber in every state.
- Damien Margetts and Kirsten Lightfoot were dropped because they are no longer in the ADHDme base.
