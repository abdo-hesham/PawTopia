import "./style.css";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { hydrateAssets } from "./assets.js";
// The shop and the checkout are two of the three routes, and a reader who lands on the story
// may never open either. Their code is fetched when a route needs it, and pre-warmed at idle
// after the story has painted, so the first visit carries less script and a click still opens
// instantly.
let shopModule = null;
let checkoutModule = null;
let shopLoading = null;
let checkoutLoading = null;

function loadShopModule() {
  if (shopModule) return Promise.resolve(shopModule);
  shopLoading = shopLoading || import("./shop.js").then((module) => {
    shopModule = module;
    registerCatalogue(module.CATALOGUE);
    return module;
  });
  return shopLoading;
}

function loadCheckoutModule() {
  if (checkoutModule) return Promise.resolve(checkoutModule);
  checkoutLoading = checkoutLoading || import("./checkout.js").then((module) => {
    checkoutModule = module;
    return module;
  });
  return checkoutLoading;
}

// the checkout reads the bag, and the bag can hold shop goods, so it needs the catalogue too
function routeModule(name) {
  if (name === "shop") return loadShopModule();
  if (name === "checkout") return loadShopModule().then(loadCheckoutModule);
  return Promise.resolve(null);
}
import { buildMicroInteractions, pulseCartCount, confirmAdd } from "./micro.js";
import { buildCalendar, formatDate, shortDate } from "./calendar.js";
import {
  EASE,
  SCRUB,
  STAGE,
  ENTER_AT,
  TIME,
  scaleTiming,
  sceneTrack,
  sceneStage,
  holdDepth,
  maskLines,
  spaceLines,
  revealEyebrow,
  revealHeadline,
  revealWords,
  exitWords,
  splitWords,
  revealBody,
  revealCTA,
  revealRows,
  revealArt,
  revealEnv,
  exitCopy,
  exitRows,
  fadeOut,
  parallax,
  registerTimeline,
  killSceneMotion,
} from "./motion.js";

gsap.registerPlugin(ScrollTrigger);
if (import.meta.env?.DEV) window.__pawtopia = { gsap, ScrollTrigger, lenis: () => lenis };
ScrollTrigger.config({ limitCallbacks: true, ignoreMobileResize: true });
hydrateAssets();

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const scenes = gsap.utils.toArray(".story-scene");
const progressButtons = gsap.utils.toArray(".scene-progress button");
const siteHeader = document.querySelector(".site-header");
const sceneProgress = document.querySelector(".scene-progress");
const storyPage = document.querySelector(".story-page");
const journeyLayer = document.querySelector(".global-paw-journey");
const footerArrival = document.querySelector(".footer-arrival");

const sceneMeta = [
  ["01", "Love"],
  ["02", "Choice"],
  ["03", "Discovery"],
  ["04", "Full circle"],
  ["05", "Veterinary"],
  ["06", "Family"],
  ["07", "Next step"],
];

// The bag is shared between the story and the shop, so both price in EGP — a single total
// cannot hold two currencies. The three story products are the same goods the shop sells.
const products = {
  trail: { name: "Trail Bites", detail: "Good-dog treats", price: 240, code: "01" },
  cloud: { name: "Cloud Nap", detail: "Washable pet bed", price: 1180, code: "02" },
  roam: { name: "Roam Rope", detail: "Everyday leash", price: 540, code: "03" },
};

let lenis;
let activeScene = -1;
let activeLoopStage = -1;
let routePaws = [];
let routeLines = [];
let routeY = [];
let activePaw = -2;
let routeFrame = 0;
let stageRanges = [];
let walkFrame = 0;
let routeGuideVisible = false;
let sceneMotionBuilt = false;
let chapterBands = [];
// where a chapter click should come to rest, for the chapters whose motion does not begin
// at their own top edge; empty means "the section top"
let sceneLandings = [];
let chromeBand = null;
let chromeVisible = null;
let cinematicChrome = false;
let motionScale = 1;
let compact = false;
let stacked = false;
let heroIntro = null;
let navigating = false;
let navigationTarget = -1;
let navigationTimer = 0;
let viewportWidth = window.innerWidth;
let viewportHeight = window.innerHeight;
// every chapter's single timeline, kept so a real resize can rebuild them against the new
// viewport — their positions are measured in viewport heights, so they cannot just be refreshed
let sceneTimelines = [];
let route = "story";
const HERO_PAW_COUNT = 6;
// the loop finishes its walk at 82% of the pin so RETURN can settle before the interlude
const LOOP_WALK = .82;
// The four stages take an even quarter each of the pinned scroll, and the last of them is
// done before the chapter starts handing over, so RETURN is read rather than glimpsed.
const LOOP_STAGES_END = .84;
const loopStageAt = (progress) => Math.floor(Math.max(0, Math.min(.999, progress / LOOP_STAGES_END)) * 4);
// chapter five arrives inside the last fifth of the paw zoom, so its reveal runs the same
// shape as every other chapter at roughly two fifths of the scale
const ZOOM_TIMING = scaleTiming(SCRUB, .42);
const QUOTE_TIMING = scaleTiming(SCRUB, .6);
// the travel lines own a short trigger of their own, so their beats are scaled to it
const TRAVEL_TIMING = scaleTiming(SCRUB, .85);

// One trail walks the whole page. `points` draw it through open travel space; `tail` marks the
// steps that leave a chapter's bottom edge and lead into the next travel space, so the walk
// never restarts and never prints over scene content. An entry with neither ends the run.
//
// The tails start around three fifths of the way down a chapter, which is where its exit
// begins: the trail is already walking while the scene lets go, so the reader is handed from
// one to the other rather than watching an empty screen wait for the next print.
const routeBlueprint = [
  { id: "#scene-love" },
  { id: "#travel-01", points: [[51,.1],[57,.3],[62,.52],[59,.74],[52,.93]] },
  { id: "#scene-choice", tail: [[51,.62],[50,.72],[50,.81],[49,.9]], stackedTail: [[50,.62],[49,.67]] },
  { id: "#travel-02", points: [[46,.1],[40,.3],[36,.52],[41,.74],[48,.93]] },
  { id: "#scene-discovery", tail: [[51,.66],[52,.76],[53,.85],[55,.94]] },
  { id: "#travel-03", points: [[54,.12],[62,.34],[67,.57],[62,.79],[56,.95]] },
  { id: "#scene-loop" },
  { id: "#interlude-vet", points: [[57,.02],[54,.07],[51,.12],[50,.17]] },
  { id: "#scene-vet", tail: [[50,.66],[49,.76],[48,.85],[47,.94]] },
  { id: "#travel-05", points: [[45,.12],[40,.34],[42,.58],[48,.86]] },
  { id: "#scene-family", tail: [[49,.64],[50,.74],[51,.84],[52,.94]] },
  { id: "#travel-06", points: [[54,.1],[59,.3],[57,.54],[51,.82]] },
  // chapter seven hands the walk over already drifting right, so the footer curve can clear
  // the centred send-off copy on its way to the dog and cat
  { id: "#scene-final", tail: [[49,.6],[50,.7],[52,.79],[55,.87],[58,.94]] },
  // the last stretch: right of the headline, then back in to meet the pets on their hill.
  // Narrow screens skip it — the send-off is one full-width column there with no lane to
  // pass the type in, so the walk still ends inside chapter seven.
  { id: ".site-footer", wideOnly: true, points: [[64,.05],[73,.15],[78,.25],[79,.35],[76,.46],[71,.57]] },
];

function pawMarkup() {
  return '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="11" cy="4" r="2"></circle><circle cx="18" cy="8" r="2"></circle><circle cx="20" cy="16" r="2"></circle><path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z"></path></svg>';
}

function measureViewport() {
  compact = window.innerWidth <= 900;
  stacked = window.innerWidth <= 720;
  // mobile keeps the story but halves the choreography
  motionScale = compact ? .5 : 1;
}

// A chapter only takes over once its scene is meaningfully on screen. The paw-zoom interlude
// belongs to 04, so chapter 05 waits until the portal is genuinely opening into it.
function buildChapterBands() {
  const viewport = window.innerHeight;
  chapterBands = scenes.map((scene) => scene.offsetTop - viewport * .42);
  const interlude = document.querySelector("#interlude-vet");
  // with the zoom in play the vet scene overlaps the interlude, so 05 waits for the portal;
  // without it the interlude is just a quote and 05 arrives with its own scene
  if (interlude && !prefersReducedMotion) chapterBands[4] = interlude.offsetTop + viewport * (compact ? .4 : .46);
  for (let index = 1; index < chapterBands.length; index += 1) chapterBands[index] = Math.max(chapterBands[index], chapterBands[index - 1] + viewport * .2);

  // The chrome used to arrive and leave on ScrollTrigger callbacks, which are skipped when
  // the page jumps past a trigger — a restored scroll position or a chapter click could
  // leave the header invisible and unclickable. Reading it from scroll can't be skipped.
  const firstTravel = document.querySelector("#travel-01");
  const footer = document.querySelector(".site-footer");
  chromeBand = {
    start: prefersReducedMotion ? 0 : (firstTravel ? firstTravel.offsetTop - viewport * .76 : 0),
    end: footer ? footer.offsetTop - viewport * .34 : Number.MAX_SAFE_INTEGER,
  };
}

function resolveChrome() {
  // Outside the story the header is ordinary site navigation, not a chapter cue: it stays
  // put. The band below only governs the journey, where it arrives with chapter two and
  // steps out of the send-off.
  if (route !== "story") { setChromeVisibility(true); return; }
  if (!chromeBand) return;
  setChromeVisibility(window.scrollY >= chromeBand.start && window.scrollY < chromeBand.end);
}

// Where each chapter's stage holds the screen: from a quarter screen before it sticks to a
// quarter screen after its section lets it go. Inside that run the chapter owns the view.
function buildStageRanges() {
  stageRanges = scenes.map((scene) => {
    const top = scene.getBoundingClientRect().top + window.scrollY;
    return { top, bottom: top + scene.offsetHeight };
  });
}

const clamp01 = (value) => Math.max(0, Math.min(1, value));

// Two questions, and the trail is only shown when both answer yes: is there a print near the
// middle of the screen, and is the screen free of a chapter. Prints alone are not enough —
// the walk into the paw portal is laid a few pixels below chapter four's last frame, and
// chapter tails start while their own stage is still standing. Chapters alone are not enough
// either — between two of them there are stretches the route never visits. The measure used
// to be a distance to the nearest travel space, which left a quarter-strength dotted line
// printed across every illustration and still never reached full strength in the short
// spaces between chapters.
function pawPresence(centreY) {
  if (!routeY.length) return 1;
  const viewport = window.innerHeight;
  let gap = Infinity;
  for (let index = 0; index < routeY.length; index += 1) {
    gap = Math.min(gap, Math.abs(routeY[index] - centreY));
    if (routeY[index] > centreY) break;
  }
  const reach = 1 - Math.min(1, Math.max(0, gap - viewport * .2) / (viewport * .4));

  const scroll = window.scrollY;
  const edge = viewport * .28;
  let held = 0;
  for (let index = 0; index < stageRanges.length; index += 1) {
    const { top, bottom } = stageRanges[index];
    const arriving = clamp01((scroll - (top - edge)) / edge);
    // The trail starts coming back a fifth of a screen before the stage is released rather
    // than at the release itself. By then the chapter's exit has all but finished, and the
    // alternative was a plain cream screen with the chapter gone and the walk not yet back.
    const leaving = clamp01((bottom - viewport + edge * .3 - scroll) / edge);
    held = Math.max(held, arriving * leaving);
  }

  const open = reach * (1 - held);
  return open * open * (3 - 2 * open);
}

function resolveChapter() {
  resolveChrome();
  // during a click journey the indicator waits for the destination instead of flickering
  // through every chapter the page passes on the way
  if (navigating) return;
  let next = 0;
  for (let index = 0; index < chapterBands.length; index += 1) {
    if (window.scrollY >= chapterBands[index]) next = index;
    else break;
  }
  setActiveScene(next);
}

