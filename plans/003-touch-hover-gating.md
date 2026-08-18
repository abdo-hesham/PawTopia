# 003 — Gate hover motion behind a real pointer

Severity: MEDIUM (accessibility)

## Problem

Three rules move things on hover, and `src/style.css` contains no `@media (hover: hover)` guard anywhere:

```css
.button:hover { translate: 0 -2px !important; }                                   /* line 75  */
#scene-choice .destination:hover img { transform: translateY(-6px) scale(1.15); } /* line 211 */
.service-list button:hover i { transform: translateX(7px); opacity: 1; }          /* line 341 */
```

On a touch device a tap fires hover, and the state persists after the finger lifts — the button stays lifted 2px until something else is tapped.

## Fix

Wrap each in a pointer query, leaving the declarations byte-identical.

```css
@media (hover: hover) and (pointer: fine) { .button:hover { translate: 0 -2px !important; } }

@media (hover: hover) and (pointer: fine) { #scene-choice .destination:hover img { transform: translateY(-6px) scale(1.15); } }

@media (hover: hover) and (pointer: fine) { .service-list button:hover i { transform: translateX(7px); opacity: 1; } }
```

Leave `:active` rules alone — press feedback is correct on touch. Leave colour-only hovers (`.text-cta:hover`, `.product-note:hover`, `.button--outline:hover`, `.destination:hover .destination-copy b`) alone: they move nothing.

## Scope

Only these three rules.

## Verify

- Desktop with a mouse: hover unchanged on buttons, the SHOP/CARE illustrations, and the service-row arrows.
- Device emulation or a real phone: tap a button, scroll away — it does not stay lifted.
