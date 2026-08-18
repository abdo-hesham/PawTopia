# 001 — Drive the loop rail with transforms, not layout

Severity: HIGH (performance)

## Problem

`src/style.css`:

```css
.loop-rail i { position: absolute; top: 0; left: 0; width: 100%; height: var(--loop-walk); background: rgba(242,113,82,.5); transition: height .14s linear; }
.loop-paw { position: absolute; top: var(--loop-walk); left: 50%; width: 23px; height: 23px; margin: 0; color: var(--coral); transform: translate(-50%,-50%) rotate(180deg); transition: top .14s linear; }
```

`src/main.js` rewrites the variable on every scroll frame of chapter 04's 350svh pin:

```js
function setLoopWalk(frame, walk) {
  if (!frame) return;
  frame.style.setProperty("--loop-walk", `${(walk * 100).toFixed(2)}%`);
  frame.classList.toggle("is-complete", walk > .995);
}
```

`height` and `top` are layout properties: each frame triggers layout, paint and composite. The variable is set on `.loop-frame`, so every child's styles recalculate too.

## Fix

Keep the same visual result using `transform` only.

1. In `src/style.css`, replace the two rules with:

```css
.loop-rail i { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(242,113,82,.5); transform: scaleY(var(--loop-walk, 0)); transform-origin: top center; transition: transform .14s linear; }
.loop-paw { position: absolute; top: 0; left: 50%; width: 23px; height: 23px; margin: 0; color: var(--coral); transform: translate(-50%, -50%) translateY(calc(var(--loop-walk, 0) * var(--loop-rail-height, 0px))) rotate(180deg); transition: transform .14s linear; }
```

2. `--loop-walk` becomes a unitless 0–1 number. In `src/main.js`, change `setLoopWalk` to:

```js
function setLoopWalk(frame, walk) {
  if (!frame) return;
  frame.style.setProperty("--loop-walk", walk.toFixed(4));
  frame.classList.toggle("is-complete", walk > .995);
}
```

3. The paw needs the rail's pixel height for its travel. In `buildLoopMotion`, after `const rail = section.querySelector(".loop-rail");` add:

```js
  // the paw travels the rail in pixels, so the rail's measured height feeds the transform
  const measureRail = () => frame.style.setProperty("--loop-rail-height", `${rail.offsetHeight}px`);
  measureRail();
  ScrollTrigger.addEventListener("refreshInit", measureRail);
```

## Scope

Do not touch any other rule, timeline or value. `.loop-rail` itself keeps its existing `height: 42%`.

## Verify

- Scroll chapter 04 slowly: the coral fill grows from the top and the paw tracks it exactly as before, reaching the bottom at the RETURN state.
- Chrome DevTools Performance, record while scrolling the pin: no "Layout" entries attributable to `.loop-rail i` or `.loop-paw`.
- Resize the window mid-chapter and confirm the paw still lands on the rail's end.