function buildGlobalPawJourney() {
  const pawContainer = document.querySelector(".global-paw-prints");
  const lineContainer = document.querySelector(".global-paw-lines");
  pawContainer.replaceChildren();
  lineContainer.replaceChildren();

  measureViewport();
  const svgNamespace = "http://www.w3.org/2000/svg";
  const pawTrackHalf = Math.max(8, Math.min(17, storyPage.clientWidth * .012));

  // each stretch of open page becomes one run: a chapter's tail steps hand over to the
  // travel space below it, and the run only ends where the trail truly stops
  const runs = [];
  let openRun = null;

  routeBlueprint.forEach(({ id, points, tail, stackedTail, wideOnly }) => {
    const section = document.querySelector(id);
    if (!section) return;
    if (wideOnly && compact) { openRun = null; return; }
    const list = tail ? (stacked && stackedTail ? stackedTail : tail) : points;
    if (!list) { openRun = null; return; }
    if (tail) openRun = null;
    const sectionTop = section.offsetTop;
    const sectionHeight = section.offsetHeight;
    if (!openRun) { openRun = []; runs.push(openRun); }
    list.forEach(([guideX, y]) => {
      const responsiveGuideX = compact ? 50 + (guideX - 50) * .58 : guideX;
      openRun.push({ x: storyPage.clientWidth * responsiveGuideX / 100, y: sectionTop + sectionHeight * y });
    });
  });

  // the paw prints are placed in pixels, so the guide must be too. A percentage height
  // would restretch the lines whenever the page grows after build (lazy art, late fonts)
  // and drag the last segment down past the end of the walk into the footer.
  const guideSvg = document.createElementNS(svgNamespace, "svg");
  guideSvg.classList.add("paw-guide");
  guideSvg.setAttribute("viewBox", `0 0 ${storyPage.clientWidth} ${storyPage.scrollHeight}`);
  guideSvg.setAttribute("preserveAspectRatio", "none");
  guideSvg.setAttribute("aria-hidden", "true");
  guideSvg.style.width = `${storyPage.clientWidth}px`;
  guideSvg.style.height = `${storyPage.scrollHeight}px`;
  lineContainer.append(guideSvg);

  // How far apart the prints are along the path. The chapters are two and a half screens
  // each now, so the trail runs longer through them; at the old spacing a single wheel push
  // could land half a dozen prints at once, which reads as a rash rather than a walk.
  const stride = Math.max(150, Math.min(255, window.innerHeight * .21));
  const segments = [];
  const placed = [];
  let stepParity = 0;

  runs.forEach((routePoints) => {
    if (routePoints.length < 2) return;
    const runSegments = [];
    let runLength = 0;

    for (let index = 1; index < routePoints.length; index += 1) {
      const previous = routePoints[index - 1];
      const point = routePoints[index];
      const dy = point.y - previous.y;
      const line = document.createElementNS(svgNamespace, "path");
      line.setAttribute("class", "trail-line");
      line.setAttribute("d", `M ${previous.x} ${previous.y} C ${previous.x} ${previous.y + dy * .48}, ${point.x} ${point.y - dy * .48}, ${point.x} ${point.y}`);
      guideSvg.append(line);
      const length = line.getTotalLength();
      const entry = { line, start: runLength, length, startY: previous.y, endY: point.y };
      runSegments.push(entry);
      segments.push(entry);
      runLength += length;
    }

    const steps = Math.max(1, Math.round(runLength / stride));
    const spacing = runLength / steps;

    for (let step = 0; step <= steps; step += 1) {
      const distance = Math.min(runLength, step * spacing);
      const segment = runSegments.find((entry) => distance <= entry.start + entry.length) || runSegments[runSegments.length - 1];
      const local = Math.max(0, Math.min(segment.length, distance - segment.start));
      const point = segment.line.getPointAtLength(local);
      const before = segment.line.getPointAtLength(Math.max(0, local - 5));
      const after = segment.line.getPointAtLength(Math.min(segment.length, local + 5));
      const heading = Math.atan2(after.y - before.y, after.x - before.x);
      const side = stepParity % 2 === 0 ? "left" : "right";
      const lateral = side === "left" ? -pawTrackHalf : pawTrackHalf;
      stepParity += 1;

      const paw = document.createElement("span");
      paw.className = `paw-mark journey-paw journey-paw--${side}`;
      paw.innerHTML = pawMarkup();
      paw.style.left = `${point.x + Math.cos(heading + Math.PI / 2) * lateral}px`;
      paw.style.top = `${point.y + Math.sin(heading + Math.PI / 2) * lateral}px`;
      paw.style.setProperty("--paw-rotate", `${Math.max(130, Math.min(230, heading * 180 / Math.PI + 90))}deg`);
      pawContainer.append(paw);
      placed.push(point.y);
    }
  });

  routePaws = gsap.utils.toArray(".journey-paw");
  routeLines = segments;
  routeY = placed;
  activePaw = -2;
  buildChapterBands();
  buildStageRanges();
  updatePawJourney();
}

function updatePawJourney() {
  const storyTop = storyPage.getBoundingClientRect().top + window.scrollY;
  const viewport = window.innerHeight;
  // Where the walk has reached. It used to be 92% down the screen, which meant a print was
  // stepped on almost as soon as it crossed the bottom edge — and the three prints below a
  // chapter's released stage were all past that line at once, so they arrived together.
  // Reading the walk further up the screen spaces them out: each print is stepped on as the
  // reader scrolls to it, one at a time, the way the rest of the trail already behaved.
  const focusY = window.scrollY - storyTop + viewport * .62;
  const presence = pawPresence(window.scrollY - storyTop + viewport * .5);
  journeyLayer.style.setProperty("--paw-presence", presence.toFixed(3));
  // While a chapter owns the screen the walk is held where it stopped. It used to keep
  // stepping behind the chapter — the prints below the fold were lit one by one against a
  // hidden layer — so when the chapter let go and the layer came back, four prints that had
  // already been stepped on faded up together as a block. Holding the walk means the stretch
  // below a chapter is still unwalked when the screen opens, and it is walked then: one print
  // after another, in the order the reader is about to travel them.
  if (presence < .12) return;
  let nextActive = -1;
  for (let index = 0; index < routeY.length; index += 1) {
    if (routeY[index] <= focusY) nextActive = index;
    else break;
  }
  // One print per frame. A held walk, a chapter click, a restored scroll position — anything
  // that leaves the walk behind used to be repaid in a single update, and a stretch of prints
  // lit as one block. Repaying it a step at a time means the reader watches the walk cross the
  // ground either way, and the rest of the ground is covered on the frames after this one, so
  // catching up still takes well under a second.
  if (nextActive > activePaw + 1) {
    // A few prints owed is a walk and is paced like one. A long way owed is a page that was
    // jumped rather than travelled — a chapter click, a restored position — and there the
    // walk covers the ground as fast as the frames allow instead of making the reader wait.
    const hurry = nextActive - activePaw > 8 || document.body.classList.contains("is-navigating");
    nextActive = activePaw + 1;
    const step = () => { walkFrame = 0; updatePawJourney(); };
    if (!walkFrame) walkFrame = hurry ? requestAnimationFrame(step) : setTimeout(step, 110);
  }
  if (nextActive === activePaw) return;
  // A jump — a fast flick, a chapter click, a restored scroll — would otherwise land every
  // paw in between at once and read as a group appearing. Each step gets a small delay from
  // where the walk was, so the prints always arrive one after another, in walking order,
  // and unwind the same way when the page scrolls back up.
  const previous = Math.max(activePaw, -1);
  const walkingForward = nextActive > previous;
  activePaw = nextActive;
  routePaws.forEach((paw, index) => {
    const past = index < nextActive;
    const current = index === nextActive;
    const wasLanded = index <= previous;
    const step = walkingForward ? index - previous : previous - index;
    const delay = (past || current) !== wasLanded ? Math.min(900, Math.max(0, step - 1) * 150) : 0;
    paw.style.setProperty("--paw-delay", `${delay}ms`);
    paw.classList.toggle("is-past", past);
    paw.classList.toggle("is-current", current);
  });
  // the last print reaches the Pawtopia paw in the footer: the journey is over, nothing walks on
  footerArrival?.classList.toggle("is-arrived", nextActive >= routeY.length - 1 && routeY.length > 0);
  const lookahead = window.innerHeight * .9;
  routeLines.forEach((segment) => {
    const past = segment.endY <= focusY;
    const upcoming = routeGuideVisible && !past && segment.startY <= focusY + lookahead;
    segment.line.classList.toggle("is-past", past);
    segment.line.classList.toggle("is-guide", upcoming);
  });
}

// Lenis drives the scene timelines while it owns the scroll, but the page can also move
// without it — a restored scroll position, an anchor jump, a keyboard page-down. Updating
// here as well keeps every timeline tied to where the page actually is.
function scheduleRouteUpdate() {
  if (routeFrame) return;
  routeFrame = requestAnimationFrame(() => {
    routeFrame = 0;
    // The chapter timelines are built when the opening finishes, because building them
    // while it plays would overwrite the hero's starting state. A reader who scrolls before
    // that — or a tab that loaded in the background, where the opening does not advance at
    // all — would meet a story with no motion, so leaving chapter one ends the opening now.
    if (heroIntro && window.scrollY > window.innerHeight * .3) finishHeroIntro();
    ScrollTrigger.update();
    updatePawJourney();
    resolveChapter();
  });
}

function setActiveScene(index) {
  const next = Math.max(0, Math.min(sceneMeta.length - 1, index));
  if (next === activeScene) return;
  activeScene = next;
  progressButtons.forEach((button, buttonIndex) => button.classList.toggle("is-active", buttonIndex === next));
  const marker = document.querySelector(".chapter-marker");
  marker.querySelector("b").textContent = sceneMeta[next][0];
  marker.querySelector("i").textContent = sceneMeta[next][1];
  marker.dataset.sceneTarget = String(next);
}

function setChromeVisibility(visible, immediate = false) {
  if (chromeVisible === visible && !immediate) return;
  chromeVisible = visible;
  const duration = immediate ? 0 : .48;
  gsap.to(siteHeader, { autoAlpha: visible ? 1 : 0, y: visible ? 0 : -siteHeader.offsetHeight, duration, ease: EASE.art, overwrite: "auto" });
  gsap.to(sceneProgress, { autoAlpha: visible ? 1 : 0, x: visible ? 0 : -20, y: 0, duration, ease: EASE.art, overwrite: "auto" });
  siteHeader.classList.toggle("is-visible", visible);
  sceneProgress.classList.toggle("is-visible", visible);
}

// the navbar stays put all journey; it only steps back during the paw zoom
function setCinematicChrome(active) {
  if (cinematicChrome === active || !chromeVisible) return;
  cinematicChrome = active;
  gsap.to([siteHeader, sceneProgress], { autoAlpha: active ? .26 : 1, duration: .4, ease: EASE.env, overwrite: "auto" });
}

function setLoopStage(index) {
  const next = Math.max(0, Math.min(3, index));
  if (next === activeLoopStage) return;
  activeLoopStage = next;
  // only one of the four is on screen at a time, so only one is exposed: otherwise the
  // section's accessible name is all four headlines run together
  document.querySelectorAll("[data-loop-copy]").forEach((copy) => {
    const live = Number(copy.dataset.loopCopy) === next;
    copy.classList.toggle("is-active", live);
    if (live) copy.removeAttribute("aria-hidden");
    else copy.setAttribute("aria-hidden", "true");
  });
  document.querySelectorAll("[data-loop-step]").forEach((step, stepIndex) => {
    step.classList.toggle("is-active", stepIndex === next);
    step.classList.toggle("is-done", stepIndex < next);
    // the row is a control, so which stage it is asking for is stated rather than only drawn
    const control = step.querySelector(".loop-step");
    if (!control) return;
    if (stepIndex === next) control.setAttribute("aria-current", "step");
    else control.removeAttribute("aria-current");
  });
  // the outgoing illustration leaves before the incoming one arrives, for the same reason
  // the headlines do: two of them at half opacity is not a crossfade, it is a double exposure
  document.querySelectorAll("[data-loop-art]").forEach((art, artIndex) => {
    const visible = artIndex === next;
    art.classList.toggle("is-active", visible);
    gsap.to(art, {
      autoAlpha: visible ? 1 : 0,
      y: visible ? 0 : 28,
      scale: visible ? 1 : .94,
      duration: visible ? .5 : .3,
      delay: visible ? .32 : 0,
      ease: EASE.art,
      overwrite: true,
    });
  });
}

// A stage can be asked for by name. The four stages are stops along chapter four's pinned
// run, so the page travels to the middle of the one that was asked for and the scene's own
// scroll-driven crossfade brings its headline, its line and its illustration in — the walk on
// the rail, the row states and the scroll position all stay one thing.
function scrollToLoopStage(index) {
  const section = document.querySelector("#scene-loop");
  if (!section) return;
  const stage = Math.max(0, Math.min(3, index));
  // reduced motion has no pinned run to travel: the stage is simply shown
  if (prefersReducedMotion || !lenis) { setLoopStage(stage); return; }
  const run = Math.max(1, section.offsetHeight - window.innerHeight);
  const target = section.offsetTop + run * ((stage + .5) / 4) * LOOP_STAGES_END;
  lenis.scrollTo(target, { duration: .95, easing: TRAVEL_EASE });
}

document.addEventListener("click", (event) => {
  const control = event.target.closest?.("[data-loop-jump]");
  if (!control) return;
  scrollToLoopStage(Number(control.dataset.loopJump));
});

function setLoopWalk(frame, walk) {
  if (!frame) return;
  // a unitless 0-1 figure: the rail scales by it and the paw multiplies it by the rail's
  // measured height, so neither one touches a layout property
  frame.style.setProperty("--loop-walk", walk.toFixed(4));
  frame.classList.toggle("is-complete", walk > .995);
}

