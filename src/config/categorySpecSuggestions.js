/**
 * categorySpecSuggestions.js
 *
 * When the admin edits a product's Specifications repeater, the
 * label input offers autocomplete suggestions drawn from this
 * list based on the product's category. Purely a UX hint \u2014
 * admins can always type any label they want, and existing
 * data is never coerced.
 *
 * Keyed by the SAME category ids used in the products.category
 * column. From the earlier diagnostic, live categories include:
 *   power-solutions, small-appliances, air-conditioners,
 *   refrigerators-freezers, televisions-audio
 *
 * When you add a new category to the site, add an entry here so
 * the admin gets useful suggestions right away. If a category
 * isn't in this map, the admin still sees the DEFAULT list.
 *
 * Labels are display-cased ("Screen Size" not "screen_size")
 * because they render as-is in the product page spec table.
 * Keep them human-readable.
 */

const DEFAULT_LABELS = [
  "Colour", "Weight", "Dimensions", "Power (W)", "Voltage",
  "Country of Origin", "Model Year",
];

const BY_CATEGORY = {
  "refrigerators-freezers": [
    "Capacity (L)", "Type", "Doors", "Defrost", "Compressor",
    "Voltage", "Energy Rating", "Dimensions (HxWxD)", "Colour",
  ],
  "air-conditioners": [
    "Capacity (HP)", "Cooling Capacity (BTU)", "Type", "Inverter",
    "Refrigerant", "Energy Rating", "Voltage", "Coverage (sqm)",
    "Colour",
  ],
  "televisions-audio": [
    "Screen Size", "Resolution", "Panel Type", "Smart TV",
    "Operating System", "HDR", "Refresh Rate", "HDMI Ports",
    "USB Ports", "Bluetooth", "Sound Output (W)",
  ],
  "washing-machines": [
    "Capacity (kg)", "Type", "Spin Speed (RPM)", "Programs",
    "Energy Rating", "Voltage", "Dimensions (HxWxD)",
  ],
  "small-appliances": [
    "Power (W)", "Capacity", "Speeds", "Voltage",
    "Blade Material", "Jug Material", "Colour",
  ],
  "power-solutions": [
    "Wattage", "Voltage", "Type", "Battery Type",
    "Battery Capacity", "Runtime", "Number of Outlets",
    "Fuel Type", "Tank Capacity",
  ],
  "cooking": [
    "Burners", "Fuel Type", "Oven", "Ignition",
    "Grill", "Power (W)", "Dimensions (HxWxD)",
  ],
  "office": [
    "Type", "Print Speed", "Duplex", "Wireless",
    "Paper Size", "Power (W)",
  ],
};

/**
 * Return suggested labels for a category id. Merges the
 * category-specific list with the default list, dedupes,
 * preserving specific-first order.
 */
export function specSuggestionsFor(categoryId) {
  const specific = BY_CATEGORY[categoryId] || [];
  const seen = new Set();
  const out  = [];
  for (const label of [...specific, ...DEFAULT_LABELS]) {
    if (!seen.has(label)) {
      seen.add(label);
      out.push(label);
    }
  }
  return out;
}

/**
 * Standardized energy class options. Rendered as a select in
 * the admin. Empty string = "not rated / not declared."
 */
export const ENERGY_CLASSES = [
  "", "A+++", "A++", "A+", "A", "B", "C", "D",
];