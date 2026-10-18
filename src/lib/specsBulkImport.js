import Papa from "papaparse";
import { supabase } from "./supabaseClient.js";

export const MAX_SPEC_SLOTS = 12;

export const SUBCATEGORY_INFERENCE_RULES = [
  /* ---- WASHING MACHINES ---- */
  { category: "washing-machines", test: (n) => n.includes("washer dryer") || n.includes("washer-dryer"), subcategory: "washer-dryer" },
  { category: "washing-machines", test: (n) => n.includes("twin tub") || n.includes("semi-automatic") || n.includes("semi automatic"), subcategory: "twin-tub" },
  { category: "washing-machines", test: (n) => n.includes("front load") || n.includes("front-load"), subcategory: "front-load" },

  /* ---- REFRIGERATORS & FREEZERS ---- */
  { category: "refrigerators-freezers", test: (n) => n.includes("chest freezer"),       subcategory: "chest-freezer" },
  { category: "refrigerators-freezers", test: (n) => n.includes("upright freezer"),     subcategory: "upright-freezer" },
  { category: "refrigerators-freezers", test: (n) => n.includes("bottle cooler") || n.includes("beverage cooler"), subcategory: "bottle-cooler" },
  { category: "refrigerators-freezers", test: (n) => n.includes("wine cooler") || n.includes("wine chiller"), subcategory: "wine-cooler" },
  { category: "refrigerators-freezers", test: (n) => n.includes("side-by-side") || n.includes("side by side"), subcategory: "side-by-side" },
  { category: "refrigerators-freezers", test: (n) => n.includes("double door"),         subcategory: "double-door" },
  { category: "refrigerators-freezers", test: (n) => n.includes("top mount") || n.includes("top-mount"), subcategory: "top-mount" },
  { category: "refrigerators-freezers", test: (n) => n.includes("bottom mount") || n.includes("bottom-mount") || n.includes("bottom freezer"), subcategory: "bottom-mount" },
  { category: "refrigerators-freezers", test: (n) => n.includes("single door") || n.includes("bar fridge") || n.includes("mini fridge"), subcategory: "single-door" },

  /* ---- AIR CONDITIONERS ---- */
  { category: "air-conditioners", test: (n) => n.includes("portable"),                  subcategory: "portable" },
  { category: "air-conditioners", test: (n) => n.includes("window"),                    subcategory: "window" },
  { category: "air-conditioners", test: (n) => n.includes("floor standing") || n.includes("floor-standing"), subcategory: "floor-standing" },
  { category: "air-conditioners", test: (n) => n.includes("cassette"),                  subcategory: "cassette" },
  { category: "air-conditioners", test: (n) => n.includes("indoor unit"),               subcategory: "indoor-unit-only" },
  { category: "air-conditioners", test: (n) => n.includes("inverter"),                  subcategory: "inverter-split" },
  { category: "air-conditioners", test: (n) => n.includes("fixed-speed") || n.includes("fixed speed") || n.includes("non-inverter"), subcategory: "fixed-split" },

  /* ---- TELEVISIONS & AUDIO ---- */
  { category: "televisions-audio", test: (n) => n.includes("soundbar"),                 subcategory: "soundbar" },
  { category: "televisions-audio", test: (n) => n.includes("home theatre") || n.includes("home theater"), subcategory: "home-theatre" },
  { category: "televisions-audio", test: (n) => n.includes("speaker") || n.includes("subwoofer"), subcategory: "speaker" },
  { category: "televisions-audio", test: (n) => n.includes("projector"),                subcategory: "projector" },
  { category: "televisions-audio", test: (n) => n.includes("oled"),                     subcategory: "oled-tv" },
  { category: "televisions-audio", test: (n) => n.includes("qled"),                     subcategory: "qled-tv" },
  { category: "televisions-audio", test: (n) => n.includes("mini led") || n.includes("mini-led"), subcategory: "mini-led-tv" },
  { category: "televisions-audio", test: (n) => n.includes("4k") || n.includes("uhd"),  subcategory: "4k-uhd-tv" },
  { category: "televisions-audio", test: (n) => n.includes("full hd") || n.includes("fhd") || n.includes("1080"), subcategory: "full-hd-tv" },

  /* ---- KITCHEN APPLIANCES ---- */
  { category: "kitchen-appliances", test: (n) => n.includes("microwave"),               subcategory: "microwave" },
  { category: "kitchen-appliances", test: (n) => n.includes("airfryer") || n.includes("air fryer") || n.includes("air-fryer"), subcategory: "airfryer" },
  { category: "kitchen-appliances", test: (n) => n.includes("oven"),                    subcategory: "oven" },
  { category: "kitchen-appliances", test: (n) => n.includes("cooker") || n.includes("stove") || n.includes("hob"), subcategory: "cooker" },
  { category: "kitchen-appliances", test: (n) => n.includes("extractor") || n.includes("cooker hood") || n.includes("range hood"), subcategory: "extractor" },
  { category: "kitchen-appliances", test: (n) => n.includes("dishwasher"),              subcategory: "dishwasher" },
  { category: "kitchen-appliances", test: (n) => n.includes("blender") || n.includes("blm") || n.includes("blp") || n.includes("bsp"), subcategory: "blender" },
  { category: "kitchen-appliances", test: (n) => n.includes("hand blender") || n.includes("hbm") || n.includes("hbp"), subcategory: "hand-blender" },
  { category: "kitchen-appliances", test: (n) => n.includes("food processor") || n.includes("fdp"), subcategory: "food-processor" },
  { category: "kitchen-appliances", test: (n) => n.includes("mixer") || n.includes("stand mixer"), subcategory: "stand-mixer" },

  /* ---- SMALL APPLIANCES ---- */
  { category: "small-appliances", test: (n) => n.includes("coffee maker") || n.includes("espresso") || n.includes("coffee machine") || n.includes("ecam") || n.includes("ec685") || n.includes("ec230") || n.includes("ec9255") || n.includes("cmm"), subcategory: "coffee-espresso" },
  { category: "small-appliances", test: (n) => n.includes("garment steamer") || n.includes("gsp"), subcategory: "garment-steamer" },
  { category: "small-appliances", test: (n) => n.includes("steam iron") || n.includes("iron"),    subcategory: "iron" },
  { category: "small-appliances", test: (n) => n.includes("kettle"),                    subcategory: "kettle" },
  { category: "small-appliances", test: (n) => n.includes("toaster"),                   subcategory: "toaster" },
  { category: "small-appliances", test: (n) => n.includes("hand mixer") || n.includes("stand mixer") || /\bhm\s?\d/.test(n), subcategory: "hand-mixer" },
  { category: "small-appliances", test: (n) => n.includes("fan ") || n.endsWith("fan") || n.includes("ceiling fan") || n.includes("standing fan"), subcategory: "fan" },
  { category: "small-appliances", test: (n) => n.includes("vacuum"),                    subcategory: "vacuum-cleaner" },
  { category: "small-appliances", test: (n) => n.includes("hair dryer") || n.includes("hairdryer") || n.includes("hair clipper") || n.includes("shaver") || n.includes("trimmer"), subcategory: "personal-care" },

  /* ---- POWER SOLUTIONS ---- */
  { category: "power-solutions", test: (n) => n.includes("generator"),                   subcategory: "generator" },
  { category: "power-solutions", test: (n) => n.includes("inverter") && !n.includes("air"), subcategory: "inverter" },
  { category: "power-solutions", test: (n) => n.includes("stabilizer") || n.includes("stabiliser"), subcategory: "stabilizer" },
  { category: "power-solutions", test: (n) => n.includes("ups") || n.includes("uninterruptible"), subcategory: "ups" },
  { category: "power-solutions", test: (n) => n.includes("battery"),                     subcategory: "battery" },
  { category: "power-solutions", test: (n) => n.includes("solar"),                       subcategory: "solar" },
];