function buildHeroMotion() {
  const hero = sceneTrack("#scene-love", { start: "top top", end: "bottom top", scrub: .7 });
  if (!hero) return;
  // TEXT EXIT leads: cue, action, body, headline, chapter label — then the world drifts on
  fadeOut(hero, hero.scope(".scroll-cue"), 0, { duration: .1 });
  exitCopy(hero, {
    cta: hero.scope(".scene-copy--hero .button"),
    body: hero.scope(".scene-copy--hero .scene-intro"),
    headline: hero.scope("#love-title .line-mask > span"),
    eyebrow: hero.scope(".scene-copy--hero .scene-kicker"),
  }, 0);
  // the world chapter one stands in leaves with it: a dimmed layer left behind reads as a
  // ghost of the last chapter sitting under the next one
  fadeOut(hero, hero.scope(".hero-environment, .hero-atmosphere"), .74, { duration: .2, ease: EASE.env });
  fadeOut(hero, hero.scope(".hero-ground"), .8, { duration: .18, ease: EASE.env });
  hero
    // editorial depth: background drifts slowest, the character barely moves, ground leads
    .to(hero.scope(".hero-atmosphere"), { y: 24 * motionScale, duration: 1, ease: "none" }, 0)
    .to(hero.scope(".hero-environment"), { y: 18 * motionScale, duration: 1, ease: "none" }, 0)
    .to(hero.scope(".hero-environment--left"), { x: -13 * motionScale, duration: 1, ease: "none" }, 0)
    .to(hero.scope(".hero-environment--right"), { x: 13 * motionScale, duration: 1, ease: "none" }, 0)
    .to(hero.scope(".scene-character--hero"), { y: 7 * motionScale, duration: 1, ease: "none" }, 0)
    .to(hero.scope(".hero-ground"), { y: -30 * motionScale, duration: 1, ease: "none" }, 0);

  // The world lets go exactly the way it arrived. The opening brought the two sides in from
  // scale 1.02 and transparent, left first, right a beat later; leaving plays that in
  // reverse — right releases first, both easing back out to 1.02 as they fade — so the
  // hero's last gesture rhymes with its first instead of just sliding off the top.
  fadeOut(hero, hero.scope(".hero-atmosphere"), .42, { from: { scale: 1 }, to: { scale: 1.02 }, duration: .3, ease: EASE.env, stagger: .05 });
  fadeOut(hero, hero.scope(".hero-environment--right"), .5, { from: { scale: 1 }, to: { scale: 1.02 }, duration: .34, ease: EASE.env });
  fadeOut(hero, hero.scope(".hero-environment--left"), .56, { from: { scale: 1 }, to: { scale: 1.02 }, duration: .34, ease: EASE.env });
  fadeOut(hero, hero.scope(".hero-ground"), .62, { from: { scale: 1 }, to: { scale: 1.01 }, duration: .3, ease: EASE.env });
  // the person and dog stay longest, so the walk itself is the last thing chapter one releases
  fadeOut(hero, hero.scope(".scene-character--hero"), .7, { duration: .24, ease: EASE.env });
}

function buildChoiceMotion() {
  const stage = sceneStage("#scene-choice", { scrub: .8 });
  if (!stage) return;
  sceneTimelines.push(stage);
  sceneLandings[1] = stage.settled;
  const t = STAGE;

  // ENTER — environment, illustrations, chapter label, headline, body, destinations
  revealEnv(stage, stage.scope(".choice-environment--left"), ENTER_AT.env, { t, x: -26 });
  revealEnv(stage, stage.scope(".choice-environment--right"), ENTER_AT.env + .04, { t, x: 26 });
  revealArt(stage, stage.scope(".destination--shop .destination-art"), ENTER_AT.art, { t, y: 25 });
  revealArt(stage, stage.scope(".destination--care .destination-art"), ENTER_AT.art + .1, { t, y: 25 });
  revealEyebrow(stage, stage.scope(".scene-kicker"), ENTER_AT.eyebrow, { t });
  revealHeadline(stage, stage.scope("#choice-title .choice-line > span"), ENTER_AT.headline, { t });
  revealBody(stage, stage.scope(".scene-heading--center > p:last-child"), ENTER_AT.body, { t });
  revealRows(stage, stage.scope(".destination-copy > *"), ENTER_AT.rows, { t, y: 14 });
  stage.fromTo(stage.scope(".choice-fork"), { autoAlpha: 0 }, { autoAlpha: 1, duration: t.env, ease: EASE.env }, ENTER_AT.cta);

  // HOLD — trees drift, the destinations hold almost still, the fork on the ground leads
  holdDepth(stage, {
    background: stage.scope(".choice-environment"),
    character: stage.scope(".destination-art"),
    foreground: stage.scope(".choice-fork"),
  }, motionScale);

  // EXIT — body, headline, label, then the crossroads collapses into the single path
  exitCopy(stage, {
    body: stage.scope(".scene-heading--center > p:last-child"),
    headline: stage.scope("#choice-title .choice-line > span"),
    eyebrow: stage.scope(".scene-heading--center .scene-kicker"),
  }, stage.exitAt(.06), { t });
  fadeOut(stage, stage.scope(".destination--shop"), stage.exitAt(.4), { from: { x: 0 }, to: { x: -30 * motionScale }, duration: t.art, ease: EASE.env });
  fadeOut(stage, stage.scope(".destination--care"), stage.exitAt(.4), { from: { x: 0 }, to: { x: 30 * motionScale }, duration: t.art, ease: EASE.env });
  fadeOut(stage, stage.scope(".choice-fork"), stage.exitAt(.46), { from: { scaleX: 1 }, to: { scaleX: .08 }, duration: t.art, ease: EASE.env });
  fadeOut(stage, stage.scope(".choice-environment"), stage.exitAt(.5), { duration: t.env, ease: EASE.env });
}

function buildDiscoveryMotion() {
  const stage = sceneStage("#scene-discovery", { scrub: .75 });
  if (!stage) return;
  sceneTimelines.push(stage);
  sceneLandings[2] = stage.settled;
  const t = STAGE;

  // ENTER — the pets land first here, then the type speaks over them
  stage.fromTo(stage.scope(".discovery-ground"), { autoAlpha: 0 }, { autoAlpha: 1, duration: t.env, ease: EASE.env }, ENTER_AT.env);
  revealArt(stage, stage.scope(".discovery-figure"), ENTER_AT.art, { t, y: 25, stagger: t.stagger });
  revealEyebrow(stage, stage.scope(".scene-kicker"), ENTER_AT.eyebrow, { t });
  revealHeadline(stage, stage.scope("#discovery-title .line-mask > span"), ENTER_AT.headline, { t });
  revealBody(stage, stage.scope(".scene-intro"), ENTER_AT.body, { t });
  revealCTA(stage, stage.scope(".text-cta"), ENTER_AT.cta, { t });
  revealRows(stage, stage.scope(".product-note"), ENTER_AT.rows, { t, y: 20 });

  // HOLD — the pets hold, the ground they stand on leads
  // On a phone the pets and their grass are one stacked block, so splitting them across two
  // parallax speeds slid the ground out from under their feet. The group drifts as one there.
  holdDepth(stage, compact
    ? { character: stage.scope(".discovery-world") }
    : { character: stage.scope(".discovery-figure"), foreground: stage.scope(".discovery-ground") },
    motionScale);

  // EXIT — the shelf empties row by row, the copy follows, the pets stay a beat longer
  exitRows(stage, stage.scope(".product-note"), stage.exitAt(0), { t, x: 0 });
  fadeOut(stage, stage.scope(".product-notes"), stage.exitAt(.14), { from: { y: 0 }, to: { y: -20 }, duration: t.body });
  exitCopy(stage, {
    cta: stage.scope(".text-cta"),
    body: stage.scope(".scene-intro"),
    headline: stage.scope("#discovery-title .line-mask > span"),
    eyebrow: stage.scope(".scene-copy--left .scene-kicker"),
  }, stage.exitAt(.1), { t });
  fadeOut(stage, stage.scope(".discovery-world"), stage.exitAt(.4), { from: { yPercent: 0 }, to: { yPercent: -3 }, duration: t.art, ease: EASE.env });
  fadeOut(stage, stage.scope(".discovery-ground"), stage.exitAt(.5), { duration: t.env, ease: EASE.env });
}

function buildLoopMotion() {
  const section = document.querySelector("#scene-loop");
  if (!section) return;
  const frame = section.querySelector(".loop-frame");
  const rail = section.querySelector(".loop-rail");
  // the paw travels the rail in pixels, so the rail's measured height feeds its transform
  const measureRail = () => frame.style.setProperty("--loop-rail-height", `${rail.offsetHeight}px`);
  measureRail();
  ScrollTrigger.addEventListener("refreshInit", measureRail);

  // a click on chapter four lands on SHOP, established, rather than on the first frame of
  // the section's arrival
  sceneLandings[3] = section.offsetTop + window.innerHeight * .28;
  const enter = sceneTrack("#scene-loop", { start: "top 82%", end: "top 14%", scrub: .72 });
  revealHeadline(enter, enter.scope("#loop-title .loop-headline.is-active .line-mask > span"), .06);
  revealArt(enter, enter.scope(".loop-art"), .14, { y: 24 });
  revealBody(enter, enter.scope(".scene-intro"), .28);
  if (stacked) {
    // On a phone the four stages sit at the foot of the stage, and the stage is still sliding
    // up while the rest of the chapter is being written — so the list was animating below the
    // fold and had already finished by the time it arrived on screen. The reader met a
    // headline, an illustration and half a screen of nothing. It is written once the stage is
    // standing still instead, in view, and it is still there for the whole walk.
    const rows = sceneTrack("#scene-loop", { start: "top top", end: "top -26%", scrub: .6 });
    revealRows(rows, rows.scope(".loop-steps li"), 0, { y: 18 });
  } else {
    revealRows(enter, enter.scope(".loop-steps li"), .32, { y: 18 });
  }
  enter.fromTo(enter.scope(".loop-rail"), { autoAlpha: 0 }, { autoAlpha: 1, duration: SCRUB.env, ease: EASE.env }, .42);

  // the loop quiets itself down for the interlude instead of just scrolling away
  const handover = registerTimeline(gsap.timeline({ paused: true, defaults: { ease: EASE.textOut } }));
  fadeOut(handover, section.querySelector(".scene-copy--loop"), 0, { from: { y: 0 }, to: { y: -26 }, duration: .5 });
  fadeOut(handover, section.querySelector(".loop-steps"), .08, { from: { y: 0 }, to: { y: -20 }, duration: .5 });
  fadeOut(handover, rail, .12, { duration: .4 });
  fadeOut(handover, section.querySelector(".loop-art"), .3, { from: { y: 0 }, to: { y: -16 }, duration: .5 });

  // SHOP → CARE → EXPERTISE → RETURN activate in order while the paw walks the rail;
  // the walk completes at LOOP_WALK so RETURN can be read before the handover starts
  ScrollTrigger.create({
    trigger: section,
    start: "top top",
    end: "bottom bottom",
    onUpdate: (self) => {
      const walk = Math.min(1, self.progress / LOOP_WALK);
      setLoopStage(loopStageAt(self.progress));
      setLoopWalk(frame, walk);
      handover.progress(gsap.utils.clamp(0, 1, (self.progress - LOOP_STAGES_END) / (1 - LOOP_STAGES_END)));
    },
  });
}

function buildInterludeMotion() {
  const interlude = document.querySelector("#interlude-vet");
  if (!interlude) return;
  const frame = interlude.querySelector(".interlude-frame");
  const quote = interlude.querySelector(".interlude-quote");
  const portal = interlude.querySelector(".interlude-portal");
  const journey = document.querySelector(".global-paw-journey");
  // The paw fills the screen before chapter five exists. It grows until nothing else is
  // visible, turns the colour of the page, and only then lets go — so the reader never sees
  // the veterinary world arrive, they find it already standing when the paw opens.
  const portalScale = stacked ? 96 : 112;

  const zoom = registerTimeline(gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: {
      trigger: interlude,
      // The interlude begins where chapter four ends, not before it. Starting a third of a
      // screen early meant the quote arrived on top of RETURN, which is also why the fourth
      // stage never felt like it was reached.
      start: "top top",
      end: "bottom bottom",
      scrub: .7,
      onUpdate: (self) => {
        portal.classList.toggle("is-zooming", self.progress > .52);
        setCinematicChrome(self.progress > .42 && self.progress < .97);
      },
    },
  }));

  // the quote stands alone in cream with the paw beneath it, so it rises the way every
  // headline on the page does: line by line, the trusted words last
  const quoteLines = quote.querySelectorAll(".line-mask > span");
  revealHeadline(zoom, quoteLines, .14, { t: QUOTE_TIMING, stagger: .05, from: 60 });
  zoom
    .fromTo(portal, { autoAlpha: 0, scale: .72 }, { autoAlpha: 1, scale: 1, duration: .13, ease: EASE.art }, .2)
    // 33%–44% deliberate pause, then the quote leaves and the paw is alone
    .to(quoteLines, { autoAlpha: 0, y: -15, duration: .12, ease: EASE.textOut, stagger: .02 }, .44)
    .to(journey, { autoAlpha: 0, duration: .07 }, .48)
    // one continuous growth rather than a series of jumps: by .82 the paw is the screen
    .to(portal, { scale: portalScale, duration: .32, ease: EASE.env }, .5)
    // and it takes the colour of the page as it arrives, so the screen turns cream rather
    // than coral before chapter five is uncovered
    .to(portal, { color: "#f8dcc8", duration: .1 }, .64)
    .to(portal, { color: "#fbf6ec", duration: .1 }, .74);

  zoom
    // the frame lets go last, uncovering the world that was built behind the paw
    .to(frame, { autoAlpha: 0, duration: .09 }, .9)
    .to(journey, { autoAlpha: 1, duration: .06 }, .94);

  // Chapter five's own timeline takes over from three quarters of the way through the zoom,
  // so the sage world is already there when the giant paw dissolves. It is handed the scroll
  // position rather than the section, because the section starts a screen higher than the
  // moment the audience should first see it.
  const viewport = window.innerHeight;
  // the same point the trigger above starts at, so the handover is measured from where the
  // zoom actually begins
  const zoomStart = interlude.offsetTop;
  const zoomEnd = interlude.offsetTop + interlude.offsetHeight - viewport;
  return zoomStart + (zoomEnd - zoomStart) * .8;
}

