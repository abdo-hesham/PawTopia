import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// One motion personality for the whole journey: typography rises, illustrations are
// discovered, environments breathe. Nothing bounces, nothing overshoots, nothing rotates.
export const EASE = {
  textIn: "power4.out",
  textOut: "power2.inOut",
  art: "power3.out",
  env: "power2.inOut",
  cta: "power3.out",
};

// Scene tracks are scrubbed, so their "durations" are proportions of a scroll band, not
// seconds. The hero intro is the only timeline that plays in real time, so the same
// choreography is expressed twice: once in scroll units, once in seconds.
export const SCRUB = {
  eyebrow: .16,
  headline: .22,
  body: .18,
  cta: .15,
  art: .24,
  env: .28,
  stagger: .055,
  accent: .05,
  rows: .05,
  beat: .06,
};

export const TIME = {
  eyebrow: .5,
  headline: .95,
  body: .72,
  cta: .55,
  art: .82,
  env: .9,
  stagger: .11,
  accent: .12,
  rows: .09,
  beat: .12,
};

// the paw zoom hands chapter five over inside the last fifth of one long scrubbed timeline,
// so that section reveals with the same shape at a fraction of the scale
export function scaleTiming(profile, factor) {
  const scaled = {};
  for (const key in profile) scaled[key] = profile[key] * factor;
  return scaled;
}

function nodes(target) {
  if (!target) return [];
  return gsap.utils.toArray(target).filter(Boolean);
}

// Scene timelines place their tweens in viewport-heights of scroll, so a real resize cannot
// be fixed by refreshing measurements — they have to be rebuilt. The registry is what makes
// that possible without leaving a second copy of every timeline behind.
const registry = [];

export function registerTimeline(timeline) {
  if (timeline) registry.push(timeline);
  return timeline;
}

export function killSceneMotion() {
  ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
  registry.forEach((timeline) => timeline.kill());
  registry.length = 0;
}

// Every chapter runs the same ENTER → HOLD → EXIT shape. One scrubbed track brings the scene
// in, a gap holds it, and a second track hands it to the next scene — the two tracks of
// neighbouring chapters overlap by roughly 10–20% of the scroll so nothing ever hard-cuts.
export function sceneTrack(id, { start, end, scrub = .85 } = {}) {
  const section = typeof id === "string" ? document.querySelector(id) : id;
  if (!section) return null;
  const timeline = gsap.timeline({ defaults: { ease: EASE.art }, scrollTrigger: { trigger: section, start, end, scrub } });
  timeline.scope = (selector) => section.querySelectorAll(selector);
  return registerTimeline(timeline);
}

// A chapter's whole life — hidden, enter, hold, exit — on ONE timeline driven by ONE
// trigger. Splitting a chapter across two timelines is what strands elements: scrub back up
// through an exit and it reverts to its own start values (visible) and, updating after the
// entrance, overwrites it — so the scene sits fully lit above its own section. With one
// timeline there is a single source of truth per property, and reversing is exact.
//
// Positions are measured in viewport heights of scroll rather than fractions of the
// section, so the same choreography reads at one speed whether a chapter is 100svh or
// 140svh, and the enter can never collide with the exit on a short scene.
export const STAGE = {
  eyebrow: .16,
  headline: .24,
  body: .18,
  cta: .16,
  art: .26,
  env: .3,
  stagger: .06,
  accent: .05,
  rows: .05,
  beat: .06,
};

// Where each phase sits, in viewport-heights from the moment the chapter starts arriving.
// The entrance is deliberately compressed into the first three quarters of a screen of
// scroll: a chapter is only ~1.05 screens tall, and an entrance that eats a full screen
// leaves nothing between "arrived" and "leaving" — which is what makes a scene feel like it
// never settles.
export const ENTER_AT = { env: 0, art: .1, eyebrow: .22, headline: .3, body: .46, cta: .56, rows: .6 };
const ENTER_END = .82;
const EXIT_WINDOW = .8;

export function sceneStage(target, { lead = 1, tail = .05, scrub = .8, start } = {}) {
  const section = typeof target === "string" ? document.querySelector(target) : target;
  if (!section) return null;
  const viewport = window.innerHeight;
  const beginPx = typeof start === "number" ? start : section.offsetTop - lead * viewport;
  const endPx = section.offsetTop + section.offsetHeight - tail * viewport;
  const span = Math.max(ENTER_END + .5, (endPx - beginPx) / viewport);

  const timeline = gsap.timeline({
    defaults: { ease: EASE.art },
    scrollTrigger: {
      trigger: section,
      start: typeof start === "number" ? () => start : `top ${lead * 100}%`,
      end: `bottom ${tail * 100}%`,
      scrub,
    },
  });
  // the spacer makes the timeline exactly as long as the scroll it covers, so a position of
  // 1 always means "one viewport of scrolling in"
  timeline.to({}, { duration: span }, 0);
  timeline.span = span;
  timeline.scope = (selector) => section.querySelectorAll(selector);

  // the exit starts a fixed distance from the end, unless the chapter is too short to hold
  // both phases — then it compresses rather than overlapping its own entrance
  const exitStart = Math.max(ENTER_END + .2, span - EXIT_WINDOW);
  const room = Math.max(.3, span - exitStart);
  const squeeze = Math.min(1, room / EXIT_WINDOW);
  timeline.holdFrom = ENTER_END;
  timeline.holdTo = exitStart;
  timeline.exitAt = (offset = 0) => exitStart + offset * squeeze;
  timeline.squeeze = squeeze;
  return registerTimeline(timeline);
}

