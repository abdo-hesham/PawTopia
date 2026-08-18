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

  view.querySelector(".checkout-place").addEventListener("click", () => {
    const form = view.querySelector(".checkout-form");
    // the browser's own validation, so a missing field is reported where it is missing
    if (!form.reportValidity()) return;
    placeOrder();
  });

  renderCheckout();
}

function placeOrder() {
  const done = view.querySelector(".checkout-done");
  const body = view.querySelector(".checkout-body");
  // a stable-looking reference from the order size and the minute, no randomness needed
  const lines = readCart();
  const reference = `PAW-${String(1000 + lines.reduce((sum, line) => sum + line.count * 7, 0) * 13 % 9000).padStart(4, "0")}`;
  view.querySelector(".checkout-ref").textContent = reference;

  registerTimeline(gsap.timeline({ defaults: { ease: EASE.art } }))
    .to(body, { autoAlpha: 0, y: -18, duration: .42, ease: EASE.textOut })
    .set(body, { display: "none" })
    .call(() => { done.hidden = false; onOrderPlaced(); })
    .fromTo(done, { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: .6 })
    .fromTo(done.querySelector(".paw-mark"), { autoAlpha: 0, scale: .7 }, { autoAlpha: 1, scale: 1, duration: .5 }, "<")
    .fromTo(done.querySelectorAll("h2, p, .button"), { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: .5, stagger: .08 }, "<+.15");
}

// leaving the confirmation puts the form back, so a second order does not land on a dead view
export function resetCheckout() {
  if (!view) return;
  const done = view.querySelector(".checkout-done");
  const body = view.querySelector(".checkout-body");
  if (done.hidden) return;
  done.hidden = true;
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
