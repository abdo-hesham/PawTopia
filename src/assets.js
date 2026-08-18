// the .webp files are the shipped art: same illustrations, capped at roughly twice their
// largest on-screen size (see scripts/optimize-images.mjs) so scrolling stays cheap
import heroLeftEnvironment from "../assets/left-environment.webp";
import heroRightEnvironment from "../assets/right-environment.webp";
import heroPersonDog from "../assets/person-dog.webp";
import heroGroundDetails from "../assets/ground-details.webp";
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

export function hydrateAssets(root = document) {
  root.querySelectorAll("[data-asset]").forEach((element) => {
    const source = ASSETS[element.dataset.asset];
    if (!source) return;
    if (element.tagName === "SOURCE") { if (!element.srcset) element.srcset = source; return; }
    if (!element.getAttribute("src")) element.src = source;
  });
}