export const SUBCATEGORY_DEFAULTS = {
  "washing-machines":        "top-load",
  "refrigerators-freezers":  "top-mount",
  "air-conditioners":        "split",
  "televisions-audio":       "other-tv",
  "kitchen-appliances":      "other",
  "small-appliances":        "other",
  "power-solutions":         "other",
};

export const CATEGORIES_WITH_SUBCATEGORIES = [
  "washing-machines",
  "refrigerators-freezers",
  "air-conditioners",
  "televisions-audio",
  "kitchen-appliances",
  "small-appliances",
  "power-solutions",
];

export const ALL_SUBCATEGORY = "all";

export function inferSubCategory(dbCategory, productName) {
  const nameLower = String(productName || "").toLowerCase();
  for (const rule of SUBCATEGORY_INFERENCE_RULES) {
    if (rule.category === dbCategory && rule.test(nameLower)) {
      return rule.subcategory;
    }
  }
  return SUBCATEGORY_DEFAULTS[dbCategory] || null;
}

export function getSubCategoriesForCategory(dbCategory) {
  const subs = new Set();
  subs.add(ALL_SUBCATEGORY);
  SUBCATEGORY_INFERENCE_RULES
    .filter((r) => r.category === dbCategory)
    .forEach((r) => subs.add(r.subcategory));
  const defaultSub = SUBCATEGORY_DEFAULTS[dbCategory];
  if (defaultSub) subs.add(defaultSub);
  return Array.from(subs);
}

