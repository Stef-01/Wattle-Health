# REA analysis of an Apple-built web app

2026-10-23. Tool: REA (`rea-agents@6.7.0`, morluto/rea; tarball sha512 verified against the npm registry
before running). Operation: `analyze-javascript-application`, static only; nothing in the bundle was executed.

## Target

`apple/swift-docc-render-artifact`, `dist/` (Apple's production build of Swift-DocC-Render, the Vue app behind
developer.apple.com/documentation; build of 2026-07-20). Apple Maps, Music and apple.com were the first choice
but `maps.apple.com`, `www.apple.com` and `music.apple.com` are denied by this environment's network policy and
do not resolve for the fetch tool either. Allowing them in the environment's Network access settings would let
REA's `capture-browser-scenario` / `analyze-web-bundle` run against Apple Maps on the web.

Evidence `ev_51de59dadc10fe14544fe11ac0b9d29b7b524af8195bcd44b3115819c72bccde`
(root artifact sha256 `524f3be7…c8ec44`): 34 JavaScript files parsed, 0 parse failures, 280 webpack modules,
1,107 findings, 208,618 AST nodes visited. Limitations recorded by REA: graph coverage is incomplete (the Swift
highlighter module exceeded the result budget; its static facts were retained on the file node); bindings were
recovered from inert syntax only.

## Findings (observed in Apple's code; module, REA node, source range)

| Behaviour | Module | Where | What Apple does |
|---|---|---|---|
| Scroll lock under a modal | 4610 | `js/671.e431d40c.js` 10:54229-10:55592, node `jag_node_958dba81…` | On iPhone/iPad (`/iP(ad\|hone\|od)/`, or MacIntel with touch): a non-passive `touchmove` on the document prevents page scroll; the panel tracks touch Y and stops the rubber-band at its top and bottom (`scrollTop === 0 && dy > 0` or at bottom and `dy < 0`), otherwise lets the panel scroll; pinch (2+ touches) is allowed. Elsewhere: `body { position: fixed; top: -scrollY; overflow: hidden scroll; width: 100% }`, then restore and `scrollTo` the saved offset on unlock. |
| Sticky nav background | 9065 | 10:109503-10:114921, node `jag_node_634cdf85…` | An IntersectionObserver sets `isSticking = intersectionRatio !== 1` (ignored while `scrollY < 0`, the overscroll bounce). The bar's material (`saturate(180%) blur(20px)`, white 70%) and keyline appear only while sticking. `noBackgroundTransition` starts true and is cleared after 8 frames (`NoBGTransitionFrames`) so the bar does not flash on load. |
| Escape and focus | 9065, 6262 | 9065 as above; 6262 `js/416.63979f15.js` 10:11371-10:15018 | Escape closes the open nav/modal and returns focus to its toggle; the modal installs a focus trap; the nav also closes on `popstate`, `orientationchange` and a click outside. |
| Scroll direction | 8284 | 10:76968-10:78267 | IntersectionObserver callbacks record scroll direction by comparing `window.scrollY` to the previous value. |
| Reduced motion | 8486 | 10:98947-10:107308 | `matchMedia("(prefers-reduced-motion)")` decides whether video autoplays or shows a replay control. |
| Breakpoints in JS | 7633 | 10:75846-10:76962 | A `BreakpointEmitter` mirrors the CSS breakpoints through `matchMedia`, so layout logic and CSS agree. |

Inference (not observed at runtime): these are the same mechanics iOS uses for bars (transparent at the scroll
edge, material once content passes under) and sheets (the page behind does not move).

## Applied to Wattle

- `Sheet` (src/ui/kit/bits.tsx): Apple's scroll lock (both paths), Escape to close, focus moved into the sheet on
  open and returned to the trigger on close, closes on browser back.
- `NavBar` (src/ui/kit/index.tsx): pinned; transparent at the top, Apple's material and a hairline once content
  scrolls under it (IntersectionObserver sentinel, same `ratio !== 1` rule), no transition on first paint; the
  large title's text appears as the inline title while sticking (iOS large-title collapse).
- Results progress bar: the same sticking rule instead of an always-on material.

The CSS-level extraction from the same bundle (type ramp, weights, colours, radii, keyframes) is in
`docs/apple/PLAN.md` §1.1 and `docs/apple/docc-render-tokens.json`.
