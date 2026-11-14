/**
 * Build-time SEO (runs after `vite build`; see package.json).
 *
 * Social crawlers (WhatsApp, Facebook, X, LinkedIn) don't run
 * JavaScript, so every shareable page gets its own HTML file whose
 * <head> already holds the title, description, canonical, Open Graph /
 * Twitter tags and JSON-LD. The tags come from the SAME functions the
 * React pages use (src/lib/seo/pageMeta.js + headTags.js), and carry
 * data-rh="true" so React Helmet takes them over instead of
 * duplicating them. The <body> is the normal app.
 *
 * Writes into dist/:
 *   index.html                        home
 *   <static>.html                     /about, /deals, /services/installation, …
 *   category/<id>.html                every category
 *   brand/<id>.html                   every brand with active products
 *   product/<slug>.html               every ACTIVE product
 *   _app.html                         SPA fallback (generic head, no canonical)
 *   404.html                          noindex shell, served with HTTP 404 for
 *                                     unknown /product/*, /category/*, /brand/*
 *   sitemap.xml                       indexable URLs, lastmod from updated_at
 *   feeds/google-products.xml         Google Merchant Center feed
 *
 * Data: Supabase REST with the public (anon) key, read-only. Ratings
 * come only from approved reviews (products.rating/reviews are
 * computed from approved reviews; review text via the public RPC).
 *
 * Fails the build (exit 1) when the catalogue can't be loaded: Netlify
 * then keeps the previous deploy live instead of publishing a site
 * whose product pages would all 404.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { canonicalBrandResolver } from "../src/lib/brandNames.js";
import { headTags } from "../src/lib/seo/headTags.js";
import { STATIC_META, brandMeta, categoryMeta, homeMeta, productMeta } from "../src/lib/seo/pageMeta.js";
import { SITE_URL } from "../src/lib/seo/defaults.js";
import { absoluteUrl, plainText, productImageUrls } from "../src/lib/seo/structuredData.js";

const DIST = resolve("dist");

/* ---------- env (.env fills gaps for local builds; real env wins) ---------- */
if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf-8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const ANON = process.env.VITE_SUPABASE_ANON_KEY;

function fail(msg) {
  console.error(`[seo] ${msg}`);
  console.error("[seo] Build stopped so the previous (working) deploy stays live.");
  process.exit(1);
}

async function rest(path, { method = "GET", body } = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: ANON, Authorization: `Bearer ${ANON}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${method} ${path.split("?")[0]} → HTTP ${res.status} ${data?.message || ""}`);
  return data;
}

/* ---------- HTML helpers ---------- */
const escAttr = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escText = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// JSON inside <script>: neutralise "</script>" and HTML comments.
const safeJson = (o) => JSON.stringify(o).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");

function headHtml(tags, extra = []) {
  const lines = [
    `<title>${escText(tags.title)}</title>`,
    ...tags.metas.map((m) => (m.name
      ? `<meta name="${escAttr(m.name)}" content="${escAttr(m.content)}" data-rh="true" />`
      : `<meta property="${escAttr(m.property)}" content="${escAttr(m.content)}" data-rh="true" />`)),
    ...tags.links.map((l) => `<link rel="${escAttr(l.rel)}" href="${escAttr(l.href)}" data-rh="true" />`),
    ...tags.jsonLd.map((j) => `<script type="application/ld+json" data-rh="true">${safeJson(j)}</script>`),
    ...extra,
  ];
  return lines.map((l) => `    ${l}`).join("\n");
}

const SEO_START = "<!--seo-->";
const SEO_END = "<!--/seo-->";

/** Template = built index.html with its generic title/description removed. */
function makeTemplate(html) {
  const cleaned = html
    .replace(/\s*<title>[\s\S]*?<\/title>/i, "")
    .replace(/\s*<meta\s+name="description"[^>]*>/i, "");
  const anchor = cleaned.match(/<meta\s+name="viewport"[^>]*>/i);
  if (!anchor) fail("dist/index.html has no viewport meta to anchor the SEO tags");
  const at = anchor.index + anchor[0].length;
  return (head) => `${cleaned.slice(0, at)}\n    ${SEO_START}\n${head}\n    ${SEO_END}${cleaned.slice(at)}`;
}

