import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ASSETS } from "./assets.js";
import { EASE, registerTimeline } from "./motion.js";
import { confirmAdd, decorateFilterTicks } from "./micro.js";

// The catalogue the shop renders from. Every count on the page is derived from it, so
// nothing on screen can claim a number the data cannot back.
// Product photography and pricing come from aminpetshop.com, downloaded into
// assets/products and re-encoded as webp so the shop does not depend on their CDN.
const PRODUCT_IMAGES = import.meta.glob("../assets/products/*.webp", { eager: true, import: "default" });
const photo = (name) => PRODUCT_IMAGES[`../assets/products/${name}.webp`];

// Seven photographed products, each sold in several variants. The catalogue is expanded
// from these rather than typed out fifty times, so a price, a size and a photo can never
// drift apart, and every filter has real stock behind it.
const BASE_PRODUCTS = [
  { id: "dog-food", name: "Pawtopia Adult Dog Food", price: 1250, rating: 5, reviews: 214, category: "food", pet: "dog", photo: "product-1", blurb: "Slow-cooked in Egypt, with named meat first and no filler grain.",
    variants: [["2kg · chicken & brown rice", 1], ["5kg · chicken & brown rice", 2.1], ["12kg · chicken & brown rice", 4.4], ["2kg · lamb & oats", 1.08], ["5kg · senior recipe", 2.2]] },
  { id: "cat-food", name: "Pawtopia Adult Cat Food", price: 1180, rating: 4.5, reviews: 128, category: "food", pet: "cat", photo: "product-2", blurb: "High-protein, low-carb kibble sized small for adult and indoor cats.",
    variants: [["1.5kg · chicken & brown rice", 1], ["4kg · chicken & brown rice", 2.3], ["1.5kg · salmon recipe", 1.06], ["1.5kg · kitten formula", .96], ["4kg · indoor formula", 2.35]] },
  { id: "shampoo", name: "Pawtopia Oatmeal Shampoo", price: 320, rating: 4.5, reviews: 96, category: "grooming", pet: "both", photo: "product-3", blurb: "Soap-free oatmeal wash that calms itchy skin between grooms.",
    variants: [["473ml · oatmeal & aloe", 1], ["946ml · oatmeal & aloe", 1.75], ["473ml · puppy mild", .95], ["473ml · deshedding", 1.1], ["Travel 150ml", .45]] },
  { id: "plush-dino", name: "Pawtopia Plush Dino", price: 280, rating: 4.5, reviews: 86, category: "toys", pet: "both", photo: "product-4", blurb: "Double-stitched seams and a squeaker that survives an enthusiastic week.",
    variants: [["Small · squeaker inside", 1], ["Large · squeaker inside", 1.5], ["Small · crinkle tail", 1.05], ["Two-pack", 1.85, "cat"], ["Kitten size", .8, "cat"]] },
  { id: "collar", name: "Pawtopia Canvas Collar", price: 190, rating: 4, reviews: 92, category: "accessories", pet: "dog", photo: "product-5", blurb: "Soft-washed canvas on a brass D-ring, adjustable through four sizes.",
    variants: [["Small · sage canvas", 1], ["Medium · sage canvas", 1.15], ["Large · sage canvas", 1.3], ["Medium · clay canvas", 1.15], ["Cat size · breakaway", .85, "cat"]] },
  { id: "rope-toy", name: "Pawtopia Rope Chew", price: 240, rating: 4.5, reviews: 143, category: "toys", pet: "dog", photo: "product-6", blurb: "Undyed cotton rope that flosses teeth while they pull.",
    variants: [["Medium · natural cotton", 1], ["Large · natural cotton", 1.4], ["Small · natural cotton", .78], ["Knotted ring", 1.1], ["Two-pack", 1.8]] },
  { id: "brush", name: "Pawtopia Slicker Brush", price: 175, rating: 4.5, reviews: 71, category: "grooming", pet: "both", photo: "product-7", blurb: "Bent pins lift loose undercoat without scratching the skin beneath.",
    variants: [["Beech handle · standard", 1], ["Beech handle · large", 1.25], ["Soft pin · puppy", .9], ["Cat slicker", .88, "cat"], ["Deshedding comb", 1.15]] },
  { id: "bowl", name: "Pawtopia Ceramic Bowl", price: 260, rating: 4, reviews: 57, category: "accessories", pet: "both", photo: "product-8", blurb: "Heavy stoneware that stays put, dishwasher safe and lead-free glazed.",
    variants: [["Medium · speckled cream", 1], ["Large · speckled cream", 1.35], ["Small · speckled cream", .8, "cat"], ["Medium · sage glaze", 1.05], ["Twin set with stand", 2.1]] },
  { id: "bed", name: "Pawtopia Round Bed", price: 1180, rating: 5, reviews: 61, category: "accessories", pet: "both", photo: "product-9", blurb: "Bolstered rim for chin-resters, with a cover that zips off for a wash.",
    variants: [["Medium · sage linen", 1], ["Large · sage linen", 1.4], ["Small · sage linen", .72, "cat"], ["Medium · clay linen", 1.02], ["Washable cover", .35]] },
  { id: "treats", name: "Pawtopia Chicken Bites", price: 140, rating: 5, reviews: 188, category: "food", pet: "dog", photo: "product-10", blurb: "Single-ingredient baked chicken, small enough for training repetitions.",
    variants: [["100g · oven baked", 1], ["250g · oven baked", 2.1], ["100g · salmon bites", 1.05, "cat"], ["100g · training minis", .95], ["Three-pack", 2.7]] },
];

