# 004 — Stop holding compositor layers for the whole page

Severity: MEDIUM (performance)

## Problem

`src/style.css:102` and five other rules promote elements permanently:

```css
.scene-character, .vet-character, .family-character, .final-pet, .loop-illustration, .discovery-world img, .destination img { will-change: transform, opacity; }
```

plus `will-change: transform, opacity` on `.hero-atmosphere, .hero-environment, .hero-ground`, `.choice-environment`, `.vet-branch`, `.family-branch`, and `will-change: transform` on `.interlude-portal`.

`will-change` is a hint meant to be applied shortly before an animation and dropped after. Held permanently across ~15 elements, each keeps its own compositor layer and texture memory for the whole session, whether or not its chapter is anywhere near the viewport.

## Fix

Scope the hint to the chapter that is actually on screen.

1. Delete the standalone `will-change` declarations from: the `.scene-character, .vet-character, …` rule (line 102 — delete the whole rule), `.hero-atmosphere, .hero-environment, .hero-ground`, `.choice-environment`, `.vet-branch`, `.family-branch`. Leave the rest of each rule intact.

2. Add one rule after `.story-scene`:

```css
/* the hint is only worth paying for while a chapter is actually on screen */
.story-scene.is-live .scene-character, .story-scene.is-live .vet-character, .story-scene.is-live .family-character, .story-scene.is-live .final-pet, .story-scene.is-live .loop-illustration, .story-scene.is-live .discovery-world img, .story-scene.is-live .destination img, .story-scene.is-live .hero-atmosphere, .story-scene.is-live .hero-environment, .story-scene.is-live .hero-ground, .story-scene.is-live .choice-environment, .story-scene.is-live .vet-branch, .story-scene.is-live .family-branch { will-change: transform, opacity; }
```

3. Replace `.interlude-portal`'s permanent hint with one that only applies during the zoom:

```css
.interlude-portal.is-zooming { will-change: transform; }
```

4. In `src/main.js`, inside `buildSceneMotion()` after the existing builders, add:

```js
  // the compositor hint follows the reader instead of being held for the whole page
  scenes.forEach((scene) => {
    ScrollTrigger.create({
      trigger: scene,
      start: "top bottom+=50%",
      end: "bottom top-=50%",
      onToggle: (self) => scene.classList.toggle("is-live", self.isActive),
    });
  });
```

## Scope

No timeline, easing or duration changes.

## Verify

- DevTools → Layers at the top of the page: chapters 03–07 no longer hold their own layers.
- Scroll through: no new jank; the paw zoom is still smooth.
- Frame timing over a 6s scroll stays at a 16.7ms median with zero frames over 24ms.
