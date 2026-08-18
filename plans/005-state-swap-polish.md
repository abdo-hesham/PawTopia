# 005 — Two state swaps that currently teleport

Severity: LOW (cohesion)

## Problem A — the active chapter dot

`src/style.css:391-392`:

```css
.scene-progress i { display: block; width: 6px; height: 6px; border: 1px solid var(--navy); border-radius: 50%; }
.scene-progress .is-active i { border-color: var(--coral); background: var(--coral); transform: scale(1.45); }
```

`i` has no `transition`, so the dot jumps from 1 to 1.45 at every chapter change — in the one fixed element the reader uses to track progress.

## Problem B — the loop headline crossfade

`src/style.css:263`:

```css
.loop-headline { grid-area: 1 / 1; opacity: 0; transition: opacity .5s ease; }
```

Four headlines share one grid cell. During the 500ms swap both the outgoing and the incoming line sit around 50% opacity and overlap, so the type is briefly unreadable.

## Fix

1. Give the dot a transition — the movement is meaningful, it marks where the reader is:

```css
.scene-progress i { display: block; width: 6px; height: 6px; border: 1px solid var(--navy); border-radius: 50%; transition: transform .32s cubic-bezier(.22,.72,.2,1), background-color .32s ease, border-color .32s ease; }
```

2. Shorten the loop crossfade and offset the halves so they never sit at 50% together:

```css
.loop-headline { grid-area: 1 / 1; opacity: 0; transition: opacity .28s ease-out; }
.loop-headline.is-active { opacity: 1; transition: opacity .34s ease-out .12s; }
.loop-line { grid-area: 1 / 1; opacity: 0; transition: opacity .28s ease-out; }
.loop-line.is-active { opacity: 1; transition: opacity .34s ease-out .12s; }
```

The outgoing line is gone in 280ms; the incoming one starts 120ms later.

## Scope

Only these rules.

## Verify

- Watch the left rail while scrolling between chapters: the active dot grows into place instead of snapping.
- Scroll chapter 04 through all four states slowly: at no point are two headlines legible at once.