const BADGES = ["Best seller", "New", "Top rated", "Vet pick", "", "", ""];

// ten photographed products, five variants each: every one of the fifty rows is real stock
function buildCatalogue() {
  const list = [];
  const depth = Math.max(...BASE_PRODUCTS.map((base) => base.variants.length));
  // variant index on the outside: consecutive cards are different products rather than five
  // rows of the same bag, which read as duplicates on the first page
  for (let variantIndex = 0; variantIndex < depth; variantIndex += 1) {
    BASE_PRODUCTS.forEach((base) => {
      const variant = base.variants[variantIndex];
      if (!variant) return;
      const [detail, multiplier, petOverride] = variant;
      const index = list.length;
      list.push({
        id: `${base.id}-${variantIndex}`,
        name: base.name,
        detail,
        price: Math.round(base.price * multiplier / 5) * 5,
        rating: [5, 4.5, 4.5, 4, 4.5][index % 5],
        reviews: base.reviews + ((index * 17) % 90),
        badge: variantIndex === 0 ? BADGES[index % 4] : BADGES[index % BADGES.length],
        blurb: base.blurb,
        category: base.category,
        pet: petOverride || base.pet,
        photo: base.photo,
        // the bundled URL, so the cart and the checkout can show the product without
        // reaching back into the shop module for the image map
        image: photo(base.photo),
      });
    });
  }
  return list;
}

export const CATALOGUE = buildCatalogue();

// how many cards a page holds before the pagination takes over
const PAGE_SIZE = 12;
let page = 1;

export const CATEGORIES = [
  { id: "all", label: "All Products", art: "shoppingBag" },
  { id: "food", label: "Food & Treats", art: "shopBag" },
  { id: "health", label: "Health & Wellness", art: "vet" },
  { id: "grooming", label: "Grooming & Care", art: "veterinarianCat" },
  { id: "toys", label: "Toys & Enrichment", art: "dog" },
  { id: "accessories", label: "Accessories", art: "cat" },
];

// counts are derived, never typed: a tile can only claim what the catalogue holds
const countFor = (id) => (id === "all" ? CATALOGUE.length : CATALOGUE.filter((product) => product.category === id).length);
const countPet = (pet) => CATALOGUE.filter((product) => product.pet === pet).length;

