# Design appraisal: the trending design repos as lenses

On 2026-11-08 the approach used on Med-OS the day before (`Med-OS/docs/design-appraisal.md`) was applied to Wattle Health: the trending GitHub design repositories that ship a linter or a scanner were cloned at the commits below and run against the production build of every patient route, the ones that are written rules were turned into checks, and every finding was sorted into fixed, judged and kept, or not applicable. The fixes are in this commit; the gates that keep them are `src/ui/design-tokens.test.ts` (runs in `pnpm test`) and `qa/edge/edge.mjs` (`pnpm edge` against a built server).

| repo | commit | what it is | how it was applied |
|---|---|---|---|
| Nutlope/hallmark | `407fa68` | an anti-slop floor with `sloplint` | `sloplint --scope app` on 15 rendered routes with the compiled sheet linked |
| pbakaus/impeccable | `924bbd1`, CLI 4.8.0 | a 62-rule detector | `impeccable detect --json` on the same 15 routes |
| Jakubantalik/transitions.dev | `77d7437`, agent 0.11.x | a motion scanner | `transitions-agent scan --json` on the rendered routes and the compiled sheet |
| ibelick/ui-skills | `97dea9e` | baseline MUST and NEVER rules | checked by grep, then written into the lint |
| nextlevelbuilder/ui-ux-pro-max-skill | skill in `~/.claude/skills` | 119 UX guidelines | its measurable rules walked on the live DOM |
| Med-OS `scripts/e2e/edge.mjs` | `699fe80` | the edge test | ported as `qa/edge/edge.mjs` |

The rendering: `pnpm build && pnpm start`, each route fetched with curl into a folder with the compiled CSS placed at `_next/static/css/` so the linked sheet resolves (without it, sloplint and impeccable report the HTML alone and miss every rule in the sheet). The lens clones live in the session scratchpad under `design-repos/`.

## The scanners

| scanner | before | after | what the rest is |
|---|---|---|---|
| hallmark `sloplint` | 53 FAIL, 18 REFLEX, 10 WARN | 30 / 18 / 10 | 15 of gate 34 and 14 of 26a and 18 of 26b are the detector not seeing `body,html{overflow-x:clip}` (lightningcss merged the selectors) or `:focus-visible` inside `@layer base`: both are in the compiled sheet, quoted below; 10 of gate 49 are prose buttons, kept; 1 of gate 4 is the icon well in a row, kept |
| impeccable `detect` | 26: 24 `cramped-padding`, 1 `buried-raster`, 1 `nested-cards` | 25: 24 `cramped-padding`, 1 `nested-cards` | `cramped-padding` fires on inset-grouped lists and hairline-divided rows, which are flush by design (iOS Settings); `nested-cards` is the 30 px icon well inside a row |
| transitions.dev scan | score 83, 31 `hardcoded-duration`, 1 `inconsistent-durations` | score 95, 5 `hardcoded-duration` | Tailwind's own `--default-transition-duration: .15s` (unused: every transition names a token), and the dictation ring's 1.2 s loop |
| `qa/edge/edge.mjs` (new) | 74 failures | 0 | |
| `qa/apple/audit.mjs` | 0 low contrast, 0 small targets, 0 uppercase | same | 10 sizes, 4 weights, 6 colours, 3 radii in use |
| `qa/apple/behaviour.mjs` | all 14 true | same | |

## Fixed

**Every value is a token (hallmark 48, 7a; impeccable theming; ui-skills "MUST use the project's existing tokens").** 21 colour literals in screens and the sheet became tokens on `@theme`: the iOS greys the screens used by value (`--color-grey-2`, `--color-grey-4`, `--color-grabber`), the fills (`--color-surface-strong`, `--color-material`, `--color-glass`, `--color-glass-dark`), the splash set (`--color-splash-text`, `--color-orb-soft`), `--color-shimmer`, `--color-selection`, `--color-healthspan`, and the five monogram tints as ten `--color-tint-N-bg/fg` tokens that `tint.ts` now references. Four arbitrary shadows became `--shadow-float` (a segmented thumb), `--shadow-knob`, `--shadow-tag`, `--shadow-device` and `--drop-shadow-pill`. `rounded-[8px]` became `--radius-icon`, the sheet's `rounded-t-[32px]` became `--radius-sheet`, the monogram's `text-[72px]`/`text-[64px]` became `--text-monogram`/`-sm`, the wordmark's `text-[44px]` became `--text-wordmark`. The lint fails on a literal in a class, a style or the sheet outside `@theme`; the calendar providers' brand marks and the manifest's platform colours are the named exceptions.