export function hasSubCategories(dbCategory) {
  return CATEGORIES_WITH_SUBCATEGORIES.includes(dbCategory);
}

export function filterProductsBySubCategory(products, dbCategory, subcategory) {
  if (!products) return [];
  if (!subcategory || !hasSubCategories(dbCategory)) return products;
  if (subcategory === ALL_SUBCATEGORY) return products;

  return products.filter(
    (p) => inferSubCategory(dbCategory, p.name) === subcategory
  );
}

export function generateTemplateCsv(products) {
  const sorted = [...(products || [])].sort((a, b) => {
    const brandCmp = (a.brand || "").toLowerCase().localeCompare((b.brand || "").toLowerCase());
    if (brandCmp !== 0) return brandCmp;
    return (a.name || "").localeCompare(b.name || "");
  });

  const header = [
    "sku", "name", "brand",
    "current_description", "new_description",
    "current_highlights", "new_highlights",
  ];
  for (let i = 1; i <= MAX_SPEC_SLOTS; i++) {
    header.push(
      `current_spec_${i}_label`,
      `current_spec_${i}_value`,
      `new_spec_${i}_label`,
      `new_spec_${i}_value`,
    );
  }

  const rows = sorted.map((p) => {
    const specs = Array.isArray(p.specs) ? p.specs : [];
    const currentHighlights = highlightsArrayToPipeString(p.highlights);
    const currentDescription = p.description || "";

    const row = [
      p.sku, p.name || "", p.brand || "",
      currentDescription, currentDescription,
      currentHighlights, currentHighlights,
    ];

    for (let i = 0; i < MAX_SPEC_SLOTS; i++) {
      const spec = specs[i];
      const label = (spec && typeof spec === "object" && spec.label != null) ? String(spec.label) : "";
      const value = (spec && typeof spec === "object" && spec.value != null) ? String(spec.value) : "";
      row.push(label, value, label, value);
    }

    return row;
  });

  return Papa.unparse([header, ...rows]);
}

export function parseCsvFile(file) {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => (h || "").trim().toLowerCase(),
      transform: (v) => (v == null ? "" : String(v)),
      complete: (result) => {
        const rows = result.data || [];
        const errors = result.errors || [];
        const gotHeaders = Object.keys(rows[0] || {});

        if (!gotHeaders.includes("sku")) {
          resolve({
            ok: false,
            rows: [],
            errors: [{ message: "CSV is missing required column: sku" }],
          });
          return;
        }

        resolve({ ok: true, rows, errors });
      },
      error: (err) => resolve({ ok: false, rows: [], errors: [{ message: err.message }] }),
    });
  });
}