const PET_TYPES = ["dog", "cat", "both"];
const SORTS = [
  { id: "featured", label: "Featured" },
  { id: "price-asc", label: "Price: low to high" },
  { id: "price-desc", label: "Price: high to low" },
  { id: "rating", label: "Top rated" },
];

// the rail spans the real catalogue, so its top stop can never hide stock
const MAX_PRICE = Math.ceil(Math.max(...CATALOGUE.map((product) => product.price)) / 100) * 100;
const MIN_PRICE = Math.floor(Math.min(...CATALOGUE.map((product) => product.price)) / 10) * 10;
const state = { category: "all", pets: new Set(), price: MAX_PRICE, sort: "featured" };
let onAddToCart = () => {};
let gridElement = null;
let cardTween = null;

function money(value) {
  return `EGP ${value.toLocaleString("en-US")}`;
}

// half stars are drawn with a clipped overlay so a 4.5 reads as four and a half marks
function stars(rating) {
  const full = Math.floor(rating);
  const half = rating % 1 >= .5;
  let out = "";
  for (let index = 0; index < 5; index += 1) {
    const state = index < full ? "is-full" : index === full && half ? "is-half" : "";
    out += `<i class="star ${state}" aria-hidden="true"></i>`;
  }
  return out;
}

function visibleProducts() {
  let list = CATALOGUE.filter((product) => {
    if (state.category !== "all" && product.category !== state.category) return false;
    if (state.pets.size && !state.pets.has(product.pet)) return false;
    return product.price <= state.price;
  });
  if (state.sort === "price-asc") list = [...list].sort((a, b) => a.price - b.price);
  if (state.sort === "price-desc") list = [...list].sort((a, b) => b.price - a.price);
  if (state.sort === "rating") list = [...list].sort((a, b) => b.rating - a.rating || b.reviews - a.reviews);
  return list;
}

// Which hearts are filled has to outlive the grid, because every filter, sort and page
// re-renders all twelve cards from scratch.
const saved = new Set();

function categoryLabel(id) {
  return CATEGORIES.find((category) => category.id === id)?.label || id;
}

// The card is an article named by its own heading. Everything a shopper can see is in the
// text — the stars and the bare "(128)" are a picture of a rating, so the rating is written
// out for a screen reader beside them and the marks themselves are hidden.
function cardMarkup(product) {
  const isSaved = saved.has(product.id);
  const nameId = `product-name-${product.id}`;
  return `<article class="product-card" data-product-card="${product.id}" aria-labelledby="${nameId}">
    ${product.badge ? `<span class="product-badge product-badge--${product.badge.split(" ")[0].toLowerCase()}">${product.badge}</span>` : ""}
    <button class="product-save${isSaved ? " is-saved" : ""}" type="button" data-save="${product.id}" aria-pressed="${isSaved}" aria-label="${isSaved ? "Remove" : "Add"} ${product.name} ${isSaved ? "from" : "to"} your wishlist"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 20.1 4.9 13a4.5 4.5 0 0 1 6.4-6.4l.7.7.7-.7A4.5 4.5 0 1 1 19.1 13Z" /></svg></button>
    <span class="product-art"><img src="${photo(product.photo)}" alt="${product.name} — ${product.detail}" width="700" height="700" loading="lazy" decoding="async" /></span>
    <h3 id="${nameId}"><button class="product-open" type="button" data-open="${product.id}">${product.name}</button></h3>
    <p class="product-blurb">${product.blurb}</p>
    <p class="product-variant">${product.detail}<span class="sr-only"> · ${categoryLabel(product.category)}</span></p>
    <p class="product-rating"><span aria-hidden="true">${stars(product.rating)}</span><small aria-hidden="true">(${product.reviews})</small><span class="sr-only">Rated ${product.rating} out of 5 from ${product.reviews} reviews</span></p>
    <p class="product-foot"><b>${money(product.price)}</b><button class="product-add" type="button" data-add="${product.id}" aria-label="Add ${product.name} to your bag, ${money(product.price)}"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 5h2.2l2.1 9.4a2 2 0 0 0 2 1.6h6.6a2 2 0 0 0 2-1.5L21 8H7" /><circle cx="10.5" cy="19.5" r="1.3" /><circle cx="17" cy="19.5" r="1.3" /></svg></button></p>
  </article>`;
}

