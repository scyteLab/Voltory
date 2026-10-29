/**
 * Build-time sitemap generator.
 *
 * Runs after Vite build. Reads static page list + fetches products/brands/categories
 * from Supabase and writes dist/sitemap.xml.
 *
 * Supabase credentials read from environment (same as Vite build sees them).
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

// Local builds: plain `node` doesn't read .env the way Vite does, so pick up
// VITE_SUPABASE_* from it when present. Real environment variables (e.g. the
// Netlify dashboard) always win — this only fills in ones that are missing.
if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf-8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

const SITE_URL = "https://mynaven.com";
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

// /track-order is noindex (see SEOHead on TrackOrder.jsx), so it is not listed
// here — a sitemap should only contain pages we want indexed.
const STATIC_PAGES = [
  { path: "/", priority: "1.0", changefreq: "daily" },
  { path: "/categories", priority: "0.9", changefreq: "weekly" },
  { path: "/brands", priority: "0.9", changefreq: "weekly" },
  { path: "/new", priority: "0.9", changefreq: "daily" },
  { path: "/best-sellers", priority: "0.8", changefreq: "weekly" },
  { path: "/deals", priority: "0.8", changefreq: "daily" },
  { path: "/compare", priority: "0.5", changefreq: "monthly" },
  { path: "/help", priority: "0.6", changefreq: "monthly" },
  { path: "/contact", priority: "0.6", changefreq: "monthly" },
  { path: "/services/installation", priority: "0.7", changefreq: "monthly" },
  { path: "/about", priority: "0.6", changefreq: "monthly" },
  { path: "/careers", priority: "0.5", changefreq: "monthly" },
  { path: "/blog", priority: "0.7", changefreq: "weekly" },
  { path: "/affiliate", priority: "0.5", changefreq: "monthly" },
  { path: "/reviews-guidelines", priority: "0.5", changefreq: "monthly" },
  { path: "/terms", priority: "0.4", changefreq: "yearly" },
  { path: "/privacy", priority: "0.4", changefreq: "yearly" },
  { path: "/returns", priority: "0.4", changefreq: "yearly" },
];

function urlEntry(path, { priority = "0.5", changefreq = "weekly", lastmod } = {}) {
  const parts = [
    `  <url>`,
    `    <loc>${SITE_URL}${path}</loc>`,
    lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    `  </url>`,
  ].filter(Boolean);
  return parts.join("\n");
}

async function build() {
  const entries = STATIC_PAGES.map((p) => urlEntry(p.path, p));

  if (SUPABASE_URL && SUPABASE_KEY) {
    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

      // Products
      const { data: products } = await supabase
        .from("products")
        .select("slug, updated_at")
        .eq("status", "active");
      if (products) {
        products.forEach((p) => {
          const lastmod = p.updated_at ? p.updated_at.split("T")[0] : null;
          entries.push(urlEntry(`/product/${p.slug}`, { priority: "0.8", changefreq: "weekly", lastmod }));
        });
      }

      // Categories
      const { data: categories } = await supabase.from("categories").select("id");
      if (categories) {
        categories.forEach((c) => {
          entries.push(urlEntry(`/category/${c.id}`, { priority: "0.9", changefreq: "weekly" }));
        });
      }

      // Brands
      const { data: brands } = await supabase.from("brands").select("id");
      if (brands) {
        brands.forEach((b) => {
          entries.push(urlEntry(`/brand/${b.id}`, { priority: "0.8", changefreq: "weekly" }));
        });
      }
    } catch (err) {
      console.warn("[sitemap] Supabase fetch failed, static pages only:", err.message);
    }
  } else {
    console.warn("[sitemap] No Supabase credentials, static pages only");
  }

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    entries.join("\n") +
    `\n</urlset>\n`;

  const outPath = resolve("dist", "sitemap.xml");
  writeFileSync(outPath, xml, "utf-8");
  console.log(`[sitemap] Wrote ${entries.length} URLs to ${outPath}`);
}

build().catch((err) => {
  console.error("[sitemap] Failed:", err);
  process.exit(1);
});