export function validateRows(rows, refs) {
  const { productsBySku } = refs;
  const seenInCsv = new Map();

  const rowsWithVerdict = rows.map((row, idx) => {
    const errors = [];
    const changes = [];
    const warnings = [];

    const sku = String(row.sku || "").trim();
    if (!sku) {
      errors.push("SKU is required");
    } else if (seenInCsv.has(sku)) {
      errors.push(`Duplicate SKU in this CSV (also on row ${seenInCsv.get(sku) + 2})`);
    } else {
      seenInCsv.set(sku, idx);
      if (!productsBySku.has(sku)) {
        errors.push(`SKU "${sku}" doesn't exist in this sub-category. Check the SKU or switch to "All".`);
      }
    }

    const current = productsBySku.get(sku);
    const resolved = {
      sku,
      updates: {},
      descriptionChanged: false,
      highlightsChanged: false,
      specsChanged: false,
      specsAddedCount: 0,
      specsChangedCount: 0,
      specsRemovedCount: 0,
      descriptionLength: 0,
    };

    if (current) {
      const newDesc = String(row.new_description || "").trim();
      const curDesc = String(current.description || "").trim();
      resolved.descriptionLength = newDesc.length;

      if (newDesc !== "" && newDesc !== curDesc) {
        resolved.updates.description = newDesc;
        resolved.descriptionChanged = true;
        changes.push("description");
        if (curDesc.length > 60) {
          warnings.push(`description overwrites existing ${curDesc.length}-char content`);
        }
      }

      const newHighlightsRaw = String(row.new_highlights || "").trim();
      const curHighlightsArr = Array.isArray(current.highlights) ? current.highlights : [];
      const curHighlightsStr = highlightsArrayToPipeString(curHighlightsArr);

      if (newHighlightsRaw !== "" && newHighlightsRaw !== curHighlightsStr) {
        const newHighlightsArr = pipeStringToHighlightsArray(newHighlightsRaw);
        resolved.updates.highlights = newHighlightsArr;
        resolved.highlightsChanged = true;
        changes.push("highlights");
        if (curHighlightsArr.length > 0) {
          warnings.push(`highlights overwrites existing ${curHighlightsArr.length} bullet(s)`);
        }
      }

      const curSpecs = Array.isArray(current.specs) ? current.specs : [];
      const newSpecs = [];
      let slotErrors = 0;

      for (let i = 1; i <= MAX_SPEC_SLOTS; i++) {
        const label = String(row[`new_spec_${i}_label`] || "").trim();
        const value = String(row[`new_spec_${i}_value`] || "").trim();

        if (label === "" && value === "") continue;
        if (label === "" && value !== "") {
          errors.push(`Spec slot ${i}: value "${value}" has no label`);
          slotErrors++;
          continue;
        }
        if (label !== "" && value === "") {
          errors.push(`Spec slot ${i}: label "${label}" has no value`);
          slotErrors++;
          continue;
        }

        newSpecs.push({ label, value });
      }

      // Specs past the last template slot can't be seen or edited in the
      // CSV, so carry them over untouched rather than deleting them.
      curSpecs.slice(MAX_SPEC_SLOTS).forEach((s) => {
        if (s && typeof s === "object" && s.label) {
          newSpecs.push({ label: String(s.label), value: String(s.value ?? "") });
        }
      });

      const labelCounts = {};
      newSpecs.forEach((s) => {
        const key = s.label.toLowerCase().trim();
        labelCounts[key] = (labelCounts[key] || 0) + 1;
      });
      Object.entries(labelCounts).forEach(([key, count]) => {
        if (count > 1) {
          errors.push(`Spec label "${key}" appears ${count} times — labels must be unique within a product`);
        }
      });

      if (slotErrors === 0 && !specsEqual(curSpecs, newSpecs)) {
        resolved.updates.specs = newSpecs;
        resolved.specsChanged = true;
        changes.push("specs");

        const curLabelMap = new Map();
        curSpecs.forEach((s) => {
          if (s && typeof s === "object" && s.label) {
            curLabelMap.set(normalizeLabel(s.label), String(s.value || ""));
          }
        });
        const newLabelMap = new Map();
        newSpecs.forEach((s) => {
          newLabelMap.set(normalizeLabel(s.label), s.value);
        });

        curLabelMap.forEach((val, labelKey) => {
          if (!newLabelMap.has(labelKey)) {
            resolved.specsRemovedCount++;
            warnings.push(`spec removed (previously existed)`);
          }
        });

        newLabelMap.forEach((val, labelKey) => {
          if (!curLabelMap.has(labelKey)) {
            resolved.specsAddedCount++;
          } else if (curLabelMap.get(labelKey) !== val) {
            resolved.specsChangedCount++;
            if (curLabelMap.get(labelKey) !== "") {
              warnings.push(`spec value changed (previously had non-empty value)`);
            }
          }
        });
      }
    }

    let verdict;
    if (errors.length > 0) {
      verdict = "error";
    } else if (changes.length === 0) {
      verdict = "unchanged";
    } else if (warnings.length > 0) {
      verdict = "warning";
    } else {
      verdict = "update";
    }

    return { rowIndex: idx, row, verdict, errors, warnings, changes, resolved };
  });

  const summary = {
    total:     rowsWithVerdict.length,
    update:    rowsWithVerdict.filter((r) => r.verdict === "update").length,
    warning:   rowsWithVerdict.filter((r) => r.verdict === "warning").length,
    unchanged: rowsWithVerdict.filter((r) => r.verdict === "unchanged").length,
    error:     rowsWithVerdict.filter((r) => r.verdict === "error").length,
    descChanged:  rowsWithVerdict.filter((r) => r.resolved.descriptionChanged).length,
    hlChanged:    rowsWithVerdict.filter((r) => r.resolved.highlightsChanged).length,
    specsChanged: rowsWithVerdict.filter((r) => r.resolved.specsChanged).length,
    specsAdded:   rowsWithVerdict.reduce((sum, r) => sum + r.resolved.specsAddedCount, 0),
    specsRemoved: rowsWithVerdict.reduce((sum, r) => sum + r.resolved.specsRemovedCount, 0),
  };

  return { rowsWithVerdict, summary };
}