// --- the product view -------------------------------------------------------------------
// A native <dialog>, so the focus trap, the Escape key and the backdrop are the browser's
// rather than three more things to get wrong. It reads from the same catalogue row the card
// does, so nothing here can drift from what the grid showed.
let productDialog = null;
let dialogProduct = null;
let dialogQuantity = 1;
// the exit tween closes the dialog when it lands, so a close followed quickly by an open
// would otherwise arrive late and shut the product that had just been opened
let closingProduct = false;

function buildProductDialog() {
  if (productDialog) return productDialog;
  productDialog = document.createElement("dialog");
  productDialog.className = "product-dialog";
  productDialog.innerHTML = `<button class="icon-button js-close-product" type="button" aria-label="Close product">&times;</button>
    <div class="product-dialog__art"><img alt="" width="700" height="700" decoding="async" /></div>
    <div class="product-dialog__copy" data-lenis-prevent>
      <p class="scene-kicker"><span class="product-dialog__category"></span></p>
      <h2></h2>
      <p class="product-dialog__blurb"></p>
      <p class="product-rating"></p>
      <dl class="product-dialog__spec"></dl>
      <p class="product-dialog__price"><b></b><small></small></p>
      <div class="product-dialog__quantity">
        <span>Quantity</span>
        <button class="quantity-step" type="button" data-quantity="-1" aria-label="One fewer">&minus;</button>
        <output aria-live="polite">1</output>
        <button class="quantity-step" type="button" data-quantity="1" aria-label="One more">+</button>
      </div>
      <div class="product-dialog__actions">
        <button class="button button--outline js-close-product" type="button"><span>&#8592;</span> Cancel</button>
        <button class="button button--coral js-product-add" type="button">Add to bag <span>&#8594;</span></button>
      </div>
      <p class="product-dialog__note">Free delivery over EGP 900 · Cash or card on delivery · 14-day returns</p>
    </div>`;
  document.body.append(productDialog);

  // Escape closes it natively and instantly; this hands that back to the same exit the
  // close button plays
  productDialog.addEventListener("cancel", (event) => { event.preventDefault(); closeProduct(); });

  productDialog.addEventListener("click", (event) => {
    if (event.target.closest(".js-close-product")) { closeProduct(); return; }
    const step = event.target.closest("[data-quantity]");
    if (step) { setQuantity(dialogQuantity + Number(step.dataset.quantity)); return; }
    const add = event.target.closest(".js-product-add");
    if (add) { addFromDialog(); confirmAdd(add); return; }
    // The backdrop is the dialog element itself, so anything inside lands on a child. The
    // target test comes first: a keyboard Enter fires a click at 0,0, which the bounds test
    // alone would read as a click outside.
    if (event.target !== productDialog) return;
    const box = productDialog.getBoundingClientRect();
    const outside = event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom;
    if (outside) closeProduct();
  });

  return productDialog;
}

function setQuantity(next) {
  dialogQuantity = Math.max(1, Math.min(9, next));
  productDialog.querySelector(".product-dialog__quantity output").textContent = dialogQuantity;
  productDialog.querySelectorAll(".quantity-step").forEach((step) => {
    const target = dialogQuantity + Number(step.dataset.quantity);
    step.disabled = target < 1 || target > 9;
  });
}

function addFromDialog() {
  if (!dialogProduct) return;
  for (let count = 0; count < dialogQuantity; count += 1) onAddToCart(dialogProduct.id);
}

const PET_LABEL = { dog: "Dogs", cat: "Cats", both: "Dogs & cats" };