**Five durations (transitions.dev `hardcoded-duration`; ui-ux-pro-max `exit-faster-than-enter`).** Ten literal durations (100, 150, 180, 200, 240, 250, 280, 300, 400, 420 ms) became `--duration-press` 100, `--duration-fast` 150, `--duration-base` 200, `--duration-slow` 300, `--duration-sheet` 420. The sheet arrives in 420 and leaves in 300; the scrim arrives in 300 and leaves in 200; the toast leaves in 300. Tailwind utilities use `duration-(--duration-base)`. The lint checks the five exist, that they ascend, and that both exits are quicker than their entrances.

**Reduced motion on every transform (hallmark 27; ui-skills "MUST use motion-reduce").** The disclosure chevron's rotation, the disclosure's grid-rows transition and the switch knob carry `motion-reduce:transition-none`; the lint fails on a `transition-transform` without it.

**A portrait is visible at rest (hallmark 62; impeccable `buried-raster`).** `.img-fade` was `opacity: 0` until a script set `data-loaded`, so a page without its script showed no doctor. It is now visible at rest; a photo the script knows is still loading is held back (`data-loaded="false"`, set only after mount), and one that finished before hydration is marked loaded at once.

**Nothing scrolls sideways (hallmark 34).** `overflow-x: clip` on `html` and `body`, alongside the frame's own clip.

**The 44 px hit area was cosmetic on every segmented control (edge test).** `.hit::after` extends a 32 px segment to 44 px, and the Apple audit measured that extension as the target. The edge test measures with `elementFromPoint` and a real tap, and found a tap 5 px above a segment did nothing: the segments also carried `truncate`, whose `overflow: hidden` clipped the extension at the control's own box. Truncation moved to a label span inside (`Segmented`, the profile's tab bar, the admin nav); `.hit::after` also gained `z-index: 1` so a later sibling cannot paint over it. BookCard's two segments had no `hit` at all. The lint fails on `hit` paired with `truncate` or `overflow-hidden` on one element. Verified: the tap now selects the segment.

**Small targets the Apple audit excused.** The "Using a custom GPT instead?" disclosure summary was 18 px tall (now `min-h-11`); the "Edit" link in a top bar was 37 px wide (now `min-w-11`).

## Judged and kept

- **Prose buttons** (hallmark 49, 10 sites): "Endometriosis, someone who listens", "Find a doctor who works this way". Hallmark wants a label that fits on one line; these are the product's examples and calls to action in sentences, by the founder's design (no chips).
- **Glass over the page** (hallmark 29, 3 sites): `.material`, `.glass`, `.glass-dark` are Apple's own nav and tab-bar materials, with `prefers-reduced-transparency` and `prefers-contrast` fallbacks already in place.
- **The icon well in a row** (hallmark 4 "card nested in card", impeccable `nested-cards`): a 30 px tinted square beside a row's label is the iOS Settings convention.
- **Flush inset-grouped rows** (impeccable `cramped-padding`, 24 sites): rows separated by hairlines that start at the text column, children against the group's edge, as iOS draws them.
- **Pure white and black** (hallmark 7a/7b): `--color-cell: #ffffff` and `--color-splash-deep: #000000` are the iOS system colours the Apple pass chose; hallmark's house rule tints them toward a brand hue, which this product has not got.
- **Tailwind's default duration token** (transitions.dev): `--default-transition-duration: .15s` is emitted by Tailwind for utilities that name no duration; none here do.
- **The dictation ring's 1.2 s loop**: a loop, not an interaction; reduced motion stops it.
- **Fixed dock clearances** (`pb-[110px]` to `pb-[170px]`, 7 values): each screen pads its scroll for its own dock and the tab bar; these are measured per dock, not a scale.
- **Apple's control metrics** (`size-[30px]`, `h-[31px] w-[51px]`, `min-h-[52px]`): the icon well, the switch and the row height are Apple's numbers, not spacing on a scale.
- **The 7 px glyph** the Apple audit lists among its sizes is the Apple Calendar mark's own lettering in `CalendarConnect.tsx`, an icon not text.

## Not applicable

