# 002 — Reduced motion should be gentler, not silent

Severity: HIGH (accessibility)

## Problem

`src/style.css`, inside `@media (prefers-reduced-motion: reduce)`:

```css
*, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; }
```

This removes every transition on the page, including the ones that aid comprehension rather than decorate: the active chapter dot, the loop step states, the service arrows, the footer arrival mark. Reduced motion asks for less movement, not for state changes to teleport. Opacity and colour transitions are safe to keep; position and scale changes are what should go.

## Fix

Inside the existing `@media (prefers-reduced-motion: reduce)` block, replace the blanket line with:

```css
  /* movement goes; fades and colour stay, because a state that teleports is harder to
     follow, not easier */
  *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; }
  .journey-paw, .loop-illustration, .loop-steps li > b, .loop-steps li > .loop-step-copy, .destination img, .service-list i, .footer-arrival, .scene-progress i { transition-property: opacity, color, background-color, border-color !important; transition-duration: .2s !important; }
  .journey-paw.is-past, .journey-paw.is-current { transform: translate(-50%, -50%) rotate(var(--paw-rotate)) scale(1) !important; }
  .loop-illustration, .loop-steps li > b, .loop-steps li > .loop-step-copy { transform: none !important; }
```

Keep every other line in the block unchanged.

## Scope

Only the `@media (prefers-reduced-motion: reduce)` block. No JS changes — `prefersReducedMotion` branching in `src/main.js` already drops the pins, the paw zoom and Lenis.

## Verify

- DevTools → Rendering → Emulate `prefers-reduced-motion: reduce`, reload.
- Scroll the page: all content is visible, nothing slides or scales, paws appear without travelling.
- Chapter dots, loop steps and service arrows still change state with a visible ~200ms fade rather than snapping.