function buildVetMotion(handoverPx) {
  const stage = sceneStage("#scene-vet", { start: handoverPx, scrub: .8 });
  if (!stage) return;
  sceneTimelines.push(stage);
  // Chapter five's timeline starts before its own section — the paw portal hands it over
  // mid-interlude — so like every other chapter it lands where its entrance has finished
  // rather than where its section begins.
  sceneLandings[4] = stage.settled;
  // Chapter five arrives under the dissolving paw rather than from below, so its entrance
  // runs at roughly two thirds speed and lands inside the first half-screen of scroll: by
  // the time the section is established, the whole chapter — services included — is there.
  const t = scaleTiming(STAGE, .62);
  // Chapter five is assembled behind the paw while the paw is the whole screen, so by the
  // time the screen opens the scene is already standing.
  const at = { env: 0, art: .06, eyebrow: .16, headline: .22, body: .34, rows: .4 };

  // ENTER — sage field, sprigs, the vet and dog, chapter label, headline, copy, services
  revealEnv(stage, stage.scope(".vet-blob"), at.env, { t });
  revealArt(stage, stage.scope(".vet-branch--left"), at.env + .03, { t, y: 18 });
  revealArt(stage, stage.scope(".vet-branch--right"), at.env + .05, { t, y: 18 });
  revealArt(stage, stage.scope(".vet-character"), at.art, { t, y: 25 });
  revealEyebrow(stage, stage.scope(".scene-kicker"), at.eyebrow, { t });
  revealHeadline(stage, stage.scope("#vet-title .line-mask > span"), at.headline, { t });
  revealBody(stage, stage.scope(".scene-intro"), at.body, { t });
  revealRows(stage, stage.scope(".service-list li"), at.rows, { t, y: 12, stagger: t.rows });

  // HOLD — chapter five holds still on purpose: the field drifts, the vet never floats
  holdDepth(stage, {
    background: stage.scope(".vet-blob"),
    character: stage.scope(".vet-character"),
    foreground: stage.scope(".vet-branch"),
  }, motionScale);

  // EXIT — softer than the zoom that brought us here: the rows leave from the bottom up,
  // the copy follows, and the vet lingers longest before the sage lightens
  exitRows(stage, stage.scope(".service-list li"), stage.exitAt(0), { t, x: 20 * motionScale });
  exitCopy(stage, {
    body: stage.scope(".scene-copy--right .scene-intro"),
    headline: stage.scope("#vet-title .line-mask > span"),
    eyebrow: stage.scope(".scene-copy--right .scene-kicker"),
  }, stage.exitAt(.16), { t });
  fadeOut(stage, stage.scope(".vet-character"), stage.exitAt(.44), { from: { yPercent: 0 }, to: { yPercent: -2 }, duration: t.art, ease: EASE.env });
  fadeOut(stage, stage.scope(".vet-branch"), stage.exitAt(.48), { duration: t.art, ease: EASE.env, stagger: t.rows });
  fadeOut(stage, stage.scope(".vet-blob"), stage.exitAt(.52), { duration: t.env, ease: EASE.env });
  // The service list draws its own top rule and the frame draws a hairline under the scene.
  // Neither belongs to an element the exit was fading, so both were left hanging in an empty
  // chapter. The list goes with its rows, and the frame — which owns the hairline — goes last.
  fadeOut(stage, stage.scope(".service-list"), stage.exitAt(.14), { duration: t.body, ease: EASE.env });
  fadeOut(stage, stage.scope(".scene-frame--vet"), stage.exitAt(.58), { duration: t.env, ease: EASE.env });
}

function buildFamilyMotion() {
  const stage = sceneStage("#scene-family", { lead: .88, scrub: .85 });
  if (!stage) return;
  sceneTimelines.push(stage);
  sceneLandings[5] = stage.settled;
  const t = STAGE;

  // ENTER — the emotional pause: the world settles, then two phrases with a beat between
  revealEnv(stage, stage.scope(".family-field"), ENTER_AT.env, { t, scale: .97 });
  revealArt(stage, stage.scope(".family-branch"), ENTER_AT.env + .06, { t, y: 16 });
  revealArt(stage, stage.scope(".family-art"), ENTER_AT.art, { t, y: 25 });
  revealEyebrow(stage, stage.scope(".family-kicker"), ENTER_AT.eyebrow, { t });
  revealHeadline(stage, stage.scope("#family-title .line-mask:nth-child(-n+2) > span"), ENTER_AT.headline, { t });
  // "They're family." waits — the pause is short, but it has to be felt
  revealHeadline(stage, stage.scope("#family-title .line-mask:nth-child(3) > span"), ENTER_AT.headline + .26, { t });
  stage.fromTo(stage.scope(".family-sweep"), { autoAlpha: 0 }, { autoAlpha: 1, duration: t.env, ease: EASE.env }, ENTER_AT.body + .06);
  revealBody(stage, stage.scope(".family-note"), ENTER_AT.cta, { t });

  // HOLD — the quietest depth on the page: the field breathes, the two of them barely move
  holdDepth(stage, {
    background: stage.scope(".family-field"),
    character: stage.scope(".family-art"),
    foreground: stage.scope(".family-sweep"),
  }, motionScale);

  // EXIT — chapter six dissolves rather than leaves: copy first, illustration after
  exitCopy(stage, {
    body: stage.scope(".family-note"),
    headline: stage.scope("#family-title .line-mask > span"),
    eyebrow: stage.scope(".family-kicker"),
  }, stage.exitAt(0), { t });
  fadeOut(stage, stage.scope(".family-sweep, .family-branch"), stage.exitAt(.3), { duration: t.body, ease: EASE.env, stagger: t.rows });
  fadeOut(stage, stage.scope(".family-art"), stage.exitAt(.38), { from: { yPercent: 0 }, to: { yPercent: -3 }, duration: t.art, ease: EASE.env });
  fadeOut(stage, stage.scope(".family-field"), stage.exitAt(.48), { duration: t.env, ease: EASE.env });
}

function buildFinalMotion() {
  const stage = sceneStage("#scene-final", { lead: .94, scrub: .75 });
  if (!stage) return;
  sceneTimelines.push(stage);
  sceneLandings[6] = stage.settled;
  const t = STAGE;

  // ENTER — the world opens back up, familiar from chapter one, and the walk arrives
  revealEnv(stage, stage.scope(".final-environment--left"), ENTER_AT.env, { t, x: -34 });
  revealEnv(stage, stage.scope(".final-environment--right"), ENTER_AT.env, { t, x: 34 });
  revealEnv(stage, stage.scope(".final-ground"), ENTER_AT.env + .06, { t });
  revealArt(stage, stage.scope(".final-atmosphere"), ENTER_AT.art, { t, y: 18, stagger: t.stagger });
  revealArt(stage, stage.scope(".final-pet--dog"), ENTER_AT.art + .06, { t, x: -26, y: 14 });
  revealArt(stage, stage.scope(".final-pet--cat"), ENTER_AT.art + .12, { t, x: 26, y: 14 });
  revealEyebrow(stage, stage.scope(".scene-kicker"), ENTER_AT.eyebrow, { t });
  revealHeadline(stage, stage.scope("#final-title .line-mask > span"), ENTER_AT.headline, { t });
  revealHeadline(stage, stage.scope(".final-copy h3 .line-mask > span"), ENTER_AT.headline + .2, { t });
  stage.fromTo(stage.scope(".final-divider"), { autoAlpha: 0 }, { autoAlpha: 1, duration: t.env, ease: EASE.env }, ENTER_AT.body + .06);
  revealCTA(stage, stage.scope(".button-row .button"), ENTER_AT.cta, { t });

  // HOLD — chapter one's depth again: sky slowest, pets nearly still, ground leading
  holdDepth(stage, {
    background: stage.scope(".final-environment, .final-atmosphere"),
    character: stage.scope(".final-pet"),
    foreground: stage.scope(".final-ground"),
  }, motionScale);

  // EXIT — the send-off: actions, copy, the pets, then the world dims into the footer.
  // The side environment holds longest and only dims, so the last screen still has a place.
  fadeOut(stage, stage.scope(".button-row .button"), stage.exitAt(0), { from: { y: 0 }, to: { y: -20 }, duration: t.cta, stagger: t.rows });
  fadeOut(stage, stage.scope(".final-divider"), stage.exitAt(.08), { duration: t.body, ease: EASE.env });
  fadeOut(stage, stage.scope(".final-copy h3, #final-title, #scene-final .scene-kicker"), stage.exitAt(.14), { from: { y: 0 }, to: { y: -20 }, duration: t.headline, stagger: t.stagger });
  fadeOut(stage, stage.scope(".final-pet"), stage.exitAt(.4), { duration: t.art, ease: EASE.env });
  fadeOut(stage, stage.scope(".final-environment, .final-atmosphere, .final-ground"), stage.exitAt(.5), { duration: t.env, ease: EASE.env, stagger: t.rows });
}

// The lines that live out in the open beside the trail are part of the walk, so they read
// the same way a chapter does: they rise into the whitespace line by line, hold while the
// paws pass, then lift away before the next steps continue.
function buildTravelMotion() {
  gsap.utils.toArray(".journey-space").forEach((zone) => {
    const line = zone.querySelector("p");
    if (!line) return;
    maskLines(line);
    const words = [];
    line.querySelectorAll(".line-mask > span").forEach((row) => words.push(...splitWords(row)));

    // The line is triggered on itself, not on the travel space around it. Measured from the
    // zone, the cascade finished while the text still sat 520px down an 800px viewport —
    // it played low and half below the fold, so by the time it was worth looking at it was
    // already over, and the line read as static. From the paragraph, the words climb as it
    // crosses the middle of the screen.
    //
    // One timeline, like every chapter: enter, drift, exit. Splitting them would let the
    // exit revert to its own visible start values when scrolled back up and overwrite the
    // entrance, leaving the words showing before they are meant to arrive.
    const track = sceneTrack(line, { start: "top 92%", end: "top -25%", scrub: .8 });
    track.to({}, { duration: 1 }, 0);

    // the words climb out from under the mask as the line comes up the screen
    revealWords(track, words, 0, { t: TRAVEL_TIMING, stagger: .045 });
    // the camera keeps moving: the whole line drifts up through the space it sits in
    parallax(track, line, -34 * motionScale, { at: 0, duration: 1 });
    // It leaves the way it came, up and out — but quickly and almost together. A long
    // cascade meant the line spent most of its life half-lit, three words in and three words
    // out, which reads as a broken line rather than a phrase being spoken and finished.
    exitWords(track, words, .68, { t: TRAVEL_TIMING, stagger: .01 });
  });
}

// the journey is over, so the footer arrives quietly: the Pawtopia paw the trail was walking
// toward, then the send-off, then the links, then the legal line
function buildFooterMotion() {
  // The send-off releases a little before its section ends, so the footer starts arriving
  // while chapter seven is still letting go rather than after a screen of nothing.
  const footer = sceneTrack(".site-footer", { start: "top 118%", end: "top 8%", scrub: .78 });
  if (!footer) return;
  revealEnv(footer, footer.scope(".footer-blob"), 0, { scale: 1.03, stagger: SCRUB.stagger });
  // the reveal moves the mark inside the span, so the span keeps its own arrival scale
  revealArt(footer, footer.scope(".footer-arrival svg"), .16, { y: 14 });
  footer.fromTo(footer.scope(".footer-rule"), { autoAlpha: 0 }, { autoAlpha: 1, duration: SCRUB.env, ease: EASE.env }, .26);
  revealHeadline(footer, footer.scope(".footer-headline .line-mask > span"), .34);
  revealBody(footer, footer.scope(".footer-note"), .52);
  revealRows(footer, footer.scope(".footer-legal .brand, .footer-social, .footer-meta"), .62, { y: 12 });
}

