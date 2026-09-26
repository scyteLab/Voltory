import Papa from "papaparse";
import { supabase } from "./supabaseClient.js";

/**
 * dataExports.js
 *
 * Generates 3 detailed CSV dumps for business analysis:
 *   1. Stock dump    \u2014 all products with current inventory levels
 *   2. Price dump    \u2014 all products with pricing and discount info
 *   3. Sales dump    \u2014 all orders, one row per line item (for Excel pivot tables)
 *
 * All CSVs use UTF-8 with BOM prefix for Excel compatibility
 * (especially important for the \u20A6 Naira symbol).
 *
 * Filename convention: naven-<type>-YYYY-MM-DD.csv
 */

/* ============================================================
   Helpers
   ============================================================ */

function today() {
  return new Date().toISOString().slice(0, 10);
}

function downloadCsv(csv, filename) {
  /* BOM prefix so Excel opens UTF-8 correctly */
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 10);
}

function fmtTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(11, 19);
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function safeAddress(addr) {
  if (!addr || typeof addr !== "object") return { state: "", lga: "", street: "", landmark: "" };
  return {
    state:    addr.state    || "",
    lga:      addr.lga      || "",
    street:   addr.street   || "",
    landmark: addr.landmark || "",
  };
}

/* ============================================================
   1. STOCK DUMP
   ============================================================ */

export async function exportStockDump() {
  const { data, error } = await supabase
    .from("products")
    .select("sku, name, brand, category, price, was, stock, status, updated_at, created_at")
    .order("brand", { ascending: true })
    .order("name",  { ascending: true });

  if (error) return { ok: false, error: error.message };

  const rows = (data || []).map((p) => ({
    SKU:               p.sku,
    "Product Name":    p.name || "",
    Brand:             p.brand || "",
    Category:          p.category || "",
    Stock:             num(p.stock),
    "Current Price":   num(p.price),
    "Compare-At Price": p.was == null ? "" : num(p.was),
    Status:            p.status || "",
    "Last Updated":    fmtDate(p.updated_at || p.created_at),
  }));

  const csv = Papa.unparse(rows);
  downloadCsv(csv, `naven-stock-${today()}.csv`);
  return { ok: true, count: rows.length };
}

/* ============================================================
   2. PRICE DUMP
   ============================================================ */

export async function exportPriceDump() {
  const { data, error } = await supabase
    .from("products")
    .select("sku, name, brand, category, price, was, status, updated_at, created_at")
    .order("brand", { ascending: true })
    .order("name",  { ascending: true });

  if (error) return { ok: false, error: error.message };

  const rows = (data || []).map((p) => {
    const price = num(p.price);
    const was   = p.was == null ? null : num(p.was);
    const discountPct = was && was > price
      ? Math.round(((was - price) / was) * 100)
      : 0;
    const savings = was && was > price ? was - price : 0;
    return {
      SKU:               p.sku,
      "Product Name":    p.name || "",
      Brand:             p.brand || "",
      Category:          p.category || "",
      "Current Price":   price,
      "Compare-At Price": was == null ? "" : was,
      "Discount %":      discountPct ? `${discountPct}%` : "",
      "Customer Savings": savings || "",
      Status:            p.status || "",
      "Last Updated":    fmtDate(p.updated_at || p.created_at),
    };
  });

  const csv = Papa.unparse(rows);
  downloadCsv(csv, `naven-price-${today()}.csv`);
  return { ok: true, count: rows.length };
}

/* ============================================================
   3. SALES DUMP \u2014 one row per line item
   ============================================================
   Real professional format: repeats order-level fields per line
   item so Excel pivot tables work perfectly. Standard e-commerce
   export shape.
*/

export async function exportSalesDump({ startDate, endDate } = {}) {
  /* Fetch orders with items joined \u2014 uses Supabase's implicit join */
  let query = supabase
    .from("orders")
    .select(`
      id, created_at, status,
      customer_name, customer_phone, customer_email,
      address, payment_method, payment_status, paystack_ref,
      subtotal, discount, delivery_fee, installation_fee, total, notes,
      order_items ( sku, qty, unit_price, line_total, product_name )
    `)
    .order("created_at", { ascending: false });

  if (startDate) query = query.gte("created_at", startDate);
  if (endDate)   query = query.lte("created_at", endDate);

  const { data, error } = await query;
  if (error) return { ok: false, error: error.message };

  const rows = [];

  for (const order of (data || [])) {
    const addr = safeAddress(order.address);
    const items = Array.isArray(order.order_items) ? order.order_items : [];

    if (items.length === 0) {
      /* Edge case: order with no items \u2014 still export order-level
         data so admin sees the anomaly. */
      rows.push({
        "Order ID":         order.id,
        "Order Date":       fmtDate(order.created_at),
        "Order Time":       fmtTime(order.created_at),
        "Order Status":     order.status || "",
        "Payment Method":   order.payment_method || "",
        "Payment Status":   order.payment_status || "",
        "Paystack Ref":     order.paystack_ref || "",
        "Customer Name":    order.customer_name || "",
        "Customer Phone":   order.customer_phone || "",
        "Customer Email":   order.customer_email || "",
        "Delivery State":   addr.state,
        "Delivery LGA":     addr.lga,
        "Delivery Street":  addr.street,
        "Delivery Landmark": addr.landmark,
        SKU:                "",
        "Product Name":     "",
        Qty:                "",
        "Unit Price":       "",
        "Line Total":       "",
        "Order Subtotal":   num(order.subtotal),
        "Order Discount":   num(order.discount),
        "Delivery Fee":     num(order.delivery_fee),
        "Installation Fee": num(order.installation_fee),
        "Order Total":      num(order.total),
        Notes:              order.notes || "",
      });
      continue;
    }

    /* One row per line item, order-level fields repeated */
    for (const it of items) {
      rows.push({
        "Order ID":         order.id,
        "Order Date":       fmtDate(order.created_at),
        "Order Time":       fmtTime(order.created_at),
        "Order Status":     order.status || "",
        "Payment Method":   order.payment_method || "",
        "Payment Status":   order.payment_status || "",
        "Paystack Ref":     order.paystack_ref || "",
        "Customer Name":    order.customer_name || "",
        "Customer Phone":   order.customer_phone || "",
        "Customer Email":   order.customer_email || "",
        "Delivery State":   addr.state,
        "Delivery LGA":     addr.lga,
        "Delivery Street":  addr.street,
        "Delivery Landmark": addr.landmark,
        SKU:                it.sku || "",
        "Product Name":     it.product_name || "",
        Qty:                num(it.qty),
        "Unit Price":       num(it.unit_price),
        "Line Total":       num(it.line_total),
        "Order Subtotal":   num(order.subtotal),
        "Order Discount":   num(order.discount),
        "Delivery Fee":     num(order.delivery_fee),
        "Installation Fee": num(order.installation_fee),
        "Order Total":      num(order.total),
        Notes:              order.notes || "",
      });
    }
  }

  const csv = Papa.unparse(rows);
  const stamp = today();
  const suffix = startDate || endDate
    ? `-${fmtDate(startDate) || "start"}_to_${fmtDate(endDate) || "now"}`
    : "";
  downloadCsv(csv, `naven-sales${suffix}-${stamp}.csv`);
  return { ok: true, count: rows.length, orderCount: (data || []).length };
}