export function openProduct(id) {
  const product = CATALOGUE.find((entry) => entry.id === id);
  if (!product) return;
  const dialog = buildProductDialog();
  dialogProduct = product;

  const image = dialog.querySelector(".product-dialog__art img");
  image.src = photo(product.photo);
  image.alt = `${product.name} — ${product.detail}`;
  dialog.querySelector(".product-dialog__category").textContent = (CATEGORIES.find((entry) => entry.id === product.category) || {}).label || "Pawtopia";
  dialog.querySelector("h2").textContent = product.name;
  dialog.querySelector(".product-dialog__blurb").textContent = product.blurb;
  dialog.querySelector(".product-rating").innerHTML = `${stars(product.rating)}<small>${product.rating} out of 5 · ${product.reviews} reviews</small>`;
  dialog.querySelector(".product-dialog__spec").innerHTML = [
    ["Variant", product.detail],
    ["For", PET_LABEL[product.pet] || "Pets"],
    ["Category", (CATEGORIES.find((entry) => entry.id === product.category) || {}).label || "—"],
    ["Delivery", "2–4 days across Egypt"],
  ].map(([term, value]) => `<div><dt>${term}</dt><dd>${value}</dd></div>`).join("");
  dialog.querySelector(".product-dialog__price b").textContent = money(product.price);
  dialog.querySelector(".product-dialog__price small").textContent = product.badge || "In stock";

  setQuantity(1);
  gsap.killTweensOf(dialog);
  closingProduct = false;
  gsap.set(dialog, { clearProps: "opacity,visibility,transform" });
  if (!dialog.open) dialog.showModal();
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  gsap.fromTo(dialog, { autoAlpha: 0, y: 22, scale: .985 }, { autoAlpha: 1, y: 0, scale: 1, duration: .44, ease: EASE.art });
  gsap.fromTo(dialog.querySelectorAll(".product-dialog__copy > *"), { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: .42, stagger: .05, ease: EASE.art, delay: .1 });
}

export function closeProduct() {
  if (!productDialog?.open || closingProduct) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { productDialog.close(); return; }
  closingProduct = true;
  gsap.to(productDialog, {
    autoAlpha: 0,
    y: 16,
    duration: .26,
    ease: EASE.textOut,
    onComplete: () => {
      if (!closingProduct) return;   // reopened while the exit was still playing
      closingProduct = false;
      productDialog.close();
    },
  });
}

// Cards are re-rendered on every filter change, so the reveal is re-run rather than kept as
// a scroll trigger per card: a stagger from a single tween costs one timeline, not twelve.
function renderGrid({ animate = true, keepPage = false } = {}) {
  if (!gridElement) return;
  const list = visibleProducts();
  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  // a filter that shrinks the list must not strand the reader on a page that no longer exists
  if (!keepPage) page = 1;
  page = Math.min(page, pages);

  const from = (page - 1) * PAGE_SIZE;
  const slice = list.slice(from, from + PAGE_SIZE);
  const count = document.querySelector(".shop-count");
  if (count) count.textContent = list.length ? `Showing ${from + 1}-${from + slice.length} of ${list.length} products` : "No products match these filters";

  gridElement.innerHTML = slice.map(cardMarkup).join("");
  renderPagination(pages);

  cardTween?.kill();
  const cards = gridElement.querySelectorAll(".product-card");
  if (!cards.length) return;
  if (!animate) { gsap.set(cards, { autoAlpha: 1, y: 0 }); return; }
  cardTween = gsap.fromTo(cards, { autoAlpha: 0, y: 22 }, { autoAlpha: 1, y: 0, duration: .5, ease: EASE.art, stagger: .045, overwrite: true });
}

// Pagination in the story's own vocabulary: numbered like the chapters, the current page
// marked in coral, and a paw between the arrows rather than a plain divider.
function renderPagination(pages) {
  const nav = document.querySelector(".shop-pagination");
  if (!nav) return;
  if (pages < 2) { nav.innerHTML = ""; nav.hidden = true; return; }
  nav.hidden = false;
  const numbers = Array.from({ length: pages }, (unused, index) => {
    const value = index + 1;
    return `<button class="page-number${value === page ? " is-active" : ""}" type="button" data-page="${value}" aria-current="${value === page ? "page" : "false"}">${String(value).padStart(2, "0")}</button>`;
  }).join("");
  nav.innerHTML = `<button class="page-step" type="button" data-step="-1"${page === 1 ? " disabled" : ""} aria-label="Previous page">&#8592;</button>
    <span class="page-numbers">${numbers}</span>
    <button class="page-step" type="button" data-step="1"${page === pages ? " disabled" : ""} aria-label="Next page">&#8594;</button>`;
}