function buildSceneMotion() {
  if (sceneMotionBuilt) return;
  sceneMotionBuilt = true;

  buildHeroMotion();
  buildChoiceMotion();
  buildDiscoveryMotion();
  buildLoopMotion();
  // the interlude hands chapter five the scroll position where its own timeline takes over
  buildVetMotion(buildInterludeMotion());
  buildFamilyMotion();
  buildFinalMotion();
  buildTravelMotion();
  buildFooterMotion();

  gsap.to(".scroll-cue i", { scaleY: .25, duration: 1.1, repeat: -1, yoyo: true, ease: "sine.inOut" });

  // the compositor hint follows the reader instead of being held for the whole page
  scenes.forEach((scene) => {
    ScrollTrigger.create({
      trigger: scene,
      start: "top bottom+=50%",
      end: "bottom top-=50%",
      onToggle: (self) => scene.classList.toggle("is-live", self.isActive),
    });
  });
}

// reduced motion keeps the content and the chapter progression, drops the pins and the zoom
function buildReducedMotion() {
  const loopFrame = document.querySelector(".loop-frame");
  ScrollTrigger.create({
    trigger: "#scene-loop",
    start: "top top",
    end: "bottom bottom",
    onUpdate: (self) => {
      const walk = Math.min(1, self.progress / LOOP_WALK);
      setLoopStage(loopStageAt(self.progress));
      setLoopWalk(loopFrame, walk);
    },
  });

  gsap.utils.toArray(".scene-copy, .scene-heading, .family-copy, .final-copy, .scene-character, .vet-character, .family-art, .final-pet, .discovery-world, .choice-paths, .product-notes, .interlude-quote").forEach((element) => {
    gsap.fromTo(element, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: .38, ease: EASE.art, scrollTrigger: { trigger: element, start: "top 92%", once: true } });
  });
}

// Chapter clicks use a symmetric curve instead. The wheel ease covers half its distance in
// the first tenth of the time, which reads as a jump followed by a drift — fine when the
// reader caused the movement, wrong when the page is walking them somewhere and the point
// is to watch the paws cross the space on the way.
const TRAVEL_EASE = (progress) => (progress < .5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2);
// The walk through the travel space is paced differently again: an even middle with soft
// ends, so the prints land at a steady rhythm instead of racing through the fast part of a
// curve. A walking pace is the whole point of that stretch.
const WALK_EASE = (progress) => -(Math.cos(Math.PI * progress) - 1) / 2;

function setupSmoothScroll() {
  // Reduced motion is the only thing that turns the glide off entirely. A modest device
  // used to lose it too, which left half the visitors on a different site; instead it keeps
  // the smooth wheel and hands touch back to the platform, where the inertia is free.
  if (prefersReducedMotion) return;
  const modestDevice = (navigator.hardwareConcurrency || 4) < 4;
  // A heavier glide than the browser's own: the page keeps travelling for a moment after
  // the wheel stops, which is what makes a scroll read as camera movement rather than paging.
  // Two levers, and they do different jobs. The multipliers set how far one gesture travels —
  // under 1 the page moves less per wheel notch, which is the "slower" half. The lerp sets how
  // closely the page follows that target, which is the "smoother" half.
  lenis = new Lenis({
    // One continuous glide rather than a tween restarted per notch. On a duration curve every
    // wheel event began a new 1.45s ease from wherever the last one had reached, so a burst of
    // notches — which is how anybody actually scrolls — stacked restart on restart and the
    // page pulsed. A damped approach folds each notch into the movement already under way, and
    // it is normalised against frame time, so the weight is the same on any refresh rate.
    lerp: .078,
    smoothWheel: true,
    // Touch is smoothed everywhere now. A phone that fell back to the browser's own scrolling
    // read the pinned chapters as a series of jumps, because the page arrived at a new
    // position between two frames rather than travelling to it. A modest device keeps the
    // smoothing but is given a lighter glide to carry.
    syncTouch: true,
    syncTouchLerp: modestDevice ? .12 : .09,
    touchInertiaMultiplier: modestDevice ? 20 : 28,
    // .72 made one notch cover 72px: a reader crossing the whole story spent about 155 of
    // them. The weight readers feel is the coasting, not the distance per notch, so the notch
    // grew and the smoothing above carries the weight.
    wheelMultiplier: .9,
    touchMultiplier: 1,
  });
  lenis.on("scroll", () => {
    ScrollTrigger.update();
    scheduleRouteUpdate();
  });
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  bindSmoothKeys();
  bindHashLinks();
}

// Lenis owns the wheel and the touch, but not the keyboard: Page Down, Home and the space
// bar were still teleporting the page while every other input glided. They are routed
// through the same scroller so the whole site moves one way.
function bindSmoothKeys() {
  const typing = (element) => element instanceof HTMLElement
    && (element.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName));

  window.addEventListener("keydown", (event) => {
    if (!lenis || lenis.isStopped || event.defaultPrevented) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (typing(document.activeElement)) return;
    // a control inside an open panel scrolls that panel, not the page behind it
    if (document.activeElement?.closest?.("[data-lenis-prevent]")) return;

    const viewport = window.innerHeight;
    const limit = document.documentElement.scrollHeight - viewport;
    const targets = {
      PageDown: window.scrollY + viewport * .86,
      PageUp: window.scrollY - viewport * .86,
      Home: 0,
      End: limit,
      ArrowDown: window.scrollY + viewport * .18,
      ArrowUp: window.scrollY - viewport * .18,
      " ": window.scrollY + viewport * (event.shiftKey ? -.86 : .86),
    };
    const target = targets[event.key];
    if (target === undefined) return;
    event.preventDefault();
    lenis.scrollTo(gsap.utils.clamp(0, limit, target), { duration: event.key === "Home" || event.key === "End" ? 1.4 : .9, easing: TRAVEL_EASE });
  });
}

// in-page anchors — the skip link, and anything else pointing at an id — travel rather than jump
function bindHashLinks() {
  document.addEventListener("click", (event) => {
    const link = event.target.closest?.('a[href^="#"]');
    if (!link || link.classList.contains("js-scene-link")) return;
    const id = link.getAttribute("href").slice(1);
    const target = id && document.getElementById(id);
    if (!target || !lenis) return;
    event.preventDefault();
    lenis.scrollTo(target, { duration: 1.1, easing: TRAVEL_EASE, offset: -20 });
    focusScene(target);
  });
}

// A click is still a journey. The page travels there instead of teleporting, but the
// chapters it passes through play at reduced intensity so nobody sits through a film.
function beginNavigation(index, { quiet = true } = {}) {
  navigating = true;
  navigationTarget = index;
  document.body.classList.toggle("is-navigating", quiet);
  clearTimeout(navigationTimer);
}

function endNavigation() {
  clearTimeout(navigationTimer);
  if (!navigating) return;
  navigating = false;
  document.body.classList.remove("is-navigating");
  // the destination is established: the trail, the scene states and the chapter all settle
  ScrollTrigger.update();
  updatePawJourney();
  if (navigationTarget >= 0) setActiveScene(navigationTarget);
  navigationTarget = -1;
  resolveChapter();
}

// a click that moves the reader also moves focus, so a keyboard or a screen reader arrives
// where the page arrives instead of being left on a control that has scrolled away
function focusScene(section) {
  if (!section) return;
  if (!section.hasAttribute("tabindex")) section.setAttribute("tabindex", "-1");
  section.focus({ preventScroll: true });
}

function scrollToScene(index) {
  const clamped = Math.max(0, Math.min(scenes.length - 1, Number(index)));
  const target = scenes[clamped];
  if (!target) return;
  closePanels({ restoreFocus: false });
  focusScene(target);
  const destination = sceneLandings[clamped] ?? target.getBoundingClientRect().top + window.scrollY;
  const distance = Math.abs(destination - window.scrollY);
  const screens = distance / window.innerHeight;
  // paced by ground covered rather than a flat number: roughly a second per screen, so the
  // travel space between two chapters is actually travelled. Still capped, so crossing the
  // whole story is a journey and not a three-second film.
  const duration = gsap.utils.clamp(1.2, 3, screens * .95);
  // only a long haul plays at reduced intensity; a next-chapter click keeps every step
  beginNavigation(clamped, { quiet: screens > 2.6 });
  if (lenis) {
    lenis.scrollTo(destination, { duration, easing: TRAVEL_EASE, onComplete: endNavigation });
    navigationTimer = setTimeout(endNavigation, duration * 1000 + 400);
  } else {
    window.scrollTo({ top: destination, behavior: prefersReducedMotion ? "auto" : "smooth" });
    navigationTimer = setTimeout(endNavigation, prefersReducedMotion ? 60 : duration * 1000 + 400);
  }
}

// "Follow the paws" promises a walk, not a jump to the next chapter. It travels in two legs:
// first down to where the trail starts, so the reader arrives at the first print rather than
// flying over it, a beat for that print to land, then a slow even walk through the travel
// space that prints every step on the way into the chapter below.
let walkToken = 0;
let walkTimer = 0;
let walkListeners = null;

function firstPawInside(zone) {
  if (!zone || !routeY.length) return null;
  const top = zone.offsetTop;
  const bottom = top + zone.offsetHeight;
  const found = routeY.find((value) => value >= top && value <= bottom);
  return found === undefined ? null : found;
}

// The reader can always take the walk back. A wheel, a touch or an arrow key belongs to
// them, so the journey stands down the moment one arrives instead of fighting for the page.
function releaseWalk() {
  if (!walkListeners) return;
  walkListeners.forEach(([type, handler]) => window.removeEventListener(type, handler));
  walkListeners = null;
}

function cancelWalk() {
  walkToken += 1;
  clearTimeout(walkTimer);
  releaseWalk();
  endNavigation();
}

function guardWalk() {
  releaseWalk();
  const handler = () => cancelWalk();
  walkListeners = [["wheel", handler], ["touchstart", handler], ["keydown", handler]];
  walkListeners.forEach(([type]) => window.addEventListener(type, handler, { passive: true }));
}

function followThePaws(zoneSelector, index) {
  const clamped = Math.max(0, Math.min(scenes.length - 1, Number(index)));
  const scene = scenes[clamped];
  const zone = document.querySelector(zoneSelector);
  const pawY = firstPawInside(zone);
  // without Lenis there is no journey to pace, and reduced motion asked for none
  if (!lenis || prefersReducedMotion || !scene || pawY === null) { scrollToScene(index); return; }

  closePanels({ restoreFocus: false });
  focusScene(scene);
  const viewport = window.innerHeight;
  const storyTop = storyPage.getBoundingClientRect().top + window.scrollY;
  const sceneTop = scene.getBoundingClientRect().top + window.scrollY;
  // the first print lights at 92% of the frame, so stopping with it at 80% means it is
  // already on the ground and low in view — the walk then moves up through the trail
  const trailhead = gsap.utils.clamp(window.scrollY, sceneTop, storyTop + pawY - viewport * .8);
  const approach = gsap.utils.clamp(.7, 1.6, Math.abs(trailhead - window.scrollY) / viewport * .9);
  const walk = gsap.utils.clamp(2.4, 4.6, Math.abs(sceneTop - trailhead) / viewport * 2.2);
  const token = ++walkToken;

  // every step plays: this journey is the paws, so nothing is dimmed on the way
  beginNavigation(clamped, { quiet: false });
  guardWalk();

  const walkThrough = () => {
    if (token !== walkToken) return;
    lenis.scrollTo(sceneTop, {
      duration: walk,
      easing: WALK_EASE,
      onComplete: () => { if (token === walkToken) { releaseWalk(); endNavigation(); } },
    });
    navigationTimer = setTimeout(() => { if (token === walkToken) { releaseWalk(); endNavigation(); } }, walk * 1000 + 400);
  };

  const arrive = () => {
    if (token !== walkToken) return;
    clearTimeout(walkTimer);
    // a held beat at the trailhead: the first print reads before the walk sets off
    walkTimer = setTimeout(walkThrough, 320);
  };

  lenis.scrollTo(trailhead, { duration: approach, easing: TRAVEL_EASE, onComplete: arrive });
  clearTimeout(walkTimer);
  walkTimer = setTimeout(arrive, approach * 1000 + 260);
}

document.querySelectorAll(".js-scene-link").forEach((control) => {
  control.addEventListener("click", (event) => {
    if (control.tagName === "A") event.preventDefault();
    const trail = control.dataset.sceneWalk;
    if (trail) followThePaws(trail, control.dataset.sceneTarget || 0);
    else scrollToScene(control.dataset.sceneTarget || 0);
  });
});

const siteMenu = document.querySelector(".site-menu");
const cartDrawer = document.querySelector(".cart-drawer");
const scrim = document.querySelector(".page-scrim");
const menuButton = document.querySelector(".js-open-menu");

// The panels park off-screen with a CSS translateX(105%), which the browser reports back as
// a pixel matrix — so an xPercent tween has nothing to move and the panel opens out of
// frame. Normalising the resting state in GSAP's own units keeps both drawers sliding.
function restPanel(panel) {
  gsap.set(panel, { x: 0, xPercent: 105, autoAlpha: 0, visibility: "hidden" });
}

[siteMenu, cartDrawer].forEach(restPanel);

