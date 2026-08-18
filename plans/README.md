# Animation plans

Findings from a motion audit of the Pawtopia scroll story (vanilla JS + GSAP + ScrollTrigger + Lenis). Each plan is self-contained: exact file, exact current code, exact target values.

| # | Plan | Severity | Category | Status |
| --- | --- | --- | --- | --- |
| 001 | [Drive the loop rail with transforms, not layout](001-loop-rail-transform.md) | HIGH | Performance | DONE |
| 002 | [Reduced motion should be gentler, not silent](002-reduced-motion-gentler.md) | HIGH | Accessibility | DONE |
| 003 | [Gate hover motion behind a real pointer](003-touch-hover-gating.md) | MEDIUM | Accessibility | DONE |
| 004 | [Stop holding compositor layers for the whole page](004-transient-will-change.md) | MEDIUM | Performance | DONE |
| 005 | [Two state swaps that currently teleport](005-state-swap-polish.md) | LOW | Cohesion | DONE |

## Execution order

001 and 002 are independent and highest leverage — do them first. 003 and 005 are pure CSS and touch nothing else. 004 touches both `src/style.css` and `src/main.js` and should land last, since its verification step (frame timing, Layers panel) is the one most easily confused by other changes in flight.

## Not reported

Deliberate tradeoffs already documented in the source were left alone:

- `!important` on `.button:hover` / `:active` — a comment in `src/style.css` explains that GSAP owns the button's `transform` during reveals, so the lift claims `translate`/`scale` instead.
- Ambient loops (`hero-atmosphere-float-*`, `interlude-breathe`) — not scroll-synced by design, and the portal's loop already stops on `.is-zooming`.
- Long scene-level durations (0.5s+ on `.loop-illustration`, `.destination img`) — editorial scene motion, not UI feedback, so the sub-300ms UI budget does not apply.

## Missed opportunities (not yet planned)

- Cart rows are rebuilt through `innerHTML` in `renderCart()`, so items pop in and out with no transition.
- The chapter-marker number in the header swaps instantly on every chapter change.