- Hallmark's page gates (hero, fold, stamp, sections): Wattle is an app; its screens are the founder's 20 to 60 words.
- impeccable's AI-slop palette rules (purple gradients, glows, pulsing dots, hero eyebrows): none fired.
- `flat-type-hierarchy` fired on `/healthspan` and `/me` from the static detector reading `h1` without its utility class; the rendered `h1` is `text-hero` 40 px and `text-large-title` 34 px.

## The edge test

`qa/edge/edge.mjs` walks 18 patient routes at 320, 390 and 1280 px (320 with reduced motion), at the top and scrolled to the foot, and fails on: anything running off the right edge; a control whose real hit area is under 44 px (a 44 px square probed with `elementFromPoint`, so a `.hit` extension counts only when a tap there would land); any word under WCAG AA against the colour actually under it (sampled at the text node's own box, skipping text still arriving, text under a photo or a gradient, and text covered by chrome); a console error or a response of 400 or more (the Vercel insights scripts, absent off Vercel, excepted). It then runs a 180-character search and a German one (both land on `/narrow` with words on screen), and walks the keyboard on Home, a profile and Me, failing on a stop without a focus ring or off screen. `BASE=https://wattlehealth.vercel.app node qa/edge/edge.mjs` checks production.

## Round 2: every screen looked at (2026-11-08)

The scanners above read the DOM. Round 2 photographed production: `qa/edge/shoot.mjs` takes every route at 390 (2x) and 1280, viewport and full page, and `qa/edge/home-frames.mjs` records the first-run path frame by frame (splash, tap, Home arriving, Home with a stored name). 58 screenshots plus 16 frames were read one by one. What they found, all fixed in this commit:

- **Home's title swapped on screen.** The server rendered "Who do you need?"; after hydration a stored name turned it into "Hi, Stefan." and the avatar arriving pushed the field and everything under it down 14 px, during the page's own cross-fade. The avatar slot is now always laid out, and the title's words appear once the name is read instead of rendering one title and replacing it.
- **A focus ring around the whole splash.** The redirect from Home focuses the splash's `main` (a `role=button`), and with no pointer interaction yet Chromium treats it as keyboard focus: a 2 px blue ring around the viewport, plainly visible on tablet and laptop. The screen is the button, so it carries `outline-none`.
- **"Highlig…"** on every profile at 390: five equal-width tabs could not hold the semibold "Highlights". Columns are now sized to their words with the leftover shared (`repeat(n, auto)`).
- **"Local mode: no Supabase key, nothing is saved."** was absolutely positioned over the join flow's back button and step counter on every join screen (production has no Supabase key, so the banner shows there). It is in the flow under the header now.
- **Compare with nothing to compare** rendered a bare paragraph at the viewport's edge with no margins, nav bar or title. It sits in a `Screen` with a top bar.
- **Results and a match with no search** had no title above "No search yet." They open with "Your picks" like Recent and Saved.
- **Adjust's state line** ("Search first, then choose what matters.") sat under the fixed button. It travels with the button as its note.
- **Home's "Meet 170 doctors in their own words."** left "words." alone on a second line; `text-pretty`.

Looked at and left: the tab bar crossing a long page mid-scroll (it is fixed, as iOS's is); the join review's name card over the monogram (the preview of the doctor card); the Discover footnote under the tab bar when the page is scrolled to its foot (padded, scrolls clear).

## Round 3: why it felt slow, and the motion that was missing (2026-11-08)

Measured on production with `qa/edge/hops.mjs` (a tab-bar hop, timed to the moment the new title is on screen) and `curl` time to first byte.

| what | before | after | cause |
|---|---|---|---|
| hop back to Home | 574 to 1093 ms | 50 ms | Home read the mode cookie, which made it a per-request function; it is static now and both modes' faces ship in the page (`app/page.tsx`, picked by `useMode`) |
| About, Coverage, a GP profile, cold | 4.6 to 4.7 s to first byte | served prerendered | the same cookie read on About and Coverage (`src/ui/ByMode.tsx` renders both modes, the browser picks); only 40 profiles were prerendered, now every published profile plus 40 (252) |
| the searching moment | 1.4 s floor | 0.9 s | `MIN_SEARCH_MS`; the steps change every 450 ms |
| a navigation | 200 ms fade | 150 ms fade (a 12 px push was tried and reverted: a filled transform on the page makes fixed docks position against the page, and the bottom button sat 27 px below the fold) | `.page-enter` |
| a selection change | each segment painted its own background | one thumb slides (`src/ui/kit/thumb.tsx`: tab-bar lens, segmented controls, profile tabs; transform only, 200 ms, off under reduced motion) | measured 259 → 89 px over 150 ms |

The numbers (`qa/bench/measure.mjs`, iPhone 13 viewport, the mode of each measure; gaps are between consecutive text blocks, glyph box to glyph box):

| site | text left edge | body size / line | commonest control heights | commonest gaps | radii in use |
|---|---|---|---|---|---|
| Wattle /me, profile | 16 (rows 32) | 17 / 22 | 54, 44, 30 | 3, 26, 30, 32 to 37 | pill, 0, 26 |
| Apple apple.com/au | 16 | 17 / 21 and 19 / 23 | 36, 48 | 23, 21, 12 | 0, pill |
| HotDoc | 20 | 16 / 20 | 40, 50 | 24, 52 | 0, 4, 28 |
| HealthEngine | 20, 16 | 14 / 19 and 16 / 24 | 43, 40, 48 | 3, 24, 16, 18 | 0, 8, 4, 24 |
| Headspace | 20 | 16 / 24 and 12 / 14 | 48, 24, 44 | 11, 62, 82, 38 | 0, 32, 24, 8 |
| Linear | 24 | 13 / 20 and 12 / 14 | 28, 32 | 14, 28 | 0, pill, 4 |

Spacing was measured against eight reference sites at 390 px (`qa/bench/measure.mjs`: side margins, text sizes, control heights, gaps between text blocks, card padding) and screen by screen with `qa/bench/rhythm.mjs` (every vertical gap with the words on each side). Wattle's margins (16, 20 at 414), body (17/22), rows (52) and group gaps (32) sit where Apple's own pages sit (16, 17/21, 36 to 48 rows); HotDoc and Headspace run 20 px margins and 16 px body, Linear 24 and 13 to 15. Nothing moved on that evidence. What the rhythm pass did fix: Recent grouped single searches under headers that repeated the row (flat list until a condition repeats), a face stack that squeezed into a 30 px icon well on Home so three faces spilled over the title, two- and three-face rows whose titles did not line up (the stack reserves three faces), and a label that ended in a comma when no place was named.

What patients weigh (Zocdoc's 2025 booking data, published 2026-06): a personal connection first, twice the weight of location; 21 profiles compared before booking, 84% then stay; 93% in person. Wattle's "in their own words", "listens" highlights and in-person default already sit on that; the comparison habit is why profile hops and Compare had to be fast.

A second pair of eyes (a code-review pass over the day's diff) found that ADHDme readers would see a frame of Wattle content on the static pages before the cookie was read. Now a one-line script in `<head>` stamps `data-mode` on `<html>` before first paint, `ByMode` renders both modes and CSS shows one, and `useMode` reads the cookie synchronously (`useSyncExternalStore`); the same pass had the sliding thumb observe its children and the font load, measure to the fraction, and leave a plain fill on the selected item until it has measured (server HTML, no script). On a laptop a grouped screen (Recent, Saved, Profile, Coverage) now paints the whole page grouped grey, as iPad Settings does, instead of a 560 px grey column on white.

**The search itself (round 4).** In real Chrome on production, "Skip to my picks" took 4.3 s to reach the results, and `POST /api/match` measured 4.0 to 6.2 s warm with curl. A CPU profile (`qa/bench/profile-search.ts` bundled with esbuild, `node --cpu-prof`) put 2.2 s of a 4.6 s run in `needsFor`: `matchEvidence` and `missedAsks` re-read the sentence once per clinician and walked the roster each time, 9,740 reads for 4,870 doctors. `needsFor` is now one read per lexicon, roster and sentence (`src/matching/rank.ts`), and a search on the full roster fell from 800 to 1,500 ms to 22 to 43 ms on the desktop (`PROFILE=1 pnpm exec vitest run src/data/search-profile.test.ts`); the local API answers in 40 to 50 ms warm. On Vercel the Supabase roster (six views, 400 KB) was also rebuilt on every request because one view returns 400 and the fallback was never remembered; the roster, or the failure, is now held for ten minutes per instance.

Recent, verified on production after real searches: REA's scenario (Home → "ADHD, lived experience" → skip → results → Recent, 390 px, screenshots after every step) shows the row with two faces beside "ADHD · 3 picks, 8 Nov" and nothing overlapping; the same on Home's Recent group and at 1280 in real Chrome. Rows now arrive with the 30 ms stagger Saved already had, since they come from storage after mount.

**The animation audit, from inside real Chrome on production (2026-11-08).** `document.getAnimations()` sampled every frame through four tab-bar hops: each hop runs exactly one 150 ms page fade, one 200 ms transform transition on the tab-bar lens (cubic-bezier(0.23, 1, 0.32, 1)) and one or two 300 ms `rise` arrivals; nothing else moves, nothing animates a layout property. Title on screen: 8 to 29 ms after the tap once the tab's code is loaded (436 ms on the very first hop while it loads). Of 11 controls on Profile, 2 had no press feedback (the mode segments); segments and profile tabs now dim on press like every other control. Tap highlight is transparent, `touch-action` is `manipulation`, inputs are 17 px.

The same sampling through the flows: Home → Narrow runs the page fade and two arrivals; the searching moment staggers four `word-in` spans and its status line; results arrive with one `rise`; a profile tab switch runs one `rise` on the panel; the Refine sheet brings a 300 ms scrim fade and a 420 ms panel slide on the drawer curve, and leaves at 200 and 300 ms (`.sheet-closing`, checked by the lint). No flow animates more than one thing a reader is looking at.

Every browsing route, both widths, on production (`qa/edge/animations.mjs`, `document.getAnimations()` sampled every frame for 1.5 s after arrival, 23 routes × 2 widths): the whole app animates five things, the 150 ms page fade, the 300 ms `rise` arrival, the 200 ms colour change of a press, the 300 ms portrait fade and the splash tagline's settle; nothing on a layout property, nothing over 300 ms except the two declared sheet transitions. It exits 1 on a regression and is the fifth gate alongside `pnpm test`, `pnpm edge`, `errs.mjs` and `hops.mjs`.

Apple's current tab bar guidance (HIG, updated 2026-06-08) checked against the bar: navigation only, visible on every section, as few tabs as the hierarchy needs (four here, under the five Apple recommends), single-word labels under the icons, filled symbols for the selected tab, floating on a glass material that lets content show through. All held before this round; the sliding lens was the one thing Apple's bar does that this one did not.

Against web.dev's Interaction to Next Paint threshold (good at or under 200 ms, poor above 500 ms, the metric is a Core Web Vital): a tab hop paints its new title in 8 to 29 ms once loaded and 15 to 22 ms in the founder's Chrome, a press shows its state on pointer-down, and the one interaction that was over the line, "Skip to my picks" at 4.3 s, is now 1.0 s including the deliberate 0.9 s searching moment, with the request itself at 0.5 to 0.8 s warm.

The same pass from inside the founder's own Chrome (extension, production, 16 routes in one batch, 1.5 s of frames each): Home 362 fades and rises (one per example row and face), Recent 141 rises, Discover 235, a profile 280, and on every route only three names ever appear, `fade 150ms`, `rise 300ms` and `background-color 200ms`. Nothing else animates anywhere.

REA's passive observation of production Profile (`capture_browser_scenario` with no actions, DOM, accessibility tree, console and network captured, evidence `ev_b6853d3f…`): 41 requests, all 200; two console lines, Playwright's own service-worker notice and one 404 for a resource the page does not need; `lang="en-AU"`; no image without alt text; the accessibility tree and DOM retained for the record. The passive `inspect_web_page` tool stays refused (above); this is the passive capture that works.

**Survey, round 7 (sources beyond the first four).** NN/g on mobile navigation and icon usability: tab bars at the bottom on iPhone, labels visible at all times without interaction, navigation icons never unlabelled. Wattle: four labelled tabs, labels always shown. Industry pattern libraries (DesignStudio UIUX 2026, UXPin): a tab bar is three to five labelled destinations; Wattle has four. Material Design 3 motion: short transitions 50 to 200 ms, medium 250 to 400 ms, long 450 to 600 ms, with emphasized easing for on-screen moves; Wattle's five tokens are 100, 150, 200, 300 and 420 ms, so every transition sits in Material's short or medium band and the sheet at the bottom of its long band. Two public design systems' token scales (Sprout Seeds 150/300/600 ms; Telerik 50 to 1000 ms in 50 ms steps) corroborate a fast token near 150 and a standard near 300. Healthcare profile research by independent labs is thin on the open web; the Zocdoc 2025 booking data above remains the only quantitative source found on what patients weigh, and it supports words-first profiles.

Two more standards for the record. Target size: WCAG 2.2 SC 2.5.8 requires 24 × 24 CSS px at AA and 2.5.5 names 44 × 44 as the enhanced level; Apple's HIG recommends 44 × 44 pt and Material 48 × 48 dp. Wattle holds 44 × 44 everywhere, measured by a real tap in the edge test, which clears AA and meets Apple exactly. Baymard's 2026 mobile-app benchmark (26 apps against 330 guidelines) keeps its findings for commerce, but its first best practice, a bottom navigation item that reaches everything, maps to Wattle's Profile tab, which is where Healthspan, Openings, Discover, context and joining all live.

Read for this round (Emil Kowalski, "You don't need animations", "7 practical animation tips", the mobile-native list of 2026-08): interactions seen tens of times a day get the least motion, UI motion under 300 ms with ease-out, press feedback on pointer-down at 100 to 160 ms, interruptible transitions, 44 px targets, 16 px inputs, `touch-action: manipulation`, safe-area insets. Wattle meets each: hops are a 150 ms fade, the thumb is a 200 ms transform transition (interruptible), presses scale to .97 in 100 ms on `:active`, inputs are 17 px, the bar and docks pad for the home indicator. Not adopted: haptics through the Vibration API (Safari does not expose it) and a bounce on the tab lens (Apple's own lens does not bounce).

REA's passive `inspect_web_page` and `inspect_web_event_listeners` (CDP, no interaction) refuse every page target served by the full Chromium 156 build, headless or headful, even when `list_browser_targets` lists that same target; the attach-time check and the listing disagree. They work against Playwright's `chrome-headless-shell` build of the same version (`--remote-debugging-port`, `--remote-debugging-address=127.0.0.1`, a bare URL, the origin as the filter). Against production About (evidence `ev_93b88ba4…`): one frame, 80 accessibility nodes with the landmarks a screen reader needs (`navigation` "Primary", `main`, one `heading`, the four tab links, the Back link, the four disclosure buttons), 30 scripts, 23 resources, no console events during the window. On the Recent tab link (evidence `ev_bfeae0a9…`): exactly one `click` listener, bubbling, from Next's router chunk, and no listener of Wattle's own, which is why a tap costs one handler and 15 to 22 ms. REA's no-action scenario (next paragraph) remains the capture for console and network across the load.

A second engine agrees: REA's controlled browser scenario (`capture_browser_scenario`, Chromium 156, 390 px, production, evidence `ev_1fa566e7…`) clicked Home → Recent → Profile → Home and recorded the URL change 37, 25 and 18 ms after each tap.

Lighthouse (mobile, production, 2026-11-08 after these rounds): Profile 100 accessibility, About 95 performance, a doctor profile 86 to 94 (the external portrait is the largest paint), the first visit 82 performance and 100 accessibility. The first visit lands on the splash through a client redirect from Home (the gate is localStorage), so it pays two navigations; a cookie-gated edge redirect would make it one but would change how every QA script primes the app, so it is left as is.

**The join flow writes the real tables without a secret on Vercel (round 6).** Migration `0008_join_functions.sql` adds three `security definer` functions, `join_claim`, `join_practice` and `join_profile`, that do exactly what the service-role code in `src/server/clinician.ts` does and nothing more: a practitioner found by AHPRA number or source key or created, a pending claim, an unverified location, a primary role, declared services, the fee as an observation, a draft profile. Every row a stranger can create is unpublished until Wattle checks the register (a new practitioner has no specialty, so the published views never show them), inputs are validated and bounded, the practice and profile steps require a pending claim from the last 30 days, and five claims a day per number is the ceiling. The publishable key may execute the functions and still cannot read or write the tables (verified: 401 on a direct read). The `inbox` backend now calls these first and falls back to `join_submissions` only if a call is refused. The flow's own `source_id = 'claim'` needed a row in `sources`; the migration adds it.

**The join flow kept what a doctor entered (round 5).** Production had no `SUPABASE_SERVICE_ROLE_KEY`, so /join ran on the in-memory store and lost every sign-up. Rather than loosen the directory tables, migration `0007_join_submissions.sql` adds a write-only inbox: the publishable key may insert (an object under 64 KB) and may not read (verified: 201 on insert, 401 on select). A third backend, `inbox` (`src/server/store.ts`), posts each step there while the screens run on the local store; the "Local mode" line no longer shows. Run end to end on production with `qa/edge/join-flow.mjs`: verify → practice → skip the interview → share → review → "Submitted.", and three rows (claim, practice, profile) arrived in the table. This is the production design, not a stopgap: a sign-up is a claim until Wattle has checked the register, so review-first is the safer order, and no secret has to live on Vercel for it. Reviewing the inbox (Supabase SQL editor or the MCP, which run as the service role):

```sql
select id, kind, created_at, payload from public.join_submissions order by created_at;
```

Each doctor leaves up to three rows (claim, practice, profile) that share `payload->>'practitionerId'` from the practice row onwards and `localClaimId` on the claim; promote by inserting into `practitioners`, `provider_claims`, `practitioner_roles`, `provider_services` and `personal_profiles` as `src/server/clinician.ts` does in `supabase` mode, then delete the rows. If a service role key is ever placed on Vercel the flow writes those tables directly and the inbox goes quiet, with no code change.

## The quoted compiled rules the detectors missed

```
body,html{background:var(--color-cell);overflow-x:clip}
:focus-visible{outline:2px solid var(--color-accent-focus);outline-offset:2px;border-radius:6px}
.hit:after{content:"";z-index:1;min-width:44px;height:max(100%,44px);position:absolute;top:50%;left:0;right:0;transform:translateY(-50%)}
```

## Round 8 — production scorecard, Recent across every entry path, public-sector spacing scales (2026-11-08)

**Lighthouse 12, mobile emulation, production, every browsing route** (a11y 100 and best-practices 96 on all 14):

| Route | Perf | LCP | CLS | TBT |
| --- | --- | --- | --- | --- |
| /me | 95 | 2.6 s | 0.023 | 60 ms |
| /recent | 98 | 2.1 s | 0 | 90 ms |
| /saved | 98 | 2.3 s | 0 | 80 ms |
| /about | 94 | 2.7 s | 0 | 70 ms |
| /about/coverage | 99 | 2.0 s | 0 | 30 ms |
| /healthspan | 94 | 2.8 s | 0 | 70 ms |
| /me/openings | 99 | 2.1 s | 0 | 60 ms |
| /me/discover | 90 | 3.0 s | 0 | 190 ms |
| /me/context | 97 | 2.2 s | 0 | 110 ms |
| /compare | 99 | 2.0 s | 0 | 70 ms |
| /join | 98 | 2.3 s | 0 | 60 ms |
| /join/verify | 98 | 2.1 s | 0 | 80 ms |
| /doctor/[id] | 84 | 3.8 s | 0.014 | 140 ms |
| /results | 98 | 2.1 s | 0 | 80 ms |

The profile page is the one below 90: its LCP is the portrait on a throttled 4G mobile profile (already `fetchPriority=high`, static page). Judged and kept: the portrait is the content of that page; shrinking it further trades the thing the page is for. CLS of 0.023 on Home is the `ready` title gate (invisible until mounted) and is under the 0.1 "good" threshold.

**Recent geometry across every way a search starts** (`qa/edge/recent-geometry.mjs`, production): example row, typed sentence, and a re-opened recent, in both modes, at 320/390/1280. 30 row measurements, every face stack ends 12 px before its title, titles and subtitles share one left edge, no sideways scroll. Exit code gate, runs with `BASE=` against production.

**Two more spacing scales for the census** (public sector, so independent of the consumer apps already in the table):

| Source | Scale | Note |
| --- | --- | --- |
| NHS digital service manual (May 2025) | 4, 8, 8, 16, 24, 32, 40, 48, 56 (small screens) / 4, 8, 16, 24, 32, 40, 48, 56, 64 (≥768 px) | Responsive scale drops one step on phones; Wattle's phone gutters (16) and group gaps (24/32) sit on the same steps |
| Australia's National Digital Health Strategy (ADHA) | no spacing scale; "easy to use and able to be understood by individuals" is the stated success factor | Confirms there is no AU public token scale to match; the NHS scale is the nearest public-sector reference |

The NHS scale is the only one in the census that shrinks on phones; Wattle does the same thing by hand (24 → 16 section gaps at 390 vs 1280), which the spacing table in round 5 already recorded.