// Turns a `<br>`-separated heading into the same overflow-masked lines the rest of the
// story already uses, so one reveal system covers every headline on the page.
export function maskLines(heading) {
  if (!heading || heading.querySelector(".line-mask")) return;
  const lines = [[]];
  [...heading.childNodes].forEach((node) => {
    if (node.nodeName === "BR") lines.push([]);
    else lines[lines.length - 1].push(node);
  });
  const masks = lines
    .filter((group) => group.some((node) => node.textContent.trim()))
    .map((group) => {
      const mask = document.createElement("span");
      mask.className = "line-mask";
      const inner = document.createElement("span");
      inner.append(...group);
      mask.append(inner);
      return mask;
    });
  if (masks.length) heading.replaceChildren(...masks);
  spaceLines(heading);
}

// Masked lines are separate block-level spans with nothing between them, so a screen reader
// runs them together: "Care," + "with" + "expertise." is announced as "Care,withexpertise."
// — and since every section is labelled by its heading, that mangled string is also the
// section's accessible name. A whitespace text node between the lines restores the spoken
// sentence and costs nothing on screen, because whitespace between blocks does not render.
export function spaceLines(root = document) {
  root.querySelectorAll(".line-mask, .choice-line").forEach((line) => {
    if (line === line.parentNode?.lastElementChild) return;
    const next = line.nextSibling;
    if (next && next.nodeType === Node.TEXT_NODE && /\s/.test(next.textContent)) return;
    line.after(document.createTextNode(" "));
  });
}

// Splits an already-masked line into words so it can rise as a cascade instead of a block.
// Elements inside the line (an <em>, say) stay whole and travel as one word.
export function splitWords(line) {
  if (!line) return [];
  if (line.querySelector(".word")) return nodes(line.querySelectorAll(".word"));
  const words = [];
  [...line.childNodes].forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      node.classList.add("word");
      words.push(node);
      return;
    }
    if (node.nodeType !== Node.TEXT_NODE) return;
    const fragment = document.createDocumentFragment();
    node.textContent.split(/(\s+)/).forEach((chunk) => {
      if (!chunk) return;
      if (!chunk.trim()) { fragment.append(chunk); return; }
      const word = document.createElement("span");
      word.className = "word";
      word.textContent = chunk;
      fragment.append(word);
      words.push(word);
    });
    node.replaceWith(fragment);
  });
  return words;
}

// The cinematic version of the line reveal: the words climb out from under the mask one
// after another, so a short line reads as a camera finding the type rather than a fade-in.
export function revealWords(tl, target, at = 0, { t = SCRUB, stagger = .045, from = 108 } = {}) {
  const words = nodes(target);
  if (!words.length) return tl;
  return tl.fromTo(words, { yPercent: from, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: t.headline * 1.15, ease: EASE.textIn, stagger }, at);
}

// and they leave the same way they came: up and out through the mask, a little quicker
export function exitWords(tl, target, at = 0, { t = SCRUB, stagger = .03, to = -108 } = {}) {
  const words = nodes(target);
  if (!words.length) return tl;
  return tl.fromTo(words, { yPercent: 0, autoAlpha: 1 }, { yPercent: to, autoAlpha: 0, duration: t.headline * .8, ease: EASE.textOut, stagger, immediateRender: false }, at);
}

// chapter label: quiet, quick, and always first
export function revealEyebrow(tl, target, at = 0, { t = SCRUB } = {}) {
  const items = nodes(target);
  if (!items.length) return tl;
  return tl.fromTo(items, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: t.eyebrow, ease: EASE.textIn }, at);
}

// Editorial headlines rise line by line out of their mask. Emphasised words — love. today?
// need. full circle. expertise. family. deserve. — settle a beat after the line carrying them.
export function revealHeadline(tl, target, at = 0, { t = SCRUB, stagger, from = 105 } = {}) {
  const lines = nodes(target);
  if (!lines.length) return tl;
  const step = stagger ?? t.stagger;
  tl.fromTo(lines, { yPercent: from, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: t.headline, ease: EASE.textIn, stagger: step }, at);
  lines.forEach((line, index) => {
    const accents = nodes(line.querySelectorAll("em"));
    if (!accents.length) return;
    tl.fromTo(accents, { autoAlpha: 0, yPercent: 24 }, { autoAlpha: 1, yPercent: 0, duration: t.headline * .72, ease: EASE.textIn }, at + index * step + t.accent);
  });
  return tl;
}