// While a drawer is open it is the only thing on the page. Everything else is made inert —
// unfocusable and unclickable — so a keyboard cannot tab away into the story behind it, and
// focus moves into the panel on open and back to whatever opened it on close.
let panelReturnFocus = null;

function setBackgroundInert(open, panel) {
  [...document.body.children].forEach((element) => {
    // the scrim is a close control, so it keeps its clicks; the panels govern themselves
    if (element === panel || element === scrim || element === siteMenu || element === cartDrawer) return;
    if (open) element.setAttribute("inert", "");
    else element.removeAttribute("inert");
  });
}

function focusInsidePanel(panel) {
  const target = panel.querySelector("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])");
  // preventScroll: the panel slides in under its own animation, and letting focus scroll the
  // page would move the story behind it
  target?.focus({ preventScroll: true });
}

function openPanel(panel) {
  const other = panel === siteMenu ? cartDrawer : siteMenu;
  restPanel(other);
  other.setAttribute("aria-hidden", "true");
  other.removeAttribute("inert");
  panelReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  gsap.set(panel, { visibility: "visible" });
  gsap.to(panel, { xPercent: 0, autoAlpha: 1, duration: .5, ease: EASE.art });
  gsap.to(scrim, { autoAlpha: 1, visibility: "visible", duration: .3 });
  panel.setAttribute("aria-hidden", "false");
  menuButton.setAttribute("aria-expanded", panel === siteMenu ? "true" : "false");
  document.body.style.overflow = "hidden";
  setBackgroundInert(true, panel);
  focusInsidePanel(panel);
  lenis?.stop();
}

function closePanels({ restoreFocus = true } = {}) {
  const wasOpen = [siteMenu, cartDrawer].some((panel) => panel.getAttribute("aria-hidden") === "false");
  [siteMenu, cartDrawer].forEach((panel) => {
    gsap.to(panel, { xPercent: 105, autoAlpha: 0, duration: .38, ease: EASE.textOut, onComplete: () => gsap.set(panel, { visibility: "hidden" }) });
    panel.setAttribute("aria-hidden", "true");
  });
  gsap.to(scrim, { autoAlpha: 0, duration: .25, onComplete: () => gsap.set(scrim, { visibility: "hidden" }) });
  menuButton.setAttribute("aria-expanded", "false");
  document.body.style.overflow = "";
  setBackgroundInert(false, null);
  // The background is focusable again before focus goes back to it, or the return lands
  // nowhere. The opener can also have gone away while the panel was open — the header hides
  // itself over the hero and the send-off — so an unfocusable return drops focus to the
  // document rather than leaving it stranded inside a panel that is now closed.
  if (wasOpen && restoreFocus) {
    const openerVisible = panelReturnFocus?.isConnected
      && (panelReturnFocus.checkVisibility?.({ visibilityProperty: true, opacityProperty: true }) ?? true);
    if (openerVisible) panelReturnFocus.focus({ preventScroll: true });
    else if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }
  panelReturnFocus = null;
  lenis?.start();
}

menuButton.addEventListener("click", () => openPanel(siteMenu));
document.querySelectorAll(".js-open-cart").forEach((button) => button.addEventListener("click", () => openPanel(cartDrawer)));
document.querySelectorAll(".js-close-menu, .js-close-cart, .js-close-panels").forEach((button) => {
  // a menu entry that navigates hands focus to where it took the reader, not back to the
  // button that is now behind a closed panel
  const navigates = button.classList.contains("js-scene-link") || button.classList.contains("js-go-shop");
  button.addEventListener("click", () => closePanels({ restoreFocus: !navigates }));
});

const cart = new Map();
const cartItems = document.querySelector(".cart-items");
const cartTotal = document.querySelector(".cart-total b");
const cartCounts = document.querySelectorAll(".cart-count");
const checkout = document.querySelector(".cart-checkout");
const toast = document.querySelector(".toast");
let toastTimer;

function showToast(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  gsap.to(toast, { autoAlpha: 1, y: 0, duration: .28 });
  toastTimer = setTimeout(() => gsap.to(toast, { autoAlpha: 0, y: 18, duration: .28 }), 2200);
}

// The three story products are the same goods the shop sells, so they borrow the shop's
// photography rather than carrying a second copy of it.
const STORY_PHOTOS = { trail: "treats", cloud: "bed", roam: "collar" };
let catalogueRegistered = false;

// the shop's catalogue registers into the same map, keyed by its own ids, the first time the
// shop module arrives — nothing can be in the bag from the shop before that
function registerCatalogue(catalogue) {
  if (catalogueRegistered) return;
  catalogueRegistered = true;
  catalogue.forEach((product) => {
    products[product.id] = products[product.id] || { name: product.name, detail: product.detail, price: product.price, code: product.badge ? "•" : "—", image: product.image };
  });
  Object.entries(STORY_PHOTOS).forEach(([key, base]) => {
    const match = catalogue.find((product) => product.id.startsWith(`${base}-`));
    if (match && products[key]) products[key].image = match.image;
  });
  renderCart();
}

function money(value) {
  return `EGP ${value.toLocaleString("en-US")}`;
}

function renderCart() {
  const entries = [...cart.entries()];
  const quantity = entries.reduce((sum, [, count]) => sum + count, 0);
  const total = entries.reduce((sum, [key, count]) => sum + products[key].price * count, 0);
  cartCounts.forEach((count) => { count.textContent = quantity; });
  // secondary action: the badge answers whatever changed the bag, wherever the click was
  pulseCartCount(quantity);
  cartTotal.textContent = money(total);
  checkout.disabled = quantity === 0;

  if (!entries.length) {
    cartItems.innerHTML = '<p class="cart-empty">Your bag is waiting for an adventure.</p>';
    return;
  }

  cartItems.innerHTML = entries.map(([key, count]) => {
    const product = products[key];
    // the product itself, not a code, so the bag reads as the things in it
    const art = product.image
      ? `<span class="cart-item__icon cart-item__icon--photo"><img src="${product.image}" alt="" width="700" height="700" loading="lazy" decoding="async" /></span>`
      : `<span class="cart-item__icon" aria-hidden="true">${product.code}</span>`;
    // The line carries its own count now. "Remove" used to take one off, which is not what it
    // says, and there was no way at all to ask for a fourth of something without going back
    // to the shop and adding it again. The stepper changes the number, Remove takes the line.
    return `<article class="cart-item">${art}<div><strong>${product.name}</strong><small>${product.detail}</small></div><div class="cart-item__side"><b>${money(product.price * count)}</b><span class="cart-qty" role="group" aria-label="Quantity of ${product.name}"><button type="button" data-qty-step="-1" data-key="${key}" aria-label="One fewer ${product.name}"${count <= 1 ? " disabled" : ""}>−</button><span>${count}</span><button type="button" data-qty-step="1" data-key="${key}" aria-label="One more ${product.name}"${count >= CART_MAX ? " disabled" : ""}>+</button></span><button class="cart-drop" type="button" data-remove="${key}" aria-label="Remove ${product.name} from your bag">Remove</button></div></article>`;
  }).join("");

  // the checkout reads the same bag, so a count changed in the drawer over an open checkout
  // does not leave a summary of what the bag used to hold
  if (checkoutBuilt) checkoutModule?.renderCheckout();
}

// no stock behind this shop, so the ceiling is only there to keep a held-down key from
// running the count into figures nobody means
const CART_MAX = 99;

function setCartCount(key, next) {
  const count = Math.max(0, Math.min(CART_MAX, next));
  if (count) cart.set(key, count);
  else cart.delete(key);
  renderCart();
  return count;
}

// One listener for a list that is rebuilt on every change. It also puts the focus back on the
// control that was pressed, because the button the reader is holding is destroyed by the
// re-render and the focus would otherwise fall to the top of the page mid-decision.
cartItems.addEventListener("click", (event) => {
  const step = event.target.closest("[data-qty-step]");
  if (step) {
    const key = step.dataset.key;
    const direction = step.dataset.qtyStep;
    const count = setCartCount(key, (cart.get(key) || 0) + Number(direction));
    if (!count) return;
    const same = cartItems.querySelector(`[data-qty-step="${direction}"][data-key="${CSS.escape(key)}"]`);
    const fallback = cartItems.querySelector(`[data-key="${CSS.escape(key)}"]:not([disabled])`);
    (same && !same.disabled ? same : fallback)?.focus();
    return;
  }
  const remove = event.target.closest("[data-remove]");
  if (remove) setCartCount(remove.dataset.remove, 0);
});

document.querySelectorAll(".js-add-product").forEach((button) => button.addEventListener("click", () => {
  const key = button.dataset.product;
  cart.set(key, (cart.get(key) || 0) + 1);
  renderCart();
  showToast(`${products[key].name} joined the trail`);
  gsap.fromTo(button, { scale: .98 }, { scale: 1, duration: .38, ease: EASE.art });
}));
// the button also carries .js-go-checkout, which routes it — a second listener here
// fired the transition twice and left the view mid-swap for over two seconds

const vetDialog = document.querySelector(".vet-dialog");
const vetForm = document.querySelector(".vet-form");
const vetSuccess = document.querySelector(".vet-success");

// --- the booking calendar ----------------------------------------------------------------
// The three chips cover the next few days; anything further is chosen from a calendar built
// in the site's own vocabulary rather than the browser's picker, which cannot be styled.
const calendarRoot = document.querySelector("#vet-calendar");
const calendarToggle = document.querySelector(".js-open-calendar");
const customDateInput = document.querySelector("[data-custom-date]");
const customDateFace = document.querySelector(".date-option--pick b");
let calendar = null;
let chosenDate = null;

function setCalendarOpen(open) {
  if (!calendarRoot) return;
  calendarToggle.setAttribute("aria-expanded", String(open));
  if (!open) {
    gsap.to(calendarRoot, { autoAlpha: 0, y: -6, duration: .22, ease: EASE.textOut, onComplete: () => { calendarRoot.hidden = true; } });
    return;
  }
  if (!calendar) calendar = buildCalendar(calendarRoot, { onSelect: chooseDate });
  calendar.show(chosenDate);
  calendarRoot.hidden = false;
  gsap.fromTo(calendarRoot, { autoAlpha: 0, y: -8 }, { autoAlpha: 1, y: 0, duration: .3, ease: EASE.art });
  calendar.focusFirst();
}

// the chosen day becomes the fourth chip's face and the radio's value, so the form still
// submits one date whichever way it was picked
function chooseDate(date) {
  chosenDate = date;
  customDateInput.value = formatDate(date);
  customDateInput.checked = true;
  customDateFace.textContent = shortDate(date);
  setCalendarOpen(false);
  calendarToggle.focus();
}

// The three quick chips are the next three days, counted from whenever the page is open.
// Typed-in dates would be a lie the moment they passed — and a clinic that appears to have
// the same three days free forever is not a clinic anybody believes.
const quickDateLabels = document.querySelectorAll(".date-options label:not(.date-option--pick)");

function fillQuickDates() {
  const today = new Date();
  quickDateLabels.forEach((label, index) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + index + 1);
    const [weekday, day] = shortDate(date).split(" ");
    const input = label.querySelector("input");
    const face = label.querySelector("span");
    input.value = formatDate(date);
    face.textContent = `${weekday} `;
    const number = document.createElement("b");
    number.textContent = day;
    face.append(number);
  });
}

fillQuickDates();

calendarToggle?.addEventListener("click", () => setCalendarOpen(calendarToggle.getAttribute("aria-expanded") !== "true"));
// the fourth chip is the calendar: picking it with no date yet opens the month
customDateInput?.addEventListener("click", () => { if (!customDateInput.value) setCalendarOpen(true); });

function openVetDialog() {
  closePanels();
  fillQuickDates();
  vetForm.hidden = false;
  vetSuccess.hidden = true;
  // a fresh booking starts on the quick chips, with the month put away
  if (calendarRoot && !calendarRoot.hidden) { calendarRoot.hidden = true; calendarToggle.setAttribute("aria-expanded", "false"); }
  if (!vetDialog.open) vetDialog.showModal();
  lenis?.stop();
  gsap.fromTo(vetDialog, { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: .42, ease: EASE.art });
}

function closeVetDialog() {
  vetDialog.close();
  lenis?.start();
}

document.querySelectorAll(".js-open-vet").forEach((button) => button.addEventListener("click", openVetDialog));
document.querySelector(".js-close-vet").addEventListener("click", closeVetDialog);
vetDialog.addEventListener("click", (event) => {
  if (event.target !== vetDialog) return;
  const bounds = vetDialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeVetDialog();
});
vetForm.addEventListener("submit", (event) => {
  event.preventDefault();
  vetForm.hidden = true;
  vetSuccess.hidden = false;
  gsap.fromTo(vetSuccess, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: .4 });
});

// --- privacy and terms --------------------------------------------------------------------
// One dialog holding two articles. Reading a policy is not leaving the story, so nothing
// routes and nothing scrolls: the page underneath keeps its position, its chapter and its
// trail, and closing the dialog puts the reader back exactly where they were standing.
const policyDialog = document.querySelector(".policy-dialog");
const policyTitle = document.querySelector("#policy-title");
const policyBody = document.querySelector(".policy-body");
let policyOpener = null;

