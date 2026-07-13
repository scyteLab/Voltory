import { PRODUCTS, CATEGORIES, BRANDS } from "../data/products.js";

/**
 * Search engine — scored matching across product name, brand,
 * category label. Returns three result groups: products, categories,
 * brands. Replaced by Meilisearch / Postgres tsvector when the
 * backend lands; the shape of the result objects stays.
 */

/** Normalise: lowercase, collapse whitespace, strip diacritics. */
function norm(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/** Tokenise a query into useful pieces. */
function tokens(q) {
  return norm(q).split(/\s+/).filter(Boolean);
}

/**
 * Score how well a product matches a query.
 * - 100: product name starts with the full query
 * -  70: product name contains the full query as a phrase
 * -  50: product name contains every token
 * -  30: brand contains the query
 * -  20: any token is in the model / sku
 * -   0: no match
 */
function scoreProduct(product, q, qTokens) {
  const name = norm(product.name);
  const brand = norm(product.brand);
  const model = norm(product.model || "");
  const sku = norm(product.sku);

  if (name.startsWith(q)) return 100;
  if (name.includes(q)) return 70;
  if (qTokens.every((t) => name.includes(t))) return 50;
  if (brand.includes(q)) return 30;
  if (qTokens.some((t) => model.includes(t) || sku.includes(t))) return 20;
  return 0;
}

/**
 * Run a search and return three result groups. categoryScope (an
 * id from CATEGORIES) limits product matches to that category.
 */
export function search(query, { categoryScope = null, maxProducts = 6 } = {}) {
  const q = norm(query);
  if (!q) return { products: [], categories: [], brands: [], query };

  const qTokens = tokens(query);

  // Products
  const productHits = [];
  for (const p of PRODUCTS) {
    if (categoryScope && p.category !== categoryScope) continue;
    const score = scoreProduct(p, q, qTokens);
    if (score > 0) productHits.push({ product: p, score });
  }
  productHits.sort((a, b) => b.score - a.score || b.product.reviews - a.product.reviews);

  // Categories — match label
  const categoryHits = CATEGORIES.filter((c) => norm(c.label).includes(q));

  // Brands — match name
  const brandHits = BRANDS.filter((b) => norm(b.name).includes(q));

  return {
    products: productHits.slice(0, maxProducts).map((h) => h.product),
    categories: categoryHits,
    brands: brandHits,
    query: q,
    totalProductMatches: productHits.length,
  };
}

/** Build the URL for a search results page. */
export function searchUrl(query, categoryScope) {
  const sp = new URLSearchParams();
  if (query) sp.set("q", query);
  if (categoryScope) sp.set("category", categoryScope);
  return `/search?${sp.toString()}`;
}