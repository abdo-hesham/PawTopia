import gsap from "gsap";
import { EASE } from "./motion.js";

// Micro-interactions that need state rather than a hover rule: a badge that reacts to a
// number changing, a button that confirms it did something, and the slight magnetic pull
// the primary calls to action have under a real cursor.

const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

// --- the cart badge answers the bag ------------------------------------------------------
let lastCount = null;

export function pulseCartCount(count) {
  const badges = document.querySelectorAll(".cart-count");
  if (lastCount === null) { lastCount = count; return; }
  if (count === lastCount) return;
  lastCount = count;
  if (reducedMotion.matches) return;
  badges.forEach((badge) => {
    badge.classList.add("is-bumped");
    setTimeout(() => badge.classList.remove("is-bumped"), 220);
  });
}

// --- the add button confirms, then goes back to being a button ---------------------------
export function confirmAdd(button) {
  if (!button) return;
  button.classList.add("is-added");
  setTimeout(() => button.classList.remove("is-added"), 900);
}

// Magnetic pull: the button leans toward the cursor while it is close, and lets go the
// moment it leaves. Written to `translate` so it composes with the reveal timelines that
// own `transform`, and only ever on a fine pointer — on touch there is nothing to lean
// toward, and the leftover offset would strand the button off its mark.
const MAGNET_RADIUS = 90;
const MAGNET_PULL = .28;

function bindMagnet(element) {
  let frame = 0;
  let pointer = null;

  const release = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    pointer = null;
    element.classList.remove("is-pulling");
    element.style.translate = "";
  };

  const apply = () => {
    frame = 0;
    if (!pointer) return;
    const box = element.getBoundingClientRect();
    const dx = pointer.x - (box.left + box.width / 2);
    const dy = pointer.y - (box.top + box.height / 2);
    const distance = Math.hypot(dx, dy);
    const reach = Math.max(box.width, box.height) / 2 + MAGNET_RADIUS;
    if (distance > reach) { release(); return; }
    const falloff = 1 - distance / reach;
    element.style.translate = `${dx * MAGNET_PULL * falloff}px ${dy * MAGNET_PULL * falloff}px`;
  };

  element.addEventListener("pointermove", (event) => {
    if (event.pointerType !== "mouse") return;
    pointer = { x: event.clientX, y: event.clientY };
    element.classList.add("is-pulling");
    if (!frame) frame = requestAnimationFrame(apply);
  });
  element.addEventListener("pointerleave", release);
  element.addEventListener("pointerdown", release);
}

function bindMagnets() {
  if (!finePointer.matches || reducedMotion.matches) return;
  document.querySelectorAll(".button--coral, .js-go-shop.button, .checkout-place").forEach((element) => {
    if (element.dataset.magnet) return;
    element.dataset.magnet = "on";
    element.classList.add("is-magnetic");
    bindMagnet(element);
  });
}

// --- the filter ticks are drawn, so the native box steps aside ---------------------------
export function decorateFilterTicks(root = document) {
  root.querySelectorAll(".filter-group input[type=checkbox]").forEach((input) => {
    if (input.nextElementSibling?.classList.contains("filter-tick")) return;
    const tick = document.createElement("i");
    tick.className = "filter-tick";
    tick.setAttribute("aria-hidden", "true");
    tick.innerHTML = '<svg viewBox="0 0 24 24" focusable="false"><path d="M5 12.5 10 17.5 19 7.5" /></svg>';
    input.after(tick);
  });
}

// --- the paw prints answer a click on the chapter rail -----------------------------------
function bindChapterFeedback() {
  document.querySelectorAll(".scene-progress button").forEach((button) => {
    button.addEventListener("click", () => {
      if (reducedMotion.matches) return;
      const dot = button.querySelector("i");
      gsap.fromTo(dot, { scale: .6 }, { scale: 1.45, duration: .34, ease: EASE.art, overwrite: true });
    });
  });
}

export function buildMicroInteractions() {
  decorateFilterTicks();
  bindMagnets();
  bindChapterFeedback();
  // the shop builds its filters after the first visit, so the ticks are decorated again
  document.addEventListener("pawtopia:shop-ready", () => decorateFilterTicks());
  finePointer.addEventListener?.("change", bindMagnets);
}
