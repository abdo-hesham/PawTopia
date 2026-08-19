import gsap from "gsap";
import { EASE, registerTimeline } from "./motion.js";

// The checkout reads the same bag the drawer does. It owns no cart state of its own — it is
// a view over `cart`, so anything added in the story, the shop or the drawer arrives here.
const FREE_DELIVERY_OVER = 900;

let readCart = () => [];
let onOrderPlaced = () => {};
let view = null;

function money(value) {
  return `EGP ${value.toLocaleString("en-US")}`;
}

function deliveryFee(subtotal) {
  const express = view.querySelector('input[name="delivery"]:checked')?.value === "express";
  if (express) return 70;
  return subtotal >= FREE_DELIVERY_OVER || subtotal === 0 ? 0 : 45;
}

export function renderCheckout() {
  if (!view) return;
  const lines = readCart();
  const items = view.querySelector(".checkout-items");
  const subtotal = lines.reduce((sum, line) => sum + line.price * line.count, 0);

  items.innerHTML = lines.length
    ? lines.map((line) => `<article class="checkout-item">
        <span class="checkout-item__art">${line.image ? `<img src="${line.image}" alt="" width="700" height="700" loading="lazy" decoding="async" />` : ""}<i class="checkout-item__count">${line.count}</i></span>
        <span class="checkout-item__copy"><strong>${line.name}</strong><small>${line.detail}</small></span>
        <b>${money(line.price * line.count)}</b>
      </article>`).join("")
    : `<p class="checkout-empty">Your bag is empty. <button class="text-cta js-go-shop" type="button">Find something good &#8594;</button></p>`;

  const fee = deliveryFee(subtotal);
  view.querySelector('[data-total="subtotal"]').textContent = money(subtotal);
  view.querySelector('[data-total="delivery"]').textContent = fee ? money(fee) : "Free";
  view.querySelector('[data-total="grand"]').textContent = money(subtotal + fee);
  view.querySelector(".checkout-place").disabled = !lines.length;
}

export function buildCheckout({ getCart, onPlaced } = {}) {
  view = document.querySelector("#checkout-view");
  if (!view) return;
  readCart = getCart || readCart;
  onOrderPlaced = onPlaced || onOrderPlaced;

  view.querySelectorAll('input[name="delivery"]').forEach((input) => {
    input.addEventListener("change", renderCheckout);
  });

  const form = view.querySelector(".checkout-form");

  // an error clears itself the moment the field it belongs to is being answered
  form.addEventListener("input", (event) => {
    const field = event.target.closest("input");
    if (field?.getAttribute("aria-invalid") === "true") clearFieldError(field);
  });

  view.querySelector(".checkout-place").addEventListener("click", () => {
    if (!validate(form)) return;
    placeOrder();
  });

  renderCheckout();
}

// --- validation ---------------------------------------------------------------------------
// The browser's own bubbles are a grey box in the corner of the screen with the platform's
// type in it. The constraints stay on the inputs — required, type="email" — and are read
// from the same validity object the browser fills in; only the telling is ours.
const MESSAGES = {
  name: "Please tell us who the order is for.",
  email: "We need an email to send the confirmation to.",
  phone: "The courier needs a number to reach you on.",
  address: "Please give us somewhere to deliver to.",
  city: "Which city are we delivering to?",
};

function fieldError(field) {
  const label = field.closest(".field-label");
  let note = label?.querySelector(".field-error");
  if (!note) {
    note = document.createElement("small");
    note.className = "field-error";
    note.id = `error-${field.name}`;
    label?.append(note);
  }
  return note;
}

function clearFieldError(field) {
  field.removeAttribute("aria-invalid");
  field.removeAttribute("aria-describedby");
  field.closest(".field-label")?.querySelector(".field-error")?.remove();
}

function markFieldError(field) {
  const note = fieldError(field);
  note.textContent = field.validity.typeMismatch
    ? "That email address does not look complete."
    : MESSAGES[field.name] || "Please fill this in.";
  field.setAttribute("aria-invalid", "true");
  field.setAttribute("aria-describedby", note.id);
  gsap.fromTo(note, { autoAlpha: 0, y: -4 }, { autoAlpha: 1, y: 0, duration: .28, ease: EASE.art });
}