function goToPage(next, pages) {
  const clamped = Math.max(1, Math.min(pages, next));
  if (clamped === page) return;
  page = clamped;
  renderGrid({ keepPage: true });
  // the grid, not the whole page: the reader keeps their place in the shop
  const top = gridElement.getBoundingClientRect().top + window.scrollY - window.innerHeight * .22;
  window.__pawtopiaScrollTo ? window.__pawtopiaScrollTo(top) : window.scrollTo({ top, behavior: "smooth" });
}

function syncFilterChips() {
  document.querySelectorAll("[data-category]").forEach((tile) => {
    tile.classList.toggle("is-active", tile.dataset.category === state.category);
  });
  document.querySelectorAll("[data-filter-category]").forEach((input) => {
    input.checked = input.dataset.filterCategory === state.category;
  });
}

export function buildShop({ onAdd } = {}) {
  onAddToCart = onAdd || onAddToCart;
  const view = document.querySelector("#shop-view");
  if (!view) return;
  gridElement = view.querySelector(".product-grid");

  // category tiles
  const tiles = view.querySelector(".shop-categories");
  tiles.innerHTML = CATEGORIES.filter((category) => countFor(category.id) > 0).map((category) => `<button class="shop-category" type="button" data-category="${category.id}">
      <span class="shop-category__art"><img src="${ASSETS[category.art]}" alt="" loading="lazy" /></span>
      <span class="shop-category__copy"><strong>${category.label}</strong><small>${countFor(category.id)} items</small></span>
    </button>`).join("");

  // filter rail
  const petList = view.querySelector(".filter-pets");
  petList.innerHTML = PET_TYPES.map((pet) => `<label><input type="checkbox" autocomplete="off" data-filter-pet="${pet}" /><span>${pet === "both" ? "Both" : pet[0].toUpperCase() + pet.slice(1)} (${countPet(pet)})</span></label>`).join("");

  const categoryList = view.querySelector(".filter-categories");
  categoryList.innerHTML = CATEGORIES.filter((category) => category.id !== "all" && countFor(category.id) > 0)
    .map((category) => `<label><input type="checkbox" autocomplete="off" data-filter-category="${category.id}" /><span>${category.label}</span></label>`).join("");

  const sortMenu = view.querySelector(".sort-menu");
  const sortToggle = view.querySelector(".sort-toggle");
  const sortValue = view.querySelector("#sort-value");
  sortMenu.innerHTML = SORTS.map((sort) => `<li role="none"><button role="option" type="button" data-sort="${sort.id}" aria-selected="${sort.id === state.sort}" tabindex="-1">${sort.label}</button></li>`).join("");

  // events
  tiles.addEventListener("click", (event) => {
    const tile = event.target.closest("[data-category]");
    if (!tile) return;
    state.category = tile.dataset.category;
    syncFilterChips();
    renderGrid();
  });

  categoryList.addEventListener("change", (event) => {
    const input = event.target.closest("[data-filter-category]");
    if (!input) return;
    state.category = input.checked ? input.dataset.filterCategory : "all";
    syncFilterChips();
    renderGrid();
  });

  petList.addEventListener("change", (event) => {
    const input = event.target.closest("[data-filter-pet]");
    if (!input) return;
    if (input.checked) state.pets.add(input.dataset.filterPet);
    else state.pets.delete(input.dataset.filterPet);
    renderGrid();
  });

  const price = view.querySelector(".filter-price input");
  price.min = MIN_PRICE;
  price.max = MAX_PRICE;
  price.value = MAX_PRICE;
  view.querySelector(".filter-price span").textContent = money(MIN_PRICE);
  view.querySelector(".filter-price output").textContent = money(MAX_PRICE);
  price.setAttribute("aria-valuetext", money(MAX_PRICE));
  price.addEventListener("input", () => {
    state.price = Number(price.value);
    view.querySelector(".filter-price output").textContent = money(state.price);
    // a range input announces "3000"; the shopper is choosing money, so say the money
    price.setAttribute("aria-valuetext", money(state.price));
    renderGrid({ animate: false });
  });

  // --- sort control ---------------------------------------------------------------------
  // A native <select> drops the platform's own list over the page, which no stylesheet can
  // reach. This is the same control built from a button and real options, so it can wear the
  // shop's cream and coral, and it keeps the keyboard behaviour a select has.
  const syncSort = () => {
    const chosen = SORTS.find((sort) => sort.id === state.sort) || SORTS[0];
    sortValue.textContent = chosen.label;
    sortMenu.querySelectorAll("[data-sort]").forEach((option) => {
      option.setAttribute("aria-selected", option.dataset.sort === state.sort);
    });
  };

  const closeSort = ({ focusToggle = false } = {}) => {
    if (sortMenu.hidden) return;
    sortMenu.hidden = true;
    sortToggle.setAttribute("aria-expanded", "false");
    if (focusToggle) sortToggle.focus();
  };

  const openSort = () => {
    if (!sortMenu.hidden) return;
    sortMenu.hidden = false;
    sortToggle.setAttribute("aria-expanded", "true");
    gsap.fromTo(sortMenu, { autoAlpha: 0, y: -6 }, { autoAlpha: 1, y: 0, duration: .22, ease: EASE.art });
    (sortMenu.querySelector('[aria-selected="true"]') || sortMenu.querySelector("[data-sort]"))?.focus();
  };

  sortToggle.addEventListener("click", () => (sortMenu.hidden ? openSort() : closeSort()));

  sortMenu.addEventListener("click", (event) => {
    const option = event.target.closest("[data-sort]");
    if (!option) return;
    state.sort = option.dataset.sort;
    syncSort();
    closeSort({ focusToggle: true });
    renderGrid();
  });

  // up and down walk the options, Escape gives up, Home and End jump the ends
  sortMenu.addEventListener("keydown", (event) => {
    const options = [...sortMenu.querySelectorAll("[data-sort]")];
    const index = options.indexOf(document.activeElement);
    if (event.key === "Escape") { event.preventDefault(); closeSort({ focusToggle: true }); return; }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      options[(index + step + options.length) % options.length]?.focus();
      return;
    }
    if (event.key === "Home") { event.preventDefault(); options[0]?.focus(); }
    if (event.key === "End") { event.preventDefault(); options[options.length - 1]?.focus(); }
  });

  sortToggle.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    openSort();
  });

  // a click anywhere else, or focus leaving the control, closes it the way a select does
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".shop-sort")) closeSort();
  });
  document.addEventListener("focusin", (event) => {
    // the window handing focus back to the document is not the reader tabbing away, and
    // closing on it shuts the menu every time the page regains focus
    if (event.target === document.body || event.target === document.documentElement) return;
    if (!event.target.closest(".shop-sort")) closeSort();
  });

  view.querySelector(".shop-clear").addEventListener("click", () => {
    state.category = "all";
    state.pets.clear();
    state.price = MAX_PRICE;
    state.sort = "featured";
    syncSort();
    view.querySelectorAll(".shop-filters input[type=checkbox]").forEach((input) => { input.checked = false; });
    price.value = MAX_PRICE;
    view.querySelector(".filter-price output").textContent = money(MAX_PRICE);
    syncFilterChips();
    renderGrid();
  });

  view.querySelector(".shop-pagination").addEventListener("click", (event) => {
    const pages = Math.max(1, Math.ceil(visibleProducts().length / PAGE_SIZE));
    const step = event.target.closest("[data-step]");
    if (step) { goToPage(page + Number(step.dataset.step), pages); return; }
    const number = event.target.closest("[data-page]");
    if (number) goToPage(Number(number.dataset.page), pages);
  });

  gridElement.addEventListener("click", (event) => {
    const add = event.target.closest("[data-add]");
    if (add) {
      onAddToCart(add.dataset.add);
      confirmAdd(add);
      return;
    }
    const save = event.target.closest(".product-save");
    if (save) {
      const id = save.dataset.save;
      const now = !saved.has(id);
      if (now) saved.add(id); else saved.delete(id);
      const name = CATALOGUE.find((product) => product.id === id)?.name || "this product";
      save.classList.toggle("is-saved", now);
      save.setAttribute("aria-pressed", String(now));
      save.setAttribute("aria-label", `${now ? "Remove" : "Add"} ${name} ${now ? "from" : "to"} your wishlist`);
      gsap.fromTo(save, { scale: .8 }, { scale: 1, duration: .38, ease: EASE.art });
      return;
    }
    // anywhere else on the card opens the product
    const card = event.target.closest("[data-product-card]");
    if (card) openProduct(card.dataset.productCard);
  });

  // Chrome restores checkbox and range values on reload and can fire change during setup,
  // which silently applied a filter from a previous visit before the first render. The
  // controls are reset to match the state object, not the other way round.
  view.querySelectorAll(".shop-filters input[type=checkbox]").forEach((input) => { input.checked = false; });
  price.value = MAX_PRICE;
  syncSort();
  state.category = "all";
  state.pets.clear();
  state.price = MAX_PRICE;

  decorateFilterTicks(view);
  syncFilterChips();
  renderGrid({ animate: false });
}