// supporting copy speaks after the headline, and never with the same drama
export function revealBody(tl, target, at = 0, { t = SCRUB } = {}) {
  const items = nodes(target);
  if (!items.length) return tl;
  return tl.fromTo(items, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: t.body, ease: EASE.textIn, stagger: t.rows * .6 }, at);
}

export function revealCTA(tl, target, at = 0, { t = SCRUB } = {}) {
  const items = nodes(target);
  if (!items.length) return tl;
  return tl.fromTo(items, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: t.cta, ease: EASE.cta, stagger: t.rows * .8 }, at);
}

// lists and rows: same quiet entrance, one after another
export function revealRows(tl, target, at = 0, { t = SCRUB, from = "start", y = 16 } = {}) {
  const items = nodes(target);
  if (!items.length) return tl;
  return tl.fromTo(items, { autoAlpha: 0, y }, { autoAlpha: 1, y: 0, duration: t.body, ease: EASE.textIn, stagger: { each: t.rows, from } }, at);
}

// Several layers are centred with a CSS translateX(-50%), so x is only ever written when a
// reveal actually asks for it — writing x: 0 would drag those layers half their width across.
function withDrift(from, to, x) {
  if (!x) return;
  from.x = x;
  to.x = 0;
}

// the user should feel they are discovering the illustration, not watching it fly in
export function revealArt(tl, target, at = 0, { t = SCRUB, y = 20, x = 0, stagger = 0 } = {}) {
  const items = nodes(target);
  if (!items.length) return tl;
  const from = { autoAlpha: 0, y, scale: .98 };
  const to = { autoAlpha: 1, y: 0, scale: 1, duration: t.art, ease: EASE.art, stagger };
  withDrift(from, to, x);
  return tl.fromTo(items, from, to, at);
}

// the world establishes itself before anything stands in it
export function revealEnv(tl, target, at = 0, { t = SCRUB, x = 0, scale = 1.02, stagger = 0 } = {}) {
  const items = nodes(target);
  if (!items.length) return tl;
  const from = { autoAlpha: 0, scale };
  const to = { autoAlpha: 1, scale: 1, duration: t.env, ease: EASE.env, stagger };
  withDrift(from, to, x);
  return tl.fromTo(items, from, to, at);
}

// An exit that only knows where it is going records whatever state it happens to see first
// as its starting point — scroll past a chapter quickly and it can record "already hidden",
// which then holds the scene hidden on the way back. Every exit states both ends instead,
// and defers its first render so it never fights the entrance it overlaps.
export function fadeOut(tl, target, at = 0, { from = {}, to = {}, duration = SCRUB.body, ease = EASE.textOut, stagger = 0 } = {}) {
  const items = nodes(target);
  if (!items.length) return tl;
  return tl.fromTo(items, { autoAlpha: 1, ...from }, { autoAlpha: 0, ...to, duration, ease, stagger, immediateRender: false }, at);
}

// Depth inside a settled scene: background drifts slowest, the character barely moves, the
// foreground leads. Stated from zero and rendered late so it can never record a start value
// left over from the entrance it follows.
export function parallax(tl, target, y, { at = 0, duration = 1, ease = "none" } = {}) {
  const items = nodes(target);
  if (!items.length || duration <= 0) return tl;
  return tl.fromTo(items, { y: 0 }, { y, duration, ease, immediateRender: false }, at);
}

// the settled middle of a chapter: three layers drifting at three speeds, nothing else
export function holdDepth(tl, { background, character, foreground } = {}, scale = 1) {
  const at = tl.holdFrom;
  const duration = Math.max(0, tl.holdTo - tl.holdFrom);
  if (duration <= 0) return tl;
  parallax(tl, background, 18 * scale, { at, duration });
  parallax(tl, character, 5 * scale, { at, duration });
  parallax(tl, foreground, -18 * scale, { at, duration });
  return tl;
}

// Leaving reverses the hierarchy — actions, body, headline, label — and moves a little
// quicker than the entrance. Arriving is deliberate; leaving is efficient.
export function exitCopy(tl, { cta, body, headline, eyebrow } = {}, at = 0, { t = SCRUB } = {}) {
  const beat = t.beat;
  fadeOut(tl, cta, at, { from: { y: 0 }, to: { y: -15 }, duration: t.cta * .8, stagger: t.rows * .6 });
  fadeOut(tl, body, at + beat, { from: { y: 0 }, to: { y: -18 }, duration: t.body * .8 });
  fadeOut(tl, headline, at + beat * 2, { from: { y: 0 }, to: { y: -25 }, duration: t.headline * .78, stagger: t.stagger * .5 });
  fadeOut(tl, eyebrow, at + beat * 3, { from: { y: 0 }, to: { y: -15 }, duration: t.eyebrow * .8 });
  return tl;
}

export function exitRows(tl, target, at = 0, { t = SCRUB, from = "end", x = 20 } = {}) {
  return fadeOut(tl, target, at, { from: { x: 0 }, to: { x }, duration: t.body * .8, stagger: { each: t.rows * 1.6, from } });
}