function validate(form) {
  const fields = [...form.querySelectorAll("input[required]")];
  let first = null;
  fields.forEach((field) => {
    if (field.checkValidity()) { clearFieldError(field); return; }
    markFieldError(field);
    first = first || field;
  });
  // nothing to send, so nothing is confirmed
  if (!readCart().length) return false;
  if (!first) return true;
  first.focus({ preventScroll: true });
  first.scrollIntoView({ block: "center", behavior: "smooth" });
  return false;
}

// --- the confirmation ----------------------------------------------------------------------
// It does not exist until an order has been placed. Nothing to find in the source, nothing
// hidden in the accessibility tree, and no reference number standing in for one.
const PAW_MARK = '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="11" cy="4" r="2"></circle><circle cx="18" cy="8" r="2"></circle><circle cx="20" cy="16" r="2"></circle><path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z"></path></svg>';

// A reference is minted at the moment the order is placed, from the clock and a little
// noise, so two orders in the same session never read the same. A real one would come back
// from the shop's own system; this stands in until it does.
function orderReference() {
  const stamp = Date.now().toString(36).slice(-4);
  const noise = Math.floor(Math.random() * 36 ** 2).toString(36).padStart(2, "0");
  return `PAW-${(stamp + noise).toUpperCase()}`;
}

function buildConfirmation(reference) {
  const done = document.createElement("div");
  done.className = "checkout-done";
  done.setAttribute("role", "status");
  done.innerHTML = `<span class="paw-mark" aria-hidden="true">${PAW_MARK}</span>
    <h2>On the trail.</h2>
    <p>Order <b class="checkout-ref">${reference}</b> is confirmed. We will email you the moment it leaves the shop.</p>
    <button class="button button--outline js-go-story" type="button">Back to the story <span>&#8594;</span></button>`;
  view.append(done);
  return done;
}

function placeOrder() {
  const body = view.querySelector(".checkout-body");
  const done = buildConfirmation(orderReference());

  registerTimeline(gsap.timeline({ defaults: { ease: EASE.art } }))
    .to(body, { autoAlpha: 0, y: -18, duration: .42, ease: EASE.textOut })
    .set(body, { display: "none" })
    .call(() => onOrderPlaced())
    .fromTo(done, { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: .6 })
    .fromTo(done.querySelector(".paw-mark"), { autoAlpha: 0, scale: .7 }, { autoAlpha: 1, scale: 1, duration: .5 }, "<")
    .fromTo(done.querySelectorAll("h2, p, .button"), { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: .5, stagger: .08 }, "<+.15");
}

// leaving the confirmation puts the form back, so a second order does not land on a dead view
export function resetCheckout() {
  if (!view) return;
  const done = view.querySelector(".checkout-done");
  const body = view.querySelector(".checkout-body");
  if (!done) return;
  // the confirmation goes with the order it belonged to
  done.remove();
  view.querySelectorAll("input[aria-invalid]").forEach(clearFieldError);
  // the details belonged to the order that was placed, so the next one starts on a clean form
  view.querySelector(".checkout-form").reset();
  gsap.set(body, { display: "", autoAlpha: 1, y: 0 });
  renderCheckout();
}

// the same layered arrival the shop uses: heading, then the form steps, then the summary
export function buildCheckoutMotion() {
  if (!view) return null;
  return registerTimeline(gsap.timeline({ defaults: { ease: EASE.art } })
    .fromTo(view.querySelectorAll(".checkout-head > *"), { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: .6, stagger: .08 }, 0)
    .fromTo(view.querySelectorAll(".checkout-step"), { autoAlpha: 0, y: 22 }, { autoAlpha: 1, y: 0, duration: .55, stagger: .09 }, .18)
    .fromTo(view.querySelector(".checkout-summary"), { autoAlpha: 0, x: 24 }, { autoAlpha: 1, x: 0, duration: .6 }, .26));
}