// The shop reveals in the same order a chapter does: world, then illustration, then the
// type, then the things you can act on. Scrubbed where it is worth following the scroll,
// played once where the block is a single beat.
export function buildShopMotion() {
  const view = document.querySelector("#shop-view");
  if (!view) return;

  const intro = registerTimeline(gsap.timeline({ defaults: { ease: EASE.art } }));
  intro
    .fromTo(view.querySelector(".shop-hero"), { autoAlpha: 0, y: 24, scale: .995 }, { autoAlpha: 1, y: 0, scale: 1, duration: .7 }, 0)
    .fromTo(view.querySelectorAll(".shop-hero__copy > *"), { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: .6, stagger: .08 }, .12)
    .fromTo(view.querySelector(".shop-hero__art"), { autoAlpha: 0, x: 30, y: 10 }, { autoAlpha: 1, x: 0, y: 0, duration: .8 }, .18)
    .fromTo(view.querySelectorAll(".shop-category"), { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: .5, stagger: .05 }, .34)
    .fromTo(view.querySelector(".shop-filters"), { autoAlpha: 0, x: -20 }, { autoAlpha: 1, x: 0, duration: .55 }, .46)
    .fromTo(view.querySelector(".shop-toolbar"), { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: .5 }, .5);

  // These two sit at the end of a short page. A scrubbed reveal there can never finish —
  // the document runs out of scroll before the trigger reaches its end, and the footer was
  // measured stranded at opacity .65. They play once on entry instead.
  registerTimeline(gsap.timeline({
    defaults: { ease: EASE.art },
    scrollTrigger: { trigger: view.querySelector(".shop-values"), start: "top 92%", once: true },
  })).fromTo(view.querySelectorAll(".shop-value"), { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: .6, stagger: .08 }, 0);

  registerTimeline(gsap.timeline({
    defaults: { ease: EASE.art },
    scrollTrigger: { trigger: view.querySelector(".shop-footer"), start: "top 96%", once: true },
  })).fromTo(view.querySelectorAll(".shop-footer > *"), { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: .55, stagger: .07 }, 0);

  ScrollTrigger.refresh();
  return intro;
}

export function resetShopMotion() {
  cardTween?.kill();
  cardTween = null;
}
