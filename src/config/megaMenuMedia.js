/**
 * Mega menu feature panel — one image card per category, shown on the
 * right of the "Shop by Categories" flyout (desktop only).
 *
 * Keys are category ids (CATEGORIES in src/data/products.js). A category
 * with no entry here shows no panel. Images live in public/menu/ —
 * file names and extensions must match exactly.
 *
 * Brand links use ?brand=<Name>, the filter the category page reads.
 * The name must match products.brand exactly (case-sensitive).
 */
export const MEGA_MENU_MEDIA = {
  "air-conditioners": {
    image: "/menu/ac-midea.jpeg",
    alt: "Nigerian family relaxing in a cool living room with a Midea air conditioner",
    eyebrow: "Featured: Midea",
    title: "Cool comfort, even in harmattan heat",
    ctaLabel: "Shop Midea ACs",
    href: "/category/air-conditioners?brand=Midea",
  },
  "refrigerators-freezers": {
    image: "/menu/fridges-scanfrost.jpeg",
    alt: "Mother and daughter taking fresh fruit and drinks from a Scanfrost refrigerator",
    eyebrow: "Featured: Scanfrost",
    title: "Fresh food, every day of the week",
    ctaLabel: "Shop Scanfrost Fridges",
    href: "/category/refrigerators-freezers?brand=Scanfrost",
  },
  "washing-machines": {
    image: "/menu/washing-midea.jpeg",
    alt: "Young couple loading laundry into a Midea front-loading washing machine",
    eyebrow: "Featured: Midea",
    title: "Laundry day, made easy",
    ctaLabel: "Shop Midea Washers",
    href: "/category/washing-machines?brand=Midea",
  },
  "televisions-audio": {
    image: "/menu/tv-sony.jpeg",
    alt: "Friends cheering a football match on a Sony television",
    eyebrow: "Featured: Sony",
    title: "Match day, the way it should look",
    ctaLabel: "Shop Sony TVs",
    href: "/category/televisions-audio?brand=Sony",
  },
  "kitchen-appliances": {
    image: "/menu/kitchen-kenwood.jpeg",
    alt: "Mother and son baking together with a Kenwood stand mixer",
    eyebrow: "Featured: Kenwood",
    title: "Bake, blend and create",
    ctaLabel: "Shop Kenwood",
    href: "/category/kitchen-appliances?brand=Kenwood",
  },
  // NOTE: public/menu/small-kenwood.jpeg has not been supplied yet. Until
  // it exists the image fails to load and the panel hides itself; drop the
  // file in (as .jpeg, or update the extension here) and it appears.
  "small-appliances": {
    image: "/menu/small-kenwood.jpeg",
    alt: "Woman pouring a fresh smoothie from a Kenwood blender in a bright kitchen",
    eyebrow: "Featured: Kenwood",
    title: "Little helpers, big difference",
    ctaLabel: "Shop Kenwood Small Appliances",
    href: "/category/small-appliances?brand=Kenwood",
  },
  "power-solutions": {
    image: "/menu/power.jpeg",
    alt: "Family comfortable at home with the lights on during a power outage",
    eyebrow: "Power Solutions",
    title: "Stay powered through every outage",
    ctaLabel: "Shop Power Solutions",
    href: "/category/power-solutions",
  },
  // accessories: intentionally no entry — panel stays hidden.
};

export function getMegaMenuMedia(categoryId) {
  return MEGA_MENU_MEDIA[categoryId] || null;
}

export function allMegaMenuImages() {
  return Object.values(MEGA_MENU_MEDIA).map((m) => m.image);
}
