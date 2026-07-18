/**
 * One-off local script — pushes the existing static catalog
 * (src/data/products.js) into Supabase so the admin console doesn't
 * start empty. Not shipped, not run in CI, not imported by the app.
 *
 * Uses the service_role key (bypasses RLS) — never expose this key
 * to the browser, never commit it.
 *
 * Run:
 *   node --env-file=.env scripts/seed-supabase.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { BRANDS, CATEGORIES, PRODUCTS } from "../src/data/products.js";

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
    "Run this with: node --env-file=.env scripts/seed-supabase.mjs"
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey);

function toRow(p) {
  // .env-driven admin form always writes status; the static file
  // predates that field, so default every seeded product to active.
  const { sku, slug, name, brand, model, category, image, price, was,
    stock, rating, reviews, questions, badge, icon, tags, hp, inverter,
    litres, doors, highlights, specs, description } = p;
  return {
    sku, slug, name, brand, model: model ?? null, category,
    image: image ?? null, price, was: was ?? null, stock: stock ?? 0,
    status: "active", rating: rating ?? null, reviews: reviews ?? 0,
    questions: questions ?? 0, badge: badge ?? null, icon: icon ?? null,
    tags: tags ?? [], hp: hp ?? null, inverter: inverter ?? null,
    litres: litres ?? null, doors: doors ?? null,
    highlights: highlights ?? [], specs: specs ?? [],
    description: description ?? null,
  };
}

async function main() {
  console.log(`Seeding ${CATEGORIES.length} categories…`);
  const { error: catErr } = await supabase.from("categories").upsert(
    CATEGORIES.map((c) => ({
      id: c.id, label: c.label, icon: c.icon ?? null, blurb: c.blurb ?? null,
      filter_config: c.filterConfig ?? [], hot: !!c.hot, megamenu: c.megamenu ?? [],
    }))
  );
  if (catErr) throw catErr;

  console.log(`Seeding ${BRANDS.length} brands…`);
  const { error: brandErr } = await supabase.from("brands").upsert(BRANDS);
  if (brandErr) throw brandErr;

  console.log(`Seeding ${PRODUCTS.length} products…`);
  const { error: prodErr } = await supabase.from("products").upsert(PRODUCTS.map(toRow));
  if (prodErr) throw prodErr;

  console.log("Done. Check the Supabase dashboard's Table Editor to confirm.");
}

main().catch((e) => {
  console.error("Seed failed:", e.message || e);
  process.exit(1);
});