function openPolicy(kind, opener) {
  if (!policyDialog) return;
  let shown = null;
  policyDialog.querySelectorAll("[data-policy]").forEach((article) => {
    const live = article.dataset.policy === kind;
    article.hidden = !live;
    if (live) shown = article;
  });
  if (!shown) return;
  policyTitle.textContent = shown.dataset.title;
  policyOpener = opener || null;
  closePanels({ restoreFocus: false });
  if (vetDialog.open) vetDialog.close();
  gsap.killTweensOf(policyDialog);
  if (!policyDialog.open) policyDialog.showModal();
  // a second policy opened from the first starts at the top of its own text
  policyBody.scrollTop = 0;
  lenis?.stop();
  gsap.fromTo(policyDialog, { autoAlpha: 0, y: 20, scale: .98 }, { autoAlpha: 1, y: 0, scale: 1, duration: .44, ease: EASE.art });
}

function closePolicy() {
  if (!policyDialog?.open) return;
  const opener = policyOpener;
  policyOpener = null;
  gsap.killTweensOf(policyDialog);
  gsap.to(policyDialog, {
    autoAlpha: 0,
    y: 14,
    scale: .985,
    duration: .3,
    ease: EASE.textOut,
    onComplete: () => {
      policyDialog.close();
      gsap.set(policyDialog, { clearProps: "opacity,visibility,transform" });
      lenis?.start();
      // Back to the link that opened it — unless the page has moved on and that link is no
      // longer something a reader could reach, in which case focus goes to the brand mark
      // rather than being dropped on the body.
      const reachable = opener?.isConnected
        && (opener.checkVisibility?.({ visibilityProperty: true, opacityProperty: true }) ?? true);
      (reachable ? opener : document.querySelector(".site-header .brand"))?.focus({ preventScroll: true });
    },
  });
}

// The footer links keep their href, so they are still real links to share and to crawl —
// an ordinary click reads the policy here instead of loading a page.
document.addEventListener("click", (event) => {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const link = event.target.closest('a[href="/privacy"], a[href="/terms"]');
  if (!link) return;
  event.preventDefault();
  openPolicy(link.getAttribute("href").slice(1), link);
});

document.querySelector(".js-close-policy")?.addEventListener("click", () => closePolicy());
// Escape reaches the dialog as a cancel: taking it over keeps the closing animation
policyDialog?.addEventListener("cancel", (event) => { event.preventDefault(); closePolicy(); });
policyDialog?.addEventListener("click", (event) => {
  // a click on the dialog itself is a click on the backdrop; anything inside is content
  if (event.target === policyDialog) closePolicy();
});

window.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (policyDialog?.open) closePolicy();
  else if (vetDialog.open) closeVetDialog();
  else closePanels();
});

function setRouteGuideVisible(visible = true) {
  routeGuideVisible = visible;
  activePaw = -2;
  updatePawJourney();
}

// The opening runs the same hierarchy as every chapter — world, illustration, then the
// story speaks — only in seconds instead of scroll. Building it paused puts every layer in
// its starting state behind the loader, so nothing flashes when the loader lifts.
function prepareHeroIntro() {
  const intro = gsap.timeline({
    paused: true,
    defaults: { ease: EASE.art },
    onComplete: () => {
      activePaw = -2;
      updatePawJourney();
      buildSceneMotion();
      resolveChapter();
      ScrollTrigger.refresh();
    },
  });

  intro.call(() => setRouteGuideVisible(true), null, 0);
  revealEnv(intro, "#scene-love .hero-atmosphere", .3, { t: TIME, stagger: .12 });
  revealEnv(intro, "#scene-love .hero-environment", .4, { t: TIME, stagger: .1 });
  revealArt(intro, "#scene-love .hero-ground", .62, { t: TIME, y: 18 });
  revealArt(intro, "#scene-love .scene-character--hero", .82, { t: TIME, y: 24 });
  revealEyebrow(intro, "#scene-love .scene-copy--hero .scene-kicker", 1.2, { t: TIME });
  revealHeadline(intro, "#love-title .line-mask > span", 1.36, { t: TIME });
  revealBody(intro, "#scene-love .scene-copy--hero .scene-intro", 2.1, { t: TIME });
  revealCTA(intro, "#scene-love .scene-copy--hero .button", 2.34, { t: TIME });
  intro.to({}, { duration: .3 });

  routePaws.slice(0, HERO_PAW_COUNT).forEach((paw) => paw.classList.remove("is-past", "is-current"));
  routeLines.forEach((segment) => segment.line.classList.remove("is-guide", "is-past"));
  heroIntro = intro;
}

// the opening cut short: its last frame is rendered at once, which is also what hands the
// chapter timelines their cue to build
function finishHeroIntro() {
  const intro = heroIntro;
  heroIntro = null;
  intro.progress(1);
  buildSceneMotion();
}

// a refresh halfway down the page skips the opening entirely: chapter one is behind the
// user, so its choreography has nothing to say and would only hold the story hostage
function skipHeroIntro() {
  heroIntro?.kill();
  heroIntro = null;
  gsap.set("#scene-love .hero-atmosphere, #scene-love .hero-environment, #scene-love .hero-ground, #scene-love .scene-character--hero", { clearProps: "all" });
  gsap.set("#scene-love .scene-copy--hero .scene-kicker, #love-title .line-mask > span, #love-title em, #scene-love .scene-copy--hero .scene-intro, #scene-love .scene-copy--hero .button", { clearProps: "all" });
  setRouteGuideVisible(true);
  setChromeVisibility(true, true);
  buildSceneMotion();
  resolveChapter();
  ScrollTrigger.refresh();
}

// The loader's progress is the same walk the page is about to take: prints placed along a
// curve, lit in order as loading advances. Positions come from the drawn path itself rather
// than being typed out, so the curve can be reshaped in the markup and the prints follow.
const LOADER_STEPS = 13;
let loaderPaws = [];
let loaderLit = -1;

function buildLoaderTrail() {
  const trail = document.querySelector(".loader-trail");
  const line = trail?.querySelector(".loader-line");
  const holder = trail?.querySelector(".loader-paws");
  if (!trail || !line || !holder) return;

  // The curve is written against the real viewport rather than a fixed viewBox: it has to
  // reach the bottom-left and top-right corners of whatever screen it lands on, and a
  // stretched viewBox would skew both the curve and the angle every print sits at.
  const width = window.innerWidth;
  const height = window.innerHeight;
  const svg = line.ownerSVGElement;
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("preserveAspectRatio", "none");

  const x = (ratio) => width * ratio;
  const y = (ratio) => height * ratio;
  // one long S: out of the bottom-left corner, across the middle, up into the top-right
  line.setAttribute("d", [
    `M ${x(.06)} ${y(.9)}`,
    `C ${x(.26)} ${y(.95)}, ${x(.29)} ${y(.6)}, ${x(.5)} ${y(.52)}`,
    `C ${x(.71)} ${y(.44)}, ${x(.74)} ${y(.14)}, ${x(.94)} ${y(.1)}`,
  ].join(" "));

  const length = line.getTotalLength();
  for (let step = 0; step <= LOADER_STEPS; step += 1) {
    const distance = length * (step / LOADER_STEPS);
    const point = line.getPointAtLength(distance);
    const before = line.getPointAtLength(Math.max(0, distance - 6));
    const after = line.getPointAtLength(Math.min(length, distance + 6));
    const heading = Math.atan2(after.y - before.y, after.x - before.x) * 180 / Math.PI;
    // left and right of the line in turn, so it reads as a walk rather than a dotted line
    const side = step % 2 === 0 ? -1 : 1;
    const offset = 11 * side;
    const normal = (heading + 90) * Math.PI / 180;

    const paw = document.createElement("span");
    paw.className = "loader-paw";
    paw.innerHTML = pawMarkup();
    paw.style.left = `${(point.x + Math.cos(normal) * offset) / width * 100}%`;
    paw.style.top = `${(point.y + Math.sin(normal) * offset) / height * 100}%`;
    // every print faces the corner the walk is heading for, rather than turning with each
    // bend in the curve: one animal crossing the screen, not a rotating dotted line
    paw.style.setProperty("--paw-rotate", "45deg");
    holder.append(paw);
  }
  loaderPaws = [...holder.children];
  setLoaderProgress(0);
}

function setLoaderProgress(progress) {
  const count = document.querySelector(".loader-count");
  const value = gsap.utils.clamp(0, 1, progress);
  if (count) count.textContent = String(Math.round(value * 100)).padStart(2, "0");
  if (!loaderPaws.length) return;
  // the print the walk has just reached, so nothing lights before it is stepped on
  const reached = Math.min(loaderPaws.length - 1, Math.floor(value * loaderPaws.length));
  if (reached === loaderLit) return;
  loaderLit = reached;
  loaderPaws.forEach((paw, index) => {
    paw.classList.toggle("is-past", index < reached);
    paw.classList.toggle("is-current", index === reached && value > 0);
  });
}

// placed here rather than at the top of the file: the constants above are in the temporal
// dead zone until this point, and calling earlier throws before a single print is drawn
buildLoaderTrail();

function finishLoader(onComplete) {
  const lift = () => {
    document.querySelector(".loader")?.remove();
    onComplete?.();
  };

  // nobody who asked for less motion wants to watch a walk: the trail is shown finished and
  // the loader steps aside
  if (prefersReducedMotion) {
    setLoaderProgress(1);
    gsap.to(".loader", { autoAlpha: 0, duration: .2, delay: .1, onComplete: lift });
    return;
  }

  const counter = { value: 0 };
  // The walk is the point, so it is given the room to read: the trail fades up, fourteen
  // prints land over two and a half seconds — roughly a step every 180ms, a walking pace
  // rather than a flicker — the finished trail holds for a beat, and only then does the
  // loader lift.
  gsap.timeline()
    .fromTo(".loader-trail", { autoAlpha: 0 }, { autoAlpha: 1, duration: .55, ease: "power2.out" }, 0)
    .fromTo(".loader-brand, .loader-status, .loader-count", { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: .5, stagger: .06, ease: "power2.out" }, .12)
    .to(counter, { value: 1, duration: 2.5, ease: "power1.inOut", onUpdate: () => setLoaderProgress(counter.value) }, .3)
    .to(".loader", { yPercent: -100, duration: .8, ease: "power3.inOut", onComplete: lift }, "+=.45");
}

// A chapter's timeline is written in viewport-heights of scroll, so a genuine resize cannot
// be answered by refreshing measurements — the timelines are rebuilt against the new screen.
function refreshLayout({ remeasureMotion = false } = {}) {
  if (remeasureMotion && sceneMotionBuilt) {
    killSceneMotion();
    sceneTimelines = [];
    sceneLandings = [];
    sceneMotionBuilt = false;
    buildSceneMotion();
  }
  buildGlobalPawJourney();
  resolveChapter();
  ScrollTrigger.refresh();
}


// ============================================================================
// ROUTER — the story and the shop are two views in one document. Navigating
// between them never reloads: the outgoing view releases, a cream wipe carries
// the paw across, and the incoming view arrives with its own reveal. Scroll
// position is remembered per view, and ScrollTrigger is rebuilt on the way back
// because its measurements are meaningless while the story is display:none.
// ============================================================================
const storyView = document.querySelector(".story-page");
const shopView = document.querySelector("#shop-view");
const checkoutView = document.querySelector("#checkout-view");
const VIEWS = { story: storyView, shop: shopView, checkout: checkoutView };
const PATHS = { story: "/", shop: "/shop", checkout: "/checkout" };
// One document serves three routes, so title, description and canonical have to follow the
// route. Without this a crawler and a shared link both see the story's metadata on the shop
// and the checkout.
const META = {
  story: {
    title: "PAWTOPIA — Better care for the pets you love",
    description: "Pawtopia brings thoughtful pet essentials and gentle veterinary care together in one illustrated journey.",
  },
  shop: {
    title: "Shop Pawtopia — Food, care and everyday pet essentials",
    description: "Premium food, grooming, toys and accessories for dogs and cats, delivered across Egypt.",
  },
  checkout: {
    title: "Checkout — Pawtopia",
    description: "Complete your Pawtopia order: delivery details, payment on delivery, and a clear total.",
  },
};

function applyRouteMeta(name) {
  const meta = META[name] || META.story;
  document.title = meta.title;
  const set = (selector, attribute, value) => {
    const element = document.querySelector(selector);
    if (element) element.setAttribute(attribute, value);
  };
  set('meta[name="description"]', "content", meta.description);
  set('meta[property="og:title"]', "content", meta.title);
  set('meta[property="og:description"]', "content", meta.description);
  set('meta[property="og:url"]', "content", `${location.origin}${PATHS[name] || "/"}`);
  // absolute: crawlers do not resolve a relative image against the page they scraped
  set('meta[property="og:image"]', "content", `${location.origin}/pawtopia-share.jpg`);
  set('meta[name="twitter:image"]', "content", `${location.origin}/pawtopia-share.jpg`);
  set('link[rel="canonical"]', "href", `${location.origin}${PATHS[name] || "/"}`);
}
const wipe = (() => {
  const element = document.createElement("div");
  element.className = "view-wipe";
  element.setAttribute("aria-hidden", "true");
  element.innerHTML = `<span class="paw-mark">${pawMarkup()}</span>`;
  document.body.append(element);
  return element;
})();