function write(relPath, content) {
  const full = join(DIST, relPath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content, "utf-8");
}

/* ---------- sitemap + feed ---------- */
const xmlEsc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;")
  // eslint-disable-next-line no-control-regex
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
const day = (iso) => (iso ? String(iso).slice(0, 10) : null);
const maxDate = (list) => list.filter(Boolean).sort().pop() || null;

function sitemapXml(entries) {
  const urls = entries.map(({ path, lastmod }) => [
    "  <url>",
    `    <loc>${xmlEsc(`${SITE_URL}${path}`)}</loc>`,
    lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
    "  </url>",
  ].filter(Boolean).join("\n"));
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
}

/** Google Merchant Center RSS 2.0 feed. Only active products with a price and an image. */
function merchantFeed(products, categoryLabel) {
  const items = [];
  for (const p of products) {
    const price = Number(p.price);
    const images = productImageUrls(p);
    if (!(price > 0) || !images.length) continue;
    const was = Number(p.was);
    const onSale = was > price;
    const fmt = (n) => `${n.toFixed(2)} NGN`;
    const description = plainText(p.description) || `${p.name}${p.brand ? ` by ${p.brand}` : ""}.`;
    items.push([
      "    <item>",
      `      <g:id>${xmlEsc(p.sku)}</g:id>`,
      `      <g:title>${xmlEsc(String(p.name).slice(0, 150))}</g:title>`,
      `      <g:description>${xmlEsc(description.slice(0, 5000))}</g:description>`,
      `      <g:link>${xmlEsc(`${SITE_URL}/product/${p.slug}`)}</g:link>`,
      `      <g:image_link>${xmlEsc(images[0])}</g:image_link>`,
      ...images.slice(1, 11).map((u) => `      <g:additional_image_link>${xmlEsc(u)}</g:additional_image_link>`),
      `      <g:availability>${Number(p.stock) > 0 ? "in_stock" : "out_of_stock"}</g:availability>`,
      `      <g:price>${fmt(onSale ? was : price)}</g:price>`,
      ...(onSale ? [`      <g:sale_price>${fmt(price)}</g:sale_price>`] : []),
      `      <g:condition>new</g:condition>`,
      ...(p.brand ? [`      <g:brand>${xmlEsc(p.brand)}</g:brand>`] : []),
      ...(p.model ? [`      <g:mpn>${xmlEsc(p.model)}</g:mpn>`] : []),
      ...(categoryLabel(p.category) ? [`      <g:product_type>${xmlEsc(categoryLabel(p.category))}</g:product_type>`] : []),
      "    </item>",
    ].join("\n"));
  }
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">',
    "  <channel>",
    "    <title>NAVEN — The Premium Electronics</title>",
    `    <link>${SITE_URL}</link>`,
    "    <description>NAVEN product feed for Google Merchant Center</description>",
    ...items,
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");
  return { xml, count: items.length };
}

