// the .webp files are the shipped art: same illustrations, capped at roughly twice their
// largest on-screen size (see scripts/optimize-images.mjs) so scrolling stays cheap
import heroLeftEnvironment from "../assets/left-environment.webp";
import heroLeftEnvironment700 from "../assets/left-environment-700.webp";
import heroLeftEnvironment950 from "../assets/left-environment-950.webp";
import heroRightEnvironment from "../assets/right-environment.webp";
import heroRightEnvironment700 from "../assets/right-environment-700.webp";
import heroRightEnvironment950 from "../assets/right-environment-950.webp";
import heroPersonDog from "../assets/person-dog.webp";
import heroGroundDetails from "../assets/ground-details.webp";
import heroGroundDetails1100 from "../assets/ground-details-1100.webp";
import heroGroundDetails1450 from "../assets/ground-details-1450.webp";
import heroTopLeftAtmosphere from "../assets/cloud_vector.svg";
import heroTopRightAtmosphere from "../assets/birds_vector.svg";
import personCat from "../assets/person+cat.webp";
import dog from "../assets/dog.webp";
import cat from "../assets/cat.webp";
import shop from "../assets/shop.webp";
import shopBag from "../assets/pawtopia-shop-bag.svg";
import shoppingBag from "../assets/pawtopia-shopping-bag.svg";
import vet from "../assets/vet_vector.svg";
import chapterFiveVet from "../assets/vet-4k-transparent.webp";
import veterinarianCat from "../assets/pawtopia-veterinarian-cat.svg";
import blobOne from "../assets/blob-1.webp";
import blobTwo from "../assets/blob-2.webp";
import vetField from "../assets/organic-cream-blob.svg";
import branchLeft from "../assets/left-branch-vector.svg";
import branchRight from "../assets/right-branch.svg";
import botanicalBranch from "../assets/botanical_branch.svg";
import returnHome from "../assets/return-transparent.webp";
import footerBlobLeft from "../assets/left-blob-footer.webp";
import footerBlobRight from "../assets/footer-dog-cat.webp";

// Nothing here is unused: every key is referenced by a data-asset in the markup. Six large
// SVGs (backgrounds, trees, the mobile pair, forebackground, person+dog — about 500KB) were
// imported here and shipped to every visitor without ever being rendered.
export const ASSETS = Object.freeze({
  heroLeftEnvironment,
  heroRightEnvironment,
  heroPersonDog,
  heroGroundDetails,
  heroTopLeftAtmosphere,
  heroTopRightAtmosphere,
  personCat,
  dog,
  cat,
  shop,
  shopBag,
  shoppingBag,
  vet,
  chapterFiveVet,
  veterinarianCat,
  returnHome,
  blobOne,
  blobTwo,
  vetField,
  branchLeft,
  branchRight,
  botanicalBranch,
  footerBlobLeft,
  footerBlobRight,
});

// `loading="lazy"` is a hint about the viewport, and the browser reads it generously: on a
// fast connection Chrome pulled chapter three's dog and cat, the vet illustration and the
// branches — about 150KB — while the reader was still looking at chapter one. Handing the
// src over only as a scene approaches is a promise instead of a hint. Two screens of warning
// is far more than the art needs to decode, so nothing ever arrives late.
const APPROACH = "200% 0px";
let watcher = null;

function assign(element, source, key) {
  if (element.tagName === "SOURCE") { if (!element.srcset) element.srcset = source; return; }
  if (element.getAttribute("src") || element.getAttribute("srcset")) return;
  const responsive = RESPONSIVE[key];
  if (responsive) {
    element.sizes = responsive.sizes;
    element.srcset = responsive.srcset;
  }
  element.src = source;
}

function watch(element, source) {
  if (!("IntersectionObserver" in window)) { assign(element, source); return; }
  watcher = watcher || new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      const key = entry.target.dataset.asset;
      if (ASSETS[key]) assign(entry.target, ASSETS[key], key);
    });
  }, { rootMargin: APPROACH });
  watcher.observe(element);
}

// The three big hero illustrations are reused further down the page — chapter two's paths,
// chapter three's ground, the send-off. Those copies used to hydrate with the full 1200px
// file while the hero itself had already downloaded a 950px twin, so the same drawing was
// fetched twice at two sizes. Every copy now offers the same candidates and the browser
// reuses whichever one it already has.
const RESPONSIVE = {
  heroLeftEnvironment: {
    srcset: `${heroLeftEnvironment700} 700w, ${heroLeftEnvironment950} 950w, ${heroLeftEnvironment} 1200w`,
    sizes: "(max-width: 720px) 72vw, (max-width: 900px) 48vw, (max-width: 1576px) 52vw, 820px",
  },
  heroRightEnvironment: {
    srcset: `${heroRightEnvironment700} 700w, ${heroRightEnvironment950} 950w, ${heroRightEnvironment} 1200w`,
    sizes: "(max-width: 720px) 72vw, (max-width: 900px) 48vw, (max-width: 1576px) 52vw, 820px",
  },
  heroGroundDetails: {
    srcset: `${heroGroundDetails1100} 1100w, ${heroGroundDetails1450} 1450w, ${heroGroundDetails} 2000w`,
    sizes: "(max-width: 720px) 148vw, (max-width: 900px) 112vw, (max-width: 1568px) 88vw, 1380px",
  },
};

export function hydrateAssets(root = document) {
  root.querySelectorAll("[data-asset]").forEach((element) => {
    const source = ASSETS[element.dataset.asset];
    if (!source) return;
    // the hero is the first thing on screen and carries its own src in the markup; anything
    // marked lazy waits for its scene to come within reach
    if (element.getAttribute("loading") === "lazy") { watch(element, source); return; }
    assign(element, source, element.dataset.asset);
  });
}
