/**
 * ============================================================
 *  PRODUCT DATA — single source of truth.
 *  Every page (storefront and admin) renders from this array,
 *  so a price/stock/rating can never contradict itself.
 *  In production this is replaced by the API; the shape stays.
 *
 *  IMAGES: files live in public/products/ and are referenced
 *  by path here — several SKUs may share one photo until each
 *  product gets its own shot (SKU-named files in the bulk pipeline).
 *
 *  CATEGORY FILTERS: each category declares which filters its
 *  product listing exposes. The Category page reads this config
 *  and renders the matching sidebar controls. Adding a new
 *  attribute = add it to the product, list it in the category
 *  filterConfig, register a renderer in FilterSidebar.
 * ============================================================
 */

export const CATEGORIES = [
  {
    id: "refrigerators-freezers",
    label: "Refrigerators & Freezers",
    icon: "Refrigerator",
    blurb: "Freshness that lasts longer.",
    filterConfig: ["brand", "litres", "doors", "price", "availability"],
    megamenu: [
      { heading: "By Type", items: ["Single Door Fridges", "Double Door Fridges", "Side-by-Side Fridges", "French Door Fridges", "Chest Freezers", "Upright Freezers", "Mini Fridges"] },
      { heading: "By Brand", items: ["Scanfrost", "Midea", "Samsung", "Hisense", "LG"] },
    ],
  },
  {
    id: "air-conditioners",
    label: "Air Conditioners",
    icon: "AirVent",
    blurb: "Cool comfort all year round.",
    filterConfig: ["brand", "hp", "inverter", "price", "availability"],
    megamenu: [
      { heading: "By Type", items: ["Split ACs", "Inverter ACs", "Window ACs", "Floor Standing ACs", "Portable ACs"] },
      { heading: "By Capacity", items: ["1.0 HP", "1.5 HP", "2.0 HP", "2.5 HP"] },
      { heading: "By Brand", items: ["Scanfrost", "Midea", "Samsung", "Panasonic", "LG", "Hisense"] },
    ],
  },
  {
    id: "washing-machines",
    label: "Washing Machines",
    icon: "WashingMachine",
    blurb: "Powerful cleaning, gentle care.",
    filterConfig: ["brand", "price", "availability"],
    megamenu: [
      { heading: "By Type", items: ["Front Load", "Top Load", "Twin Tub", "Semi-Automatic"] },
      { heading: "By Brand", items: ["Scanfrost", "Midea", "Samsung", "Panasonic", "LG", "Hisense"] },
    ],
  },
  {
    id: "televisions-audio",
    label: "Televisions & Audio",
    icon: "Tv",
    blurb: "Brilliant visuals. Immersive sound.",
    filterConfig: ["brand", "price", "availability"],
    megamenu: [
      { heading: "Televisions", items: ["Smart TVs", "4K UHD TVs", "LED TVs", "OLED TVs", "Android TVs"] },
      { heading: "Audio", items: ["Sound Bars", "Home Theatre Systems", "Bluetooth Speakers", "Earbuds & Headphones"] },
      { heading: "By Brand", items: ["Samsung", "Sony", "LG", "Hisense", "Oraimo"] },
    ],
  },
  {
    id: "kitchen-appliances",
    label: "Kitchen Appliances",
    icon: "Blend",
    blurb: "Blend, chop, create more.",
    filterConfig: ["brand", "price", "availability"],
    megamenu: [
      { heading: "Appliances", items: ["Blenders", "Food Processors", "Juicers", "Electric Kettles", "Coffee Makers", "Toasters & Ovens", "Rice Cookers"] },
      { heading: "By Brand", items: ["Scanfrost", "Midea", "Kenwood", "Oraimo", "LG"] },
    ],
  },
  {
    id: "small-appliances",
    label: "Small Appliances",
    icon: "CookingPot",
    blurb: "Everyday helpers, easy choices.",
    filterConfig: ["brand", "price", "availability"],
    megamenu: [
      { heading: "Appliances", items: ["Irons & Steamers", "Fans & Air Coolers", "Microwaves", "Gas Cookers", "Electric Cookers", "Vacuum Cleaners", "Air Fryers"] },
      { heading: "By Brand", items: ["Scanfrost", "Midea", "Kenwood", "Binatone", "Oraimo"] },
    ],
  },
  {
    id: "power-solutions",
    label: "Power Solutions",
    icon: "Zap",
    blurb: "Stabilizers, UPS & generators.",
    hot: true,
    filterConfig: ["brand", "price", "availability"],
    megamenu: [
      { heading: "Products", items: ["Voltage Stabilizers", "UPS Systems", "Inverters", "Generators", "Solar Panels", "Power Banks"] },
      { heading: "By Brand", items: ["Binatone", "LG", "Scanfrost", "Mercury"] },
    ],
  },
  {
    id: "accessories",
    label: "Accessories",
    icon: "Cable",
    blurb: "Cables, sockets & spares.",
    filterConfig: ["brand", "price", "availability"],
    megamenu: [
      { heading: "Products", items: ["Extension Cables", "Power Sockets", "HDMI Cables", "Remote Controls", "Wall Brackets", "Surge Protectors"] },
    ],
  },
];

export const BRANDS = [
  { id: "scanfrost", name: "Scanfrost", logo: "/brands/scanfrost.png" },
  { id: "midea", name: "Midea", logo: "/brands/midea.png" },
  { id: "samsung", name: "Samsung", logo: "/brands/samsung.png" },
  { id: "sony", name: "Sony", logo: "/brands/sony.png" },
  { id: "kenwood", name: "Kenwood", logo: "/brands/kenwood.png" },
  { id: "panasonic", name: "Panasonic", logo: "/brands/panasonic.png" },
  { id: "lg", name: "LG", logo: "/brands/LG.png" },
  { id: "hisense", name: "Hisense", logo: "/brands/Hisense.png" },
  { id: "binatone", name: "Binatone", logo: "/brands/Binatone.png" },
];

/** Look up a brand record by id OR by display name (case-insensitive). */
export const findBrand = (idOrName) => {
  if (!idOrName) return null;
  const k = idOrName.toLowerCase();
  return BRANDS.find((b) => b.id === k || b.name.toLowerCase() === k) || null;
};

export const PRODUCTS = [];

export const bySku = (sku) => PRODUCTS.find((p) => p.sku === sku);
export const byCategory = (catId) => PRODUCTS.filter((p) => p.category === catId);
export const byBrand = (brand) => PRODUCTS.filter((p) => p.brand === brand);
export const byId = (catId) => CATEGORIES.find((c) => c.id === catId);
export const RECOMMENDED_ADDON = "BT-ST2000";

export const POPULAR_SEARCHES = [
  "Inverter AC",
  "Chest Freezer",
  "Smart TV",
  "Washing Machine",
  "Blender",
  "Stabilizer",
];

/** Deals = anything with a `was` price (a struck-through original). */
export const getDeals = () => PRODUCTS.filter((p) => p.was);