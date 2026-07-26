// ============================================================
//  seed-orders-warranty.mjs
//  One-time seed of realistic orders + warranty claims so the
//  admin dashboard has numbers to render. Idempotent: safe to
//  re-run; existing rows are left alone.
//
//  Usage:
//    SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-orders-warranty.mjs
//
//  Or add to .env.local (both keys) and run just:
//    node scripts/seed-orders-warranty.mjs
// ============================================================

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Load .env.local if present (no dependency on dotenv)
try {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const env = readFileSync(join(__dirname, "..", ".env.local"), "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch { /* .env.local optional */ }

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  console.error("Add them to .env.local or export them before running.");
  process.exit(1);
}

const supa = createClient(url, key, { auth: { persistSession: false } });

// ---- Order ID generator (matches storefront format) ----------
function newOrderId(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const ts =
    d.getFullYear() +
    String(d.getMonth() + 1).padStart(2, "0") +
    String(d.getDate()).padStart(2, "0") +
    String(d.getHours()).padStart(2, "0") +
    String(d.getMinutes()).padStart(2, "0");
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return { id: `VLT-${ts}-${suffix}`, when: d.toISOString() };
}

// ---- Nigerian names + phones for realism ---------------------
const NIGERIAN_NAMES = [
  "Chinedu Okafor", "Aisha Bello", "Emeka Nwosu", "Fatima Yusuf",
  "Ibrahim Lawal", "Ngozi Adeyemi", "Tunde Balogun", "Kelechi Onwuka",
  "Amina Musa", "Segun Ojo", "Blessing Effiong", "Yusuf Sani",
  "Chidinma Eze", "Musa Abdullahi", "Titi Adebayo", "Ekene Ibe",
  "Halima Aliyu", "Femi Ogunleye", "Adaeze Umeh", "Danladi Bala",
];
const LAGOS_AREAS = ["Lekki", "Ikeja", "Ikoyi", "Yaba", "Surulere", "Ajah", "Victoria Island"];

function randomPhone() {
  const prefixes = ["0803", "0806", "0809", "0813", "0816", "0703", "0706", "0813"];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  return prefix + Math.floor(Math.random() * 10000000).toString().padStart(7, "0");
}

// ---- Fetch products so we can seed real SKUs -----------------
async function fetchProducts() {
  const { data, error } = await supa
    .from("products")
    .select("sku, name, price")
    .limit(50);
  if (error) throw error;
  if (!data?.length) {
    throw new Error("No products in the database. Run seed-supabase.mjs first.");
  }
  return data;
}

// ---- Are we already seeded? ----------------------------------
async function alreadySeeded() {
  const { count, error } = await supa
    .from("orders")
    .select("*", { count: "exact", head: true });
  if (error) throw error;
  return (count || 0) > 5;
}

// ---- Seed orders --------------------------------------------
async function seedOrders(products) {
  const orders = [];
  const items = [];

  const statuses = [
    ["confirmed",   0.20],
    ["processing",  0.25],
    ["shipped",     0.20],
    ["delivered",   0.30],
    ["cancelled",   0.05],
  ];

  function pickStatus() {
    let r = Math.random();
    for (const [s, p] of statuses) { r -= p; if (r <= 0) return s; }
    return "delivered";
  }

  // Seed 40 orders spread across the last 45 days.
  for (let i = 0; i < 40; i++) {
    const daysAgo = Math.floor(Math.random() * 45);
    const { id, when } = newOrderId(daysAgo);
    const name = NIGERIAN_NAMES[Math.floor(Math.random() * NIGERIAN_NAMES.length)];
    const status = pickStatus();

    // 1-3 line items per order
    const lineCount = 1 + Math.floor(Math.random() * 3);
    const picked = [...products].sort(() => 0.5 - Math.random()).slice(0, lineCount);

    let subtotal = 0;
    const orderItems = picked.map((p) => {
      const qty = 1 + Math.floor(Math.random() * 2);
      const lineTotal = p.price * qty;
      subtotal += lineTotal;
      return {
        order_id: id, sku: p.sku, qty,
        unit_price: p.price, line_total: lineTotal, product_name: p.name,
      };
    });

    const deliveryFee = subtotal >= 150000 ? 0 : 5500;
    const discount = Math.random() < 0.3 ? Math.round(subtotal * 0.1) : 0;
    const total = subtotal - discount + deliveryFee;

    orders.push({
      id, created_at: when, updated_at: when,
      customer_name: name,
      customer_phone: randomPhone(),
      customer_email: name.toLowerCase().replace(" ", ".") + "@example.com",
      address: { state: "Lagos", area: LAGOS_AREAS[Math.floor(Math.random() * LAGOS_AREAS.length)] },
      payment_method: ["card", "transfer", "pod"][Math.floor(Math.random() * 3)],
      status, subtotal, discount, delivery_fee: deliveryFee,
      installation_fee: 0, total,
    });
    items.push(...orderItems);
  }

  // Batch inserts \u2014 orders first (FK), then items.
  console.log(`Inserting ${orders.length} orders and ${items.length} line items...`);
  const oIns = await supa.from("orders").insert(orders);
  if (oIns.error) throw oIns.error;
  const iIns = await supa.from("order_items").insert(items);
  if (iIns.error) throw iIns.error;
  return { orderCount: orders.length, itemCount: items.length };
}

// ---- Seed warranty claims -----------------------------------
async function seedWarrantyClaims(products) {
  const claims = [];
  const REASONS = [
    "Refrigerator not cooling properly after 3 weeks",
    "AC compressor making loud noise",
    "TV screen flickering intermittently",
    "Washing machine leaking water",
    "Stabilizer output unstable",
    "Blender motor stopped working",
    "Fan wobbling excessively",
    "Cooker ignition failure",
  ];

  for (let i = 0; i < 18; i++) {
    const daysAgo = Math.floor(Math.random() * 30);
    const d = new Date(); d.setDate(d.getDate() - daysAgo);
    const ts =
      d.getFullYear() +
      String(d.getMonth() + 1).padStart(2, "0") +
      String(d.getDate()).padStart(2, "0") +
      String(d.getHours()).padStart(2, "0") +
      String(d.getMinutes()).padStart(2, "0");
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    const id = `VLT-W-${ts}-${suffix}`;
    const p = products[Math.floor(Math.random() * products.length)];
    const status = ["submitted", "under_review", "approved", "resolved"][Math.floor(Math.random() * 4)];

    claims.push({
      id,
      created_at: d.toISOString(),
      updated_at: d.toISOString(),
      order_id: null, sku: p.sku,
      customer_name: NIGERIAN_NAMES[Math.floor(Math.random() * NIGERIAN_NAMES.length)],
      customer_phone: randomPhone(),
      status,
      reason: REASONS[Math.floor(Math.random() * REASONS.length)],
    });
  }

  console.log(`Inserting ${claims.length} warranty claims...`);
  const wIns = await supa.from("warranty_claims").insert(claims);
  if (wIns.error) throw wIns.error;
  return claims.length;
}

// ---- Main ---------------------------------------------------
async function main() {
  if (await alreadySeeded()) {
    console.log("Already seeded (>5 orders present). Delete existing rows to re-seed.");
    return;
  }
  const products = await fetchProducts();
  console.log(`Found ${products.length} products to seed against.`);
  const { orderCount, itemCount } = await seedOrders(products);
  const claims = await seedWarrantyClaims(products);
  console.log(`\nSeed complete:`);
  console.log(`  \u00B7 ${orderCount} orders`);
  console.log(`  \u00B7 ${itemCount} order items`);
  console.log(`  \u00B7 ${claims} warranty claims`);
  console.log(`\nDashboard KPIs are now populated. Refresh /admin.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
