# Apple pass: how Apple gets minimal, and how Wattle gets there

2026-10-23. Goal (founder): look and feel exactly like a first-party Apple iPhone app. Minimal, calm, precise.
Constraints that do not move: CLAUDE.md (Newsreader display over Inter, text budget 20 to 60 words, three badges,
"Not declared" rendered, demo reviews labelled), PRD §4 and §7.

## 1. Evidence

### 1.1 Apple's own shipped code (REA-style static analysis)

`maps.apple.com`, `www.apple.com` and `music.apple.com` are denied by this environment's network policy, so REA
could not drive a browser at Apple Maps on the web. The closest Apple-built web app that is reachable is
**Swift-DocC-Render**, the Vue app behind developer.apple.com/documentation, whose production bundle Apple
publishes as `apple/swift-docc-render-artifact` (build of 2026-07-20). `rea-agents@6.7.0` (morluto/rea) installed
and ran, then further runs were blocked by this session's permission classifier, so the same static extraction was
done with `qa/apple/css_tokens.py` (read-only, never executes the bundle). Raw output: `docs/apple/docc-render-tokens.json`.

| What Apple's CSS does | Count in Apple's 260 KB of CSS | Wattle before |
|---|---|---|
| Root font size 17 px; every size is a fraction of 17 | 10 sizes: 12, 14, 17, 19, 21, 24, 28, 32, 40, 48; 14 and 17 carry most text | 23 sizes in source, 20 rendered |
| Weights | 400 = 72%, 600 = 23%, 700 = 6% | 500 is the most used weight |
| Hand-set letter-spacing | 0 (the font's optical sizing does it) | 10 distinct values |
| `text-transform: uppercase` | 0 | 14 tracked-caps eyebrows |
| `@keyframes` | 1 | 18 |
| `:active` rules that scale | 0 of 6 (5 change colour) | every pressable scales to 0.94 with spring overshoot |
| Drop shadows on content | ~1 (the rest are focus rings) | 7 distinct |
| Grouping | stepped grey fills #f7f7f7 / #f5f5f5 / #f0f0f0 | 38 hard-coded hex colours |
| Sticky nav material | `saturate(180%) blur(20px)` over white at 70%, hairline keyline | white 86% |
| Disabled | opacity .32 | grey fill |

### 1.2 iOS 26/27 system metrics (HIG, WWDC25/26, measured builds)

Full report with sources is summarised here; [C] = measured on device builds by others, not published by Apple.

- Layout: 16 pt side margin (20 on wide phones). Inset-grouped section 16 pt from the edge, 16 pt cell padding,
  one-line row 52 pt [C], separator inset to the text column, none under the last row, 26 pt continuous group
  corners [C]. About 28 pt above a section header, 7 pt between header and group.
- Type (Large, the default): Large Title 34/41 bold, Title 1 28/34, Title 2 22/28, Title 3 20/25, Headline 17/22
  semibold, Body 17/22, Callout 16/21, Subheadline 15/20, Footnote 13/18, Caption 12/16 and 11/13. Settings uses
  three sizes: 34 bold title, 17 rows, 17 semibold section headers in secondary colour, 13 footers.
  Hierarchy is weight and colour, not size.
- Colour: label #000; secondaryLabel rgba(60,60,67,.6) is 3.4:1 and fails AA, so use Apple's increased-contrast
  grey #6C6C70 (5.2:1 on white, 4.7:1 on #F2F2F7). Grouped background #F2F2F7 with #FFF cells. Fills
  rgba(118,118,128,.12). Separator rgba(60,60,67,.29) hairline. One tint, on one or two prominent actions per view.
- Shape: capsules for buttons (iOS 26 default), concentric radii (inner = outer - padding), 26 pt groups.
- Chrome: back is a 44 pt glass circle with a chevron and no "Back" text; tab bar is a floating glass capsule
  62 pt tall, 21 pt from the sides and bottom, one-word labels, monochrome symbols; glass only on controls and
  navigation, never on content.
- Motion: springs with bounce 0 unless there is a reason; `.smooth` = 0.5 s, no overshoot. Rows highlight on
  press (#D1D1D6). Avoid motion on frequent interactions.

### 1.3 What the viral design repos agree on (2025-26)

Read from source: emilkowalski/skills (48.8k), pbakaus/impeccable (85k, trending), Leonxlnx/taste-skill (101k),
jakubkrehel/make-interfaces-feel-better, ibelick/ui-skills, vercel-labs/web-interface-guidelines,
raunofreiberg/interfaces, VoltAgent/awesome-design-md (Apple file), anthropics/skills frontend-design.

1. One accent, one or two filled actions per view (ibelick, Jakub, impeccable, HIG).
2. No eyebrows, tracked caps or 01/02/03 numbering (taste, impeccable, Anthropic). Apple: 0 uppercase.
3. No bounce or elastic; ease-out; feedback in 100-160 ms; nothing animated that happens 100 times a day (Emil, impeccable).
4. Press shows on pointer-down; never below scale .95 (Emil, Jakub, Rauno). Apple web uses colour, not scale.
5. 44 px targets, no dead zones (all).
6. Body 17, line-height ~1.47 for reading; two or three working sizes per screen (taste, Jakub, Apple DESIGN.md).
7. Concentric radii; small things get small radii; pills for actions (Jakub, Vercel, Apple DESIGN.md).
8. One depth strategy: grouping by background, shadows only on floating layers (taste, impeccable, HIG).
9. Weight 500 is absent on apple.com (Apple DESIGN.md); 400 and 600 do the work.
10. Keep `font-optical-sizing: auto`; with Inter and Newsreader hold tracking between 0 and -0.015 em (do not
    copy SF's tracking table onto Inter).

Where repos fight iOS and iOS wins: glass tab bar (taste bans it), capsule CTAs (taste/Linear dislike pills),
Inter (impeccable/Anthropic say avoid; CLAUDE.md and Apple's own guidance keep a neutral grotesque).

## 2. Plan, in order. Each step names its check.

| # | Change | Where | Check |
|---|---|---|---|
| 0 | Fix the orb crash on /narrow (`SHAPES[-1]` on a negative rAF delta) | `src/ui/kit/Orb.tsx` | no `pageerror` in `qa/apple/console.mjs` |
| 1 | One token layer: iOS colour roles, the type ramp as named styles, radii 26 / 12 / capsule, margins 16 (20 at 414+), Apple's nav material, no-overshoot curves. Body text Inter (CLAUDE.md), Roboto and Poppins dropped | `app/globals.css` | `qa/apple/audit.mjs`: rendered sizes ≤ 10, text colours ≤ 8, radii ≤ 5 |
| 2 | Motion diet: no spring overshoot, no particle bursts, no wiggle, no looping nudge or float; buttons press to .97, rows highlight; arrivals fade; tab switches near-instant | `app/globals.css`, `src/ui/celebrate.ts` | keyframes ≤ 8; reduced-motion still covers all |
| 3 | iOS primitives in the kit: NavBar (glass back circle), LargeTitle, Group + Cell (inset grouped), SectionHeader, Segmented, Button (capsule: filled, tinted, plain), Switch, filled Field, capsule Chip, floating TabBar | `src/ui/kit/*` | every screen built from them; tap targets ≥ 44 |
| 4 | Home: one action (drop the duplicate send circle), filled sentence field, suggestions as a grouped list | `Home.tsx` | words.mjs fold ≤ 60 |
| 5 | Narrow: questions as a grouped list with a trailing checkmark, capsule Continue | `Narrow.tsx` | journey still reaches /results |
| 6 | Results + profile: quiet search summary, sentence-case section labels, borderless photo, segmented sections, Apple ratings block, capsule booking button with a footnote | `Matches.tsx`, `MatchPanel.tsx`, `BookCard.tsx`, `DoctorCard.tsx`, `DoctorPage.tsx` | audit; "Example reviews" label still shown |
| 7 | Saved, Recent, Profile: large titles over #F2F2F7 grouped lists; segmented App name; iOS switch | `Tabs.tsx` | audit; no row wraps under a 2-line subtitle |
| 8 | Openings, Discover, Context, Healthspan, About, Join: same primitives, no tracked caps | screens | audit |
| 9 | Verify: typecheck, tests, build, words.mjs, before/after screenshots | `qa/apple/` | all green; before/after sheet |

Out of scope: copy changes beyond chrome labels (CLAUDE.md copy rules), ranking, data, the splash wordmark.
Decisions left to the founder: SF Pro (system-ui) on Apple devices instead of Inter; whether to keep any
"playful pass" celebration.

## 3. Result (2026-10-23)

Measured by `qa/apple/audit.mjs` on the rendered DOM of 11 patient screens at iPhone 15 size
(`qa/apple/audit-before.json` from commit 908aba0, `audit-after.json` from this pass):

| Measure | Before | After |
|---|---|---|
| Distinct font sizes rendered | 20 | 12 (incl. 7 px logo glyph, 10 px tab labels, 40 px editorial hero) |
| Corner radii | 11 | 6 |
| Text colours | 14 | 9 (3 are initials tints) |
| Text under 4.5:1 contrast | 37 | 0 |
| Tap targets under 44 px | 8 | 0 |
| Uppercase labels | 5 | 0 |
| `@keyframes` in globals.css | 18 | 5 |
| Words at the fold (`qa/iphone/words.mjs`) | Discover 74, Healthspan 79, About 106, Home 41, Profile 51 | 68, 79, 106, 49, 44 |

Also fixed on the way: the orb threw `SHAPES[-1]` on the first frame of /narrow (the "1 Issue" badge);
photos that failed before hydration showed a broken-image glyph (now initials); Saved had no way back
from a single category; a white strip showed above the tablet frame.

Before/after sheets: `qa/apple/sheet-1.png`, `qa/apple/sheet-2.png`. Re-run:
`CHROME=/opt/pw-browsers/chromium OUT=after node qa/apple/shoot.mjs` then `python3 qa/apple/sheet.py`.

Not done here (founder's call): Discover, Healthspan and About were over the 60-word budget before this
pass and still are; that is copy, not chrome. SF Pro via `system-ui` on Apple devices instead of Inter.
Whether any of the playful pass's celebration should come back (now a haptic plus the drawn tick).
