/**
 * ============================================================
 *  PRODUCT DATA — single source of truth.
 *  Every page (storefront and admin) renders from this array,
 *  so a price/stock/rating can never contradict itself.
 *  In production this is replaced by the API; the shape stays.
 *
 *  IMAGES: files live in public/products/ and are referenced
 *  by path here \u2014 several SKUs may share one photo until each
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

export const PRODUCTS = [
  {
    sku: "SF-AC15GEN",
    slug: "scanfrost-15hp-genmate-inverter-split-ac",
    image: "/products/ac.png",
    brand: "Scanfrost",
    name: "Scanfrost 1.5HP Genmate Inverter Split AC",
    model: "SF-AC15GENINV",
    category: "air-conditioners",
    price: 620000,
    was: 730000,
    rating: 4.6,
    reviews: 128,
    questions: 56,
    stock: 45,
    badge: "best",
    icon: "AirVent",
    tags: ["1 Year Warranty", "Installation Included"],
    hp: 1.5,
    inverter: true,
    highlights: ["1.5HP Inverter Compressor", "Energy Saving up to 60%", "Turbo Cooling", "R410A Refrigerant"],
    specs: [
      ["Cooling Capacity", "1.5 HP"],
      ["Type", "Split Air Conditioner (Inverter)"],
      ["Compressor", "Inverter Rotary"],
      ["Refrigerant", "R410A"],
      ["Energy Efficiency", "Up to 60% Energy Saving"],
      ["Cooling Mode", "Turbo / Sleep / Eco"],
      ["Air Flow", "4-Way Auto Swing"],
      ["Noise Level", "Low Noise Operation"],
      ["Power Supply", "220 \u2013 240V / 50Hz"],
      ["Warranty", "1 Year on Product"],
    ],
    description:
      "Powerful cooling. Smart inverter technology. Maximum energy savings. The Scanfrost 1.5HP Genmate Inverter Split AC delivers fast, quiet and efficient cooling with advanced energy-saving performance.",
  },
  { sku: "MD-AC15INV", slug: "midea-15hp-inverter-split-ac", image: "/products/ac.png", brand: "Midea", name: "Midea 1.5HP Inverter Split Air Conditioner", model: "MS11D-12HRFN8", category: "air-conditioners", price: 520000, was: 580000, rating: 4.6, reviews: 110, questions: 24, stock: 32, badge: "deal", icon: "AirVent", tags: ["1 Year Warranty", "Installation Included"], hp: 1.5, inverter: true },
  { sku: "LG-AC15D", slug: "lg-15hp-dual-inverter-split-ac", image: "/products/ac.png", brand: "LG", name: "LG 1.5HP Dual Inverter Split AC", model: "S4-Q12JA31B", category: "air-conditioners", price: 690000, was: null, rating: 4.7, reviews: 142, questions: 31, stock: 21, badge: "best", icon: "AirVent", tags: ["10 Year Compressor", "Installation Included"], hp: 1.5, inverter: true },
  { sku: "HS-AC20", slug: "hisense-2hp-inverter-split-ac", image: "/products/ac.png", brand: "Hisense", name: "Hisense 2.0HP Inverter Split AC", model: "AS-18TW4RXCA00", category: "air-conditioners", price: 720000, was: null, rating: 4.5, reviews: 76, questions: 12, stock: 9, badge: "new", icon: "AirVent", tags: ["1 Year Warranty", "Installation Included"], hp: 2.0, inverter: true },
  { sku: "PN-AC10", slug: "panasonic-1hp-split-ac", image: "/products/ac.png", brand: "Panasonic", name: "Panasonic 1.0HP Split AC", model: "CU-YS9WKH-8", category: "air-conditioners", price: 350000, was: null, rating: 4.5, reviews: 54, questions: 9, stock: 12, badge: null, icon: "AirVent", tags: ["1 Year Warranty"], hp: 1.0, inverter: false },
  { sku: "SS-AC20WF", slug: "samsung-2hp-windfree-premium-ac", image: "/products/ac.png", brand: "Samsung", name: "Samsung 2.0HP Wind-Free Premium AC", model: "AR18TYFACWK", category: "air-conditioners", price: 885000, was: 960000, rating: 4.6, reviews: 88, questions: 17, stock: 14, badge: "deal", icon: "AirVent", tags: ["1 Year Warranty", "Installation Included"], hp: 2.0, inverter: true },
  { sku: "SF-FZ350", slug: "scanfrost-350l-chest-freezer", image: "/products/ref.png", brand: "Scanfrost", name: "Scanfrost 350L Chest Freezer", model: "SFC-350L", category: "refrigerators-freezers", price: 265500, was: 295000, rating: 4.4, reviews: 86, questions: 14, stock: 8, badge: "deal", icon: "Package", tags: ["1 Year Warranty"], litres: 350, doors: 1 },
  { sku: "SS-TV55UHD", slug: "samsung-55-4k-uhd-smart-tv", image: "/products/tv.png", brand: "Samsung", name: 'Samsung 55" 4K UHD Smart TV', model: "UA55AU7000", category: "televisions-audio", price: 750000, was: null, rating: 4.7, reviews: 210, questions: 44, stock: 25, badge: "new", icon: "Tv", tags: ["2 Year Warranty"] },
  { sku: "KW-BL15", slug: "kenwood-15l-blender", image: "/products/blender.png", brand: "Kenwood", name: "Kenwood 1.5L Blender", model: "BLP41.A0WH", category: "kitchen-appliances", price: 78500, was: null, rating: 4.5, reviews: 64, questions: 8, stock: 60, badge: null, icon: "Blend", tags: ["1 Year Warranty"] },
  { sku: "MD-WM8KG", slug: "midea-8kg-front-load-washing-machine", image: "/products/washing_machine.png", brand: "Midea", name: "Midea 8kg Front Load Washing Machine", model: "MFL-8KG", category: "washing-machines", price: 585000, was: null, rating: 4.6, reviews: 93, questions: 19, stock: 30, badge: null, icon: "WashingMachine", tags: ["2 Year Warranty"] },
  { sku: "MD-RF207", slug: "midea-207l-top-freezer-refrigerator", image: "/products/ref.png", brand: "Midea", name: "Midea 207L Top Freezer Refrigerator", model: "HD-273F", category: "refrigerators-freezers", price: 285000, was: 320000, rating: 4.5, reviews: 68, questions: 11, stock: 18, badge: "deal", icon: "Refrigerator", tags: ["1 Year Warranty"], litres: 207, doors: 2 },
  { sku: "HS-RF550", slug: "hisense-550l-side-by-side-refrigerator", image: "/products/sbs_ref.png", brand: "Hisense", name: "Hisense 550L Side-by-Side Refrigerator", model: "HIS-550SS", category: "refrigerators-freezers", price: 1330000, was: 1450000, rating: 4.6, reviews: 118, questions: 22, stock: 6, badge: "deal", icon: "Refrigerator", tags: ["2 Year Warranty"], litres: 550, doors: 2 },
  { sku: "SF-GC6060", slug: "scanfrost-60x60-gas-cooker", image: "/products/cooker.png", brand: "Scanfrost", name: "Scanfrost 60x60 Gas Cooker", model: "SFC 6060GB", category: "small-appliances", price: 420000, was: null, rating: 4.5, reviews: 77, questions: 11, stock: 18, badge: null, icon: "CookingPot", tags: ["1 Year Warranty"] },
  { sku: "KW-IR2200", slug: "kenwood-2200w-steam-iron", image: "/products/cooker.png", brand: "Kenwood", name: "Kenwood 2200W Steam Iron", model: "STP70.000WB", category: "small-appliances", price: 45000, was: 52000, rating: 4.4, reviews: 38, questions: 4, stock: 45, badge: "deal", icon: "CookingPot", tags: ["1 Year Warranty"] },
  { sku: "MD-FN16", slug: "midea-16-inch-stand-fan", image: "/products/cooker.png", brand: "Midea", name: 'Midea 16" Stand Fan', model: "FS40-12K", category: "small-appliances", price: 38000, was: 45000, rating: 4.3, reviews: 52, questions: 6, stock: 40, badge: "deal", icon: "CookingPot", tags: ["1 Year Warranty"] },
  { sku: "BT-ST2000", slug: "binatone-2000va-stabilizer", image: "/products/ups.png", brand: "Binatone", name: "Binatone 2000VA Stabilizer", model: "BIN-2000VA", category: "power-solutions", price: 135000, was: 150000, rating: 4.4, reviews: 52, questions: 6, stock: 40, badge: null, icon: "Zap", tags: ["1 Year Warranty"] },
  { sku: "LG-TV43LM", slug: "lg-43-full-hd-smart-tv", image: "/products/tv.png", brand: "LG", name: 'LG 43" Full HD Smart TV', model: "43LM6370PVA", category: "televisions-audio", price: 430000, was: 480000, rating: 4.5, reviews: 95, questions: 18, stock: 20, badge: "deal", icon: "Tv", tags: ["2 Year Warranty"] },
  { sku: "HS-TV55A6", slug: "hisense-55-4k-smart-tv", image: "/products/tv.png", brand: "Hisense", name: 'Hisense 55" 4K UHD Smart TV', model: "55A6H", category: "televisions-audio", price: 580000, was: null, rating: 4.4, reviews: 67, questions: 14, stock: 15, badge: null, icon: "Tv", tags: ["2 Year Warranty"] },
  { sku: "SF-RF400", slug: "scanfrost-400l-double-door-refrigerator", image: "/products/ref.png", brand: "Scanfrost", name: "Scanfrost 400L Double Door Refrigerator", model: "SFR-400", category: "refrigerators-freezers", price: 495000, was: 550000, rating: 4.5, reviews: 74, questions: 10, stock: 11, badge: "deal", icon: "Refrigerator", tags: ["1 Year Warranty"], litres: 400, doors: 2 },
  { sku: "LG-WM7KG", slug: "lg-7kg-front-load-washing-machine", image: "/products/washing_machine.png", brand: "LG", name: "LG 7kg Front Load Washing Machine", model: "FH2J3TDNP0", category: "washing-machines", price: 475000, was: null, rating: 4.6, reviews: 82, questions: 15, stock: 18, badge: null, icon: "WashingMachine", tags: ["2 Year Warranty"] },
  { sku: "SS-RF260", slug: "samsung-260l-top-freezer-refrigerator", image: "/products/ref.png", brand: "Samsung", name: "Samsung 260L Top Freezer Refrigerator", model: "RT28K3032S8", category: "refrigerators-freezers", price: 385000, was: null, rating: 4.4, reviews: 63, questions: 9, stock: 22, badge: null, icon: "Refrigerator", tags: ["1 Year Warranty"], litres: 260, doors: 2 },
  { sku: "MD-BL350", slug: "midea-350w-stand-blender", image: "/products/blender.png", brand: "Midea", name: "Midea 350W Stand Blender", model: "MBL-35G", category: "kitchen-appliances", price: 42000, was: 48000, rating: 4.3, reviews: 45, questions: 5, stock: 55, badge: "deal", icon: "Blend", tags: ["1 Year Warranty"] },
  { sku: "SF-AC10", slug: "scanfrost-1hp-split-ac", image: "/products/ac.png", brand: "Scanfrost", name: "Scanfrost 1.0HP Split Air Conditioner", model: "SF-AC10SPL", category: "air-conditioners", price: 285000, was: 320000, rating: 4.4, reviews: 96, questions: 20, stock: 35, badge: "deal", icon: "AirVent", tags: ["1 Year Warranty", "Installation Included"], hp: 1.0, inverter: false },
  { sku: "PN-MW25", slug: "panasonic-25l-microwave-oven", image: "/products/cooker.png", brand: "Panasonic", name: "Panasonic 25L Microwave Oven", model: "NN-ST34HM", category: "small-appliances", price: 115000, was: null, rating: 4.5, reviews: 58, questions: 7, stock: 30, badge: "new", icon: "CookingPot", tags: ["1 Year Warranty"] },
  { sku: "BT-FN16", slug: "binatone-16-inch-standing-fan", image: "/products/ups.png", brand: "Binatone", name: 'Binatone 16" Standing Fan', model: "TS-1600", category: "small-appliances", price: 32000, was: 38000, rating: 4.2, reviews: 120, questions: 4, stock: 70, badge: "deal", icon: "Zap", tags: ["1 Year Warranty"] },
  { sku: "KW-FP300", slug: "kenwood-food-processor", image: "/products/blender.png", brand: "Kenwood", name: "Kenwood Multi-Pro Food Processor", model: "FDP65.400WH", category: "kitchen-appliances", price: 195000, was: null, rating: 4.6, reviews: 42, questions: 6, stock: 14, badge: "best", icon: "Blend", tags: ["2 Year Warranty"] },
  { sku: "SF-WM6KG", slug: "scanfrost-6kg-twin-tub-washing-machine", image: "/products/washing_machine.png", brand: "Scanfrost", name: "Scanfrost 6kg Twin Tub Washing Machine", model: "SFWMTTD", category: "washing-machines", price: 165000, was: 185000, rating: 4.3, reviews: 55, questions: 8, stock: 25, badge: "deal", icon: "WashingMachine", tags: ["1 Year Warranty"] },
  { sku: "LG-UPS2K", slug: "lg-2kva-ups-inverter", image: "/products/ups.png", brand: "LG", name: "LG 2KVA Online UPS", model: "EA902S", category: "power-solutions", price: 280000, was: null, rating: 4.5, reviews: 34, questions: 5, stock: 10, badge: "new", icon: "Zap", tags: ["2 Year Warranty"] },
];

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