let routeBusy = false;
let routeTimer = 0;
// a chapter chosen from another route, which outranks the scroll position we left behind
let pendingScene = -1;
let pendingRoute = null;
let storyScroll = 0;
let shopBuilt = false;
let checkoutBuilt = false;

function setRoute(next, { push = true, immediate = false } = {}) {
  // A navigation that lands mid-transition used to be dropped on the floor — the back
  // button would change the URL and nothing else. It waits its turn instead.
  if (routeBusy) { pendingRoute = { next, push, immediate }; return; }
  if (next === route) return;
  routeBusy = true;
  // The arriving route's code may still be in flight. The flag above is already set, so a
  // second click queues rather than racing, and the wipe does not start over a view that
  // cannot be built yet. A chunk that never arrives releases the flag instead of wedging
  // every later navigation behind it.
  routeModule(next)
    .then(() => startRoute(next, { push, immediate }))
    .catch(() => { routeBusy = false; pendingRoute = null; });
}

function startRoute(next, { push, immediate }) {
  // The wipe normally releases the flag when it completes. A timeline that never finishes —
  // a tab throttled to a stop mid-transition, say — would otherwise leave routing wedged
  // for the rest of the session, so the state is settled either way.
  clearTimeout(routeTimer);
  routeTimer = setTimeout(() => {
    if (!routeBusy) return;
    Object.entries(VIEWS).forEach(([name, element]) => { if (element) element.hidden = name !== next; });
    gsap.set([VIEWS[next], wipe].filter(Boolean), { clearProps: "opacity,visibility,transform" });
    gsap.set(wipe, { autoAlpha: 0, visibility: "hidden" });
    route = next;
    applyRouteMeta(next);
    routeBusy = false;
    const queued = pendingRoute;
    pendingRoute = null;
    if (queued) setRoute(queued.next, { push: queued.push, immediate: queued.immediate });
  }, 3200);

  // the route link itself is about to be hidden, so focus goes to the arriving view below
  closePanels({ restoreFocus: false });

  const leavingStory = route === "story";
  if (leavingStory) storyScroll = window.scrollY;
  if (push) history.pushState({ route: next }, "", PATHS[next]);

  const swap = () => {
    Object.entries(VIEWS).forEach(([name, element]) => { if (element) element.hidden = name !== next; });
    document.body.classList.toggle("is-shop", next !== "story");
    applyRouteMeta(next);
    setChromeVisibility(true, true);

    if (next === "shop" && !shopBuilt) { shopModule.buildShop({ onAdd: addShopProduct }); shopBuilt = true; }
    if (next === "checkout") {
      if (!checkoutBuilt) { checkoutModule.buildCheckout({ getCart: cartLines, onPlaced: emptyCart }); checkoutBuilt = true; }
      else { checkoutModule.resetCheckout(); checkoutModule.renderCheckout(); }
    }
    if (next !== "shop") shopModule?.resetShopMotion();
    // an order that has been read is finished with: leaving takes its confirmation with it
    if (next !== "checkout") checkoutModule?.resetCheckout();

    route = next;
    // a hidden view measures as zero, so every trigger is re-measured after the swap
    let target = next === "story" ? storyScroll : 0;
    if (next === "story" && pendingScene >= 0) {
      target = scenes[pendingScene]?.offsetTop ?? storyScroll;
      setActiveScene(pendingScene);
    }
    pendingScene = -1;
    lenis?.scrollTo(target, { immediate: true });
    window.scrollTo(0, target);
    ScrollTrigger.refresh();
    if (next === "story") { updatePawJourney(); resolveChapter(); }
  };

  const release = () => {
    clearTimeout(routeTimer);
    if (!routeBusy) return;
    routeBusy = false;
    // The swap measures while the arriving view is still held at opacity 0 behind the wipe.
    // Scrubbed timelines refreshed in that state sit at progress 0 — which is their hidden
    // state — and nothing moves the scroll afterwards to wake them, so a reader returning to
    // the story found the chapter they left standing empty. Measuring again now that the
    // view is really on screen puts every timeline back where the scroll position says.
    if (route === "story") {
      // Rebuilt, not merely refreshed. While the story was hidden its sections measured as
      // nothing, so every scrubbed timeline was scrubbed to its end against a zero-height
      // page, and the chapter the reader had been looking at was left parked in its exit
      // state — faded out, or gone. The inline values that scrub left behind are wiped
      // first, because a rebuilt timeline only writes the properties it animates and
      // anything else would keep the stale value. Then the scenes are rebuilt against the
      // visible layout and set from the real scroll position.
      gsap.set(storyPage.querySelectorAll("[style]"), { clearProps: "opacity,visibility,transform" });
      refreshLayout({ remeasureMotion: true });
      ScrollTrigger.update();
    }
    // A route change replaces the page under a screen reader without a load event, so focus
    // moves to the arriving view and it reads its own heading. It waits for the wipe to
    // finish: the incoming view is held at visibility hidden while it plays, and a hidden
    // element cannot hold focus — the browser hands it straight back to the document.
    focusScene(VIEWS[route]);
    const queued = pendingRoute;
    pendingRoute = null;
    if (queued) setRoute(queued.next, { push: queued.push, immediate: queued.immediate });
  };

  if (immediate || prefersReducedMotion) {
    swap();
    gsap.set(wipe, { autoAlpha: 0, visibility: "hidden" });
    release();
    return;
  }

  const outgoing = VIEWS[route];
  const incoming = VIEWS[next];
  gsap.timeline({ onComplete: release })
    // the view releases first, the way a chapter lets go before the paws take over
    .to(outgoing, { autoAlpha: 0, y: -18, duration: .38, ease: EASE.textOut }, 0)
    .set(wipe, { visibility: "visible" }, 0)
    .fromTo(wipe, { autoAlpha: 0 }, { autoAlpha: 1, duration: .34, ease: EASE.env }, .1)
    .fromTo(wipe.querySelector(".paw-mark"), { autoAlpha: 0, scale: .7, y: 14 }, { autoAlpha: 1, scale: 1, y: 0, duration: .3, ease: EASE.art }, .18)
    .call(swap, null, .5)
    .to(wipe.querySelector(".paw-mark"), { autoAlpha: 0, scale: 1.25, duration: .28, ease: EASE.art }, .58)
    .to(wipe, { autoAlpha: 0, duration: .4, ease: EASE.env }, .62)
    .set(wipe, { visibility: "hidden" })
    .fromTo(incoming, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: .5, ease: EASE.art }, .66)
    .add(() => {
      if (next === "shop") shopModule?.buildShopMotion();
      if (next === "checkout") checkoutModule?.buildCheckoutMotion();
    }, .68);
}

// the shop's pagination needs the smooth scroller when one is running
window.__pawtopiaScrollTo = (top) => {
  if (lenis) lenis.scrollTo(top, { duration: 1 });
  else window.scrollTo({ top, behavior: prefersReducedMotion ? "auto" : "smooth" });
};

function cartLines() {
  return [...cart.entries()].map(([key, count]) => ({ ...products[key], count }));
}

function emptyCart() {
  cart.clear();
  renderCart();
}

function addShopProduct(id) {
  const product = shopModule?.CATALOGUE.find((entry) => entry.id === id);
  if (!product) return;
  cart.set(id, (cart.get(id) || 0) + 1);
  renderCart();
  showToast(`${product.name} joined the trail`);
}

document.querySelectorAll(".js-go-shop").forEach((control) => control.addEventListener("click", (event) => {
  event.preventDefault();
  setRoute("shop");
}));

// Delegated, because the order confirmation is built when an order is placed rather than
// written into the page — a listener bound at boot would never reach its button.
document.addEventListener("click", (event) => {
  const control = event.target.closest(".js-go-story");
  if (!control) return;
  event.preventDefault();
  setRoute("story");
});

document.querySelectorAll(".js-go-checkout").forEach((control) => control.addEventListener("click", (event) => {
  event.preventDefault();
  setRoute("checkout");
}));

// The brand mark and the chapter links belong to the story, so they carry the reader back —
// and they carry their destination with them. Returning used to restore whatever scroll
// position the reader left from, so pressing the logo on the shop dropped them back into
// chapter two instead of the top of the journey.
document.querySelectorAll(".js-scene-link").forEach((control) => control.addEventListener("click", () => {
  if (route === "story") return;
  pendingScene = Math.max(0, Math.min(scenes.length - 1, Number(control.dataset.sceneTarget || 0)));
  setRoute("story");
}));

window.addEventListener("popstate", (event) => {
  const next = event.state?.route || (location.pathname.startsWith("/shop") ? "shop" : location.pathname.startsWith("/checkout") ? "checkout" : "story");
  setRoute(next, { push: false });
});

// /privacy and /terms are not pages — the router has nothing to serve there, so a shared or
// typed link used to land on the story with no policy in sight. It opens the policy instead,
// over chapter one, and puts the address back to the story it is standing on.
function pendingPolicy() {
  const path = location.pathname.replace(/\/+$/, "").toLowerCase();
  if (path !== "/privacy" && path !== "/terms") return null;
  history.replaceState({ route: "story" }, "", "/");
  return path.slice(1);
}

function initialize() {
  const deepPolicy = pendingPolicy();
  setupSmoothScroll();
  buildMicroInteractions();
  applyRouteMeta(location.pathname.startsWith("/shop") ? "shop" : location.pathname.startsWith("/checkout") ? "checkout" : "story");
  const booted = location.pathname.startsWith("/shop") ? "shop" : location.pathname.startsWith("/checkout") ? "checkout" : null;
  if (booted) {
    // a deep link has to wait for the route's code before it can build or animate the view
    routeModule(booted).then(() => {
      setRoute(booted, { push: false, immediate: true });
      if (booted === "shop") shopModule?.buildShopMotion(); else checkoutModule?.buildCheckoutMotion();
    });
  }
  // the hero headline and the send-off get the same masked lines every other headline uses
  maskLines(document.querySelector("#love-title"));
  maskLines(document.querySelector(".footer-headline"));
  maskLines(document.querySelector(".interlude-quote p"));
  // the headings whose lines are written as masks in the markup get the same treatment, so
  // every heading on the page is still one readable sentence to a screen reader
  spaceLines();
  // the loop starts on its first stage, so the other three headlines are hidden from the
  // screen reader before the section is ever reached
  setLoopStage(0);
  buildGlobalPawJourney();
  const deepLoad = window.scrollY > window.innerHeight * .5;

  if (prefersReducedMotion) {
    setRouteGuideVisible(true);
    setChromeVisibility(true, true);
    buildReducedMotion();
  } else if (deepLoad) {
    skipHeroIntro();
  } else {
    prepareHeroIntro();
    setChromeVisibility(false, true);
  }

  resolveChapter();
  updatePawJourney();
  ScrollTrigger.refresh();
  finishLoader(() => {
    // the policy waits for the loader rather than opening behind it
    if (deepPolicy) openPolicy(deepPolicy);
    heroIntro?.play();
    // late art and late fonts both change the page height the trail was measured against
    ScrollTrigger.refresh();
  });

  document.fonts?.ready.then(() => refreshLayout());

  // The shop and checkout chunks are fetched once the story is on screen and the main thread
  // is free, so a click on Shop opens with the code already in cache while the first paint
  // never had to wait for it.
  const warm = () => routeModule("checkout");
  if (route === "story") (window.requestIdleCallback || ((run) => setTimeout(run, 1800)))(warm, { timeout: 4000 });
}

window.addEventListener("scroll", scheduleRouteUpdate, { passive: true });

// Mobile browsers resize by tens of pixels whenever their chrome hides; rebuilding the walk
// there would jump the trail mid-scroll. Only a real layout change earns a rebuild.
function handleViewportChange() {
  clearTimeout(window.__pawtopiaResize);
  window.__pawtopiaResize = setTimeout(() => {
    const widthChanged = window.innerWidth !== viewportWidth;
    const heightDelta = Math.abs(window.innerHeight - viewportHeight);
    if (!widthChanged && heightDelta < 120) { ScrollTrigger.refresh(); return; }
    viewportWidth = window.innerWidth;
    viewportHeight = window.innerHeight;
    refreshLayout({ remeasureMotion: true });
  }, 180);
}

window.addEventListener("resize", handleViewportChange);
window.addEventListener("orientationchange", handleViewportChange);
window.addEventListener("pageshow", (event) => { if (event.persisted) refreshLayout(); });
window.addEventListener("pagehide", () => {
  cancelAnimationFrame(routeFrame);
  clearTimeout(navigationTimer);
  ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
  lenis?.destroy();
});

renderCart();
if (document.readyState === "complete") initialize();
else window.addEventListener("load", initialize, { once: true });