/* ---------- main ---------- */
async function main() {
  if (!existsSync(join(DIST, "index.html"))) fail("dist/index.html not found: run vite build first");
  if (!SUPABASE_URL || !ANON) fail("VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set");

  let rawProducts, categories, brands;
  try {
    [rawProducts, categories, brands] = await Promise.all([
      rest("products?select=sku,slug,name,brand,model,category,image,gallery,price,was,stock,status,rating,reviews,description,updated_at&order=sku.asc"),
      rest("categories?select=*"),
      rest("brands?select=id,name,logo"),
    ]);
  } catch (err) {
    fail(`could not load the catalogue from Supabase: ${err.message}`);
  }
  if (!Array.isArray(rawProducts) || rawProducts.length === 0) fail("Supabase returned 0 products");

  const canonical = canonicalBrandResolver(brands, rawProducts);
  const products = rawProducts
    .filter((p) => p.status !== "inactive" && p.slug)
    .map((p) => ({ ...p, brand: canonical(p.brand), price: Number(p.price), was: p.was == null ? null : Number(p.was) }));
  const catById = new Map(categories.map((c) => [c.id, c]));
  const categoryLabel = (id) => catById.get(id)?.label || null;

  // Approved reviews for structured data (only products that have some).
  const reviewData = new Map();
  for (const p of products.filter((x) => Number(x.reviews) > 0)) {
    try {
      const [summary] = await rest("rpc/product_review_summary", { method: "POST", body: { p_sku: p.sku } });
      const top = await rest("rpc/product_reviews_public", { method: "POST", body: { p_sku: p.sku, p_limit: 5, p_offset: 0, p_rating: null, p_sort: "newest" } });
      reviewData.set(p.sku, {
        summary: { average: Number(summary?.average) || 0, total: Number(summary?.total) || 0 },
        reviews: (top || []).map((r) => ({ author: r.author, rating: Number(r.rating), createdAt: r.created_at, title: r.title, body: r.body })),
      });
    } catch (err) {
      console.warn(`[seo] reviews for ${p.sku} skipped: ${err.message}`);
    }
  }

  const render = makeTemplate(readFileSync(join(DIST, "index.html"), "utf-8"));
  const sitemap = [];
  let pages = 0;

  // SPA fallback + 404 shells (no canonical / og:url: they serve many URLs)
  const generic = headTags({});
  generic.links = [];
  generic.metas = generic.metas.filter((m) => m.property !== "og:url");
  write("_app.html", render(headHtml(generic)));
  write("404.html", render(headHtml(headTags({ title: "Page not found", noindex: true }))));

  // Home
  write("index.html", render(headHtml(headTags(homeMeta()))));
  sitemap.push({ path: "/", lastmod: day(maxDate(products.map((p) => p.updated_at))) });
  pages++;

  // Static pages
  for (const [path, meta] of Object.entries(STATIC_META)) {
    write(`${path.slice(1)}.html`, render(headHtml(headTags({ ...meta, url: path }))));
    sitemap.push({ path, lastmod: null });
    pages++;
  }

  // Categories
  for (const c of categories) {
    const list = products.filter((p) => p.category === c.id);
    write(`category/${c.id}.html`, render(headHtml(headTags(categoryMeta(c, list)))));
    sitemap.push({ path: `/category/${c.id}`, lastmod: day(maxDate(list.map((p) => p.updated_at))) });
    pages++;
  }

  // Brands (only those with active products)
  let brandPages = 0;
  for (const b of brands) {
    const list = products.filter((p) => String(p.brand).toLowerCase() === String(b.name).toLowerCase())
      .map((p) => ({ ...p, categoryLabel: categoryLabel(p.category) }));
    if (!list.length) continue;
    write(`brand/${b.id}.html`, render(headHtml(headTags(brandMeta(b, list)))));
    sitemap.push({ path: `/brand/${b.id}`, lastmod: day(maxDate(list.map((p) => p.updated_at))) });
    pages++; brandPages++;
  }

  // Products
  for (const p of products) {
    const meta = productMeta(p, { category: catById.get(p.category) || null, reviewData: reviewData.get(p.sku) || {} });
    const lcp = absoluteUrl(p.image);
    const preload = lcp ? [`<link rel="preload" as="image" href="${escAttr(lcp)}" fetchpriority="high" />`] : [];
    write(`product/${p.slug}.html`, render(headHtml(headTags(meta), preload)));
    sitemap.push({ path: `/product/${p.slug}`, lastmod: day(p.updated_at) });
    pages++;
  }

  write("sitemap.xml", sitemapXml(sitemap));
  const feed = merchantFeed(products, categoryLabel);
  write("feeds/google-products.xml", feed.xml);

  console.log(`[seo] prerendered ${pages} pages: home, ${Object.keys(STATIC_META).length} static, ${categories.length} categories, ${brandPages} brands, ${products.length} products`);
  console.log(`[seo] sitemap.xml: ${sitemap.length} URLs · feeds/google-products.xml: ${feed.count} products (of ${products.length} active; needs price + image)`);
  console.log(`[seo] products with approved reviews: ${reviewData.size}`);
}

main().catch((err) => fail(err.stack || err.message));