export async function commitRows(rowsWithVerdict, { includeWarnings = true, onProgress } = {}) {
  const committable = rowsWithVerdict.filter((r) =>
    r.verdict === "update" || (includeWarnings && r.verdict === "warning")
  );

  let updated = 0;
  const errors = [];

  for (let i = 0; i < committable.length; i++) {
    const item = committable[i];
    try {
      const { error } = await supabase
        .from("products")
        .update(item.resolved.updates)
        .eq("sku", item.resolved.sku);
      if (error) {
        errors.push({
          rowIndex: item.rowIndex,
          sku: item.resolved.sku,
          message: error.message,
        });
      } else {
        updated++;
      }
    } catch (err) {
      errors.push({
        rowIndex: item.rowIndex,
        sku: item.resolved.sku,
        message: err.message || String(err),
      });
    }
    if (onProgress) onProgress(i + 1, committable.length);
    await new Promise((r) => setTimeout(r, 30));
  }

  return { updated, errors };
}

// Compare labels on letters and digits only. NFKC folds full-width
// brackets ("（KG）") to ASCII first; dropping everything else means
// "Motor power(W)", "Motor Power (W)" and "Max. Spin Speed" all match
// their template spelling regardless of spacing or punctuation.
function normalizeLabel(label) {
  return String(label || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function specsEqual(a, b) {
  const normA = (Array.isArray(a) ? a : [])
    .filter((s) => s && typeof s === "object" && s.label)
    .map((s) => ({ label: String(s.label || ""), value: String(s.value || "") }));
  const normB = (Array.isArray(b) ? b : [])
    .filter((s) => s && typeof s === "object" && s.label)
    .map((s) => ({ label: String(s.label || ""), value: String(s.value || "") }));

  if (normA.length !== normB.length) return false;
  for (let i = 0; i < normA.length; i++) {
    if (normA[i].label !== normB[i].label) return false;
    if (normA[i].value !== normB[i].value) return false;
  }
  return true;
}

function highlightsArrayToPipeString(highlights) {
  if (!Array.isArray(highlights)) return "";
  return highlights
    .filter((h) => h != null && String(h).trim() !== "")
    .map((h) => String(h).trim())
    .join(" | ");
}

function pipeStringToHighlightsArray(str) {
  if (!str) return [];
  return str
    .split(/\s*\|\s*/)
    .map((s) => s.trim())
    .filter((s) => s !== "");
}
