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

## The quoted compiled rules the detectors missed

```
body,html{background:var(--color-cell);overflow-x:clip}
:focus-visible{outline:2px solid var(--color-accent-focus);outline-offset:2px;border-radius:6px}
.hit:after{content:"";z-index:1;min-width:44px;height:max(100%,44px);position:absolute;top:50%;left:0;right:0;transform:translateY(-50%)}
```
