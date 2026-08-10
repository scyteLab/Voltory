import { supabase } from "./supabaseClient.js";

/**
 * whatsappQuotesAdmin
 *
 * Everything the admin needs to work WhatsApp quotes:
 *   \u00B7 fetchQuotesForAdmin       \u2014 list, filtered by status
 *   \u00B7 fetchQuoteStatusCounts    \u2014 tab counters
 *   \u00B7 fetchQuoteDetail          \u2014 single quote + items + customer
 *   \u00B7 setQuoteStatus            \u2014 update status + optional notes
 *   \u00B7 updateQuoteNotes          \u2014 save rep notes
 *   \u00B7 updateQuoteItem           \u2014 change qty / price on one line
 *   \u00B7 addQuoteItem              \u2014 rep adds a line during negotiation
 *   \u00B7 removeQuoteItem           \u2014 rep removes a line
 *   \u00B7 convertQuoteToOrder       \u2014 the big one: copy quote to orders/order_items
 */

/* ============================================================
   Read
   ============================================================ */

export async function fetchQuotesForAdmin({ status = "new", limit = 100 } = {}) {
  try {
    let query = supabase
      .from("whatsapp_quotes")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status && status !== "all") query = query.eq("status", status);

    const { data, error } = await query;
    if (error) {
      // eslint-disable-next-line no-console
      console.error("[waQuotesAdmin] fetch failed:", error);
      return { ok: false, error: error.message, quotes: [] };
    }
    return { ok: true, quotes: (data || []).map(mapQuoteRow) };
  } catch (err) {
    return { ok: false, error: err?.message || String(err), quotes: [] };
  }
}

export async function fetchQuoteStatusCounts() {
  try {
    const statuses = ["new", "contacted", "confirmed", "lost", "expired"];
    const results = await Promise.all(
      statuses.map((s) =>
        supabase
          .from("whatsapp_quotes")
          .select("id", { count: "exact", head: true })
          .eq("status", s)
      )
    );
    const counts = {};
    statuses.forEach((s, i) => { counts[s] = results[i].count || 0; });
    return { ok: true, counts };
  } catch (err) {
    return { ok: false, error: err?.message || String(err), counts: {} };
  }
}

/**
 * Full detail: quote header + items + linked customer if any.
 */
export async function fetchQuoteDetail(quoteId) {
  if (!quoteId) return { ok: false, error: "Missing quote id" };
  try {
    const [qRes, iRes] = await Promise.all([
      supabase
        .from("whatsapp_quotes")
        .select("*, customers ( id, name, phone, email )")
        .eq("id", quoteId)
        .maybeSingle(),
      supabase
        .from("whatsapp_quote_items")
        .select("*")
        .eq("quote_id", quoteId)
        .order("id", { ascending: true }),
    ]);

    if (qRes.error) return { ok: false, error: qRes.error.message };
    if (!qRes.data) return { ok: false, error: "Quote not found" };
    if (iRes.error) return { ok: false, error: iRes.error.message };

    return {
      ok: true,
      quote: {
        ...mapQuoteRow(qRes.data),
        customer: qRes.data.customers || null,
        items: (iRes.data || []).map((it) => ({
          id: it.id,
          sku: it.sku,
          productName: it.product_name,
          qty: it.qty,
          unitPrice: it.unit_price,
          lineTotal: it.line_total,
          image: it.image,
        })),
      },
    };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/* ============================================================
   Mutations
   ============================================================ */

/**
 * Set the quote's status. Recomputes the subtotal server-side is
 * done in a separate call \u2014 status changes shouldn't imply a
 * price change.
 */
export async function setQuoteStatus(quoteId, status, notes = undefined) {
  if (!quoteId) return { ok: false, error: "Missing quote id" };
  if (!["new", "contacted", "confirmed", "lost", "expired"].includes(status)) {
    return { ok: false, error: "Invalid status" };
  }
  try {
    const patch = { status };
    if (notes !== undefined) patch.rep_notes = notes;
    const { data, error } = await supabase
      .from("whatsapp_quotes")
      .update(patch)
      .eq("id", quoteId)
      .select()
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, quote: mapQuoteRow(data) };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

export async function updateQuoteNotes(quoteId, notes) {
  if (!quoteId) return { ok: false, error: "Missing quote id" };
  try {
    const { error } = await supabase
      .from("whatsapp_quotes")
      .update({ rep_notes: notes })
      .eq("id", quoteId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * Update a single item's qty or unit_price. Recomputes line_total
 * and refreshes the parent quote's subtotal.
 */
export async function updateQuoteItem(quoteId, itemId, { qty, unitPrice }) {
  if (!quoteId || !itemId) return { ok: false, error: "Missing identifier" };
  try {
    const patch = {};
    if (qty !== undefined) {
      const q = Number(qty);
      if (!q || q < 1) return { ok: false, error: "Quantity must be at least 1" };
      patch.qty = q;
    }
    if (unitPrice !== undefined) {
      const p = Number(unitPrice);
      if (isNaN(p) || p < 0) return { ok: false, error: "Invalid price" };
      patch.unit_price = Math.round(p);
    }
    // Fetch existing item to compute new line_total
    const existRes = await supabase
      .from("whatsapp_quote_items")
      .select("qty, unit_price")
      .eq("id", itemId)
      .maybeSingle();
    if (existRes.error) return { ok: false, error: existRes.error.message };
    const finalQty   = patch.qty !== undefined ? patch.qty : existRes.data.qty;
    const finalPrice = patch.unit_price !== undefined ? patch.unit_price : existRes.data.unit_price;
    patch.line_total = finalQty * finalPrice;

    const { error } = await supabase
      .from("whatsapp_quote_items")
      .update(patch)
      .eq("id", itemId);
    if (error) return { ok: false, error: error.message };

    await recomputeQuoteSubtotal(quoteId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

export async function addQuoteItem(quoteId, { sku, productName, qty, unitPrice, image }) {
  if (!quoteId) return { ok: false, error: "Missing quote id" };
  if (!sku || !productName) return { ok: false, error: "Product SKU and name required" };
  const q = Number(qty) || 1;
  const p = Number(unitPrice) || 0;
  try {
    const { error } = await supabase
      .from("whatsapp_quote_items")
      .insert({
        quote_id: quoteId,
        sku,
        product_name: productName,
        qty: q,
        unit_price: Math.round(p),
        line_total: Math.round(p * q),
        image: image || null,
      });
    if (error) return { ok: false, error: error.message };
    await recomputeQuoteSubtotal(quoteId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

export async function removeQuoteItem(quoteId, itemId) {
  if (!quoteId || !itemId) return { ok: false, error: "Missing identifier" };
  try {
    const { error } = await supabase
      .from("whatsapp_quote_items")
      .delete()
      .eq("id", itemId);
    if (error) return { ok: false, error: error.message };
    await recomputeQuoteSubtotal(quoteId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * Reads all remaining items and updates the parent quote's subtotal.
 * Called after every item mutation. Silent \u2014 if it fails, the item
 * change is still applied, subtotal will be off until next call.
 */
async function recomputeQuoteSubtotal(quoteId) {
  try {
    const { data } = await supabase
      .from("whatsapp_quote_items")
      .select("line_total")
      .eq("quote_id", quoteId);
    const subtotal = (data || []).reduce((s, r) => s + Number(r.line_total || 0), 0);
    await supabase
      .from("whatsapp_quotes")
      .update({ subtotal })
      .eq("id", quoteId);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[waQuotesAdmin] subtotal recompute failed:", err);
  }
}

/* ============================================================
   Convert-to-order \u2014 the big one
   ============================================================ */

/**
 * Copies a WhatsApp quote into the orders + order_items tables.
 * Marks the quote as 'confirmed' and stamps linked_order_id.
 *
 * Behaviour:
 *   \u00B7 Generates a new order id in the standard VLT- format
 *   \u00B7 Uses current quote items and current customer info
 *   \u00B7 Sets order status = 'confirmed' (the rep already knows the
 *     deal is closed by the time they click convert)
 *   \u00B7 Payment method defaults to 'pay_on_delivery' since WhatsApp
 *     sales are typically cash / bank-transfer on delivery
 *   \u00B7 Address is left empty {} \u2014 rep will fill via the admin
 *     orders page after conversion
 *   \u00B7 Won't convert if quote already has a linked_order_id (prevents
 *     double-creating an order from an accidental double-click)
 */
export async function convertQuoteToOrder(quoteId) {
  if (!quoteId) return { ok: false, error: "Missing quote id" };
  try {
    // Fetch fresh quote + items to make sure we're converting the
    // current state (rep may have just edited)
    const detail = await fetchQuoteDetail(quoteId);
    if (!detail.ok) return detail;
    const q = detail.quote;

    if (q.linkedOrderId) {
      return { ok: false, error: `Already converted (order ${q.linkedOrderId})` };
    }
    if (q.items.length === 0) {
      return { ok: false, error: "Quote has no items \u2014 add items before converting" };
    }

    const orderId = generateOrderIdVLT();

    // Build order row \u2014 mirrors toSupabaseShape() in ordersClient.js
    const subtotal    = q.items.reduce((s, i) => s + Number(i.lineTotal || 0), 0);
    const orderRow = {
      id: orderId,
      created_at: new Date().toISOString(),
      customer_name:  q.customerName  || "",
      customer_phone: q.customerPhone || "",
      customer_email: q.customerEmail || null,
      customer_id:    q.customerId    || null,
      address: {},                          // rep fills in orders page
      payment_method: "pay_on_delivery",
      status: "confirmed",
      subtotal,
      discount: 0,
      delivery_fee: 0,
      installation_fee: 0,
      total: subtotal,
      notes: q.repNotes ? `From WhatsApp quote ${q.id}\n\n${q.repNotes}` : `From WhatsApp quote ${q.id}`,
    };
    const itemRows = q.items.map((i) => ({
      order_id: orderId,
      sku: i.sku,
      qty: i.qty,
      unit_price: i.unitPrice,
      line_total: i.lineTotal,
      product_name: i.productName,
    }));

    // Insert order first, then items (FK dependency)
    const oRes = await supabase.from("orders").insert(orderRow);
    if (oRes.error) return { ok: false, error: `Order insert failed: ${oRes.error.message}` };

    const iRes = await supabase.from("order_items").insert(itemRows);
    if (iRes.error) {
      // Best-effort rollback: try to delete the order row we just made.
      // If this fails too, we've got a partial record; admin can clean
      // up manually. Fail loud so we notice.
      await supabase.from("orders").delete().eq("id", orderId);
      return { ok: false, error: `Items insert failed, order rolled back: ${iRes.error.message}` };
    }

    // Stamp the quote as confirmed + linked
    const uRes = await supabase
      .from("whatsapp_quotes")
      .update({ status: "confirmed", linked_order_id: orderId })
      .eq("id", quoteId);
    if (uRes.error) {
      // The order exists and is real; just the quote didn't get
      // linked. Non-fatal, but surface it so the rep knows.
      return { ok: true, orderId, warning: `Order created but quote link failed: ${uRes.error.message}` };
    }

    return { ok: true, orderId };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/* ============================================================
   Helpers
   ============================================================ */

function pad(n) { return String(n).padStart(2, "0"); }

function generateOrderIdVLT() {
  const d = new Date();
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `VLT-${stamp}-${rand}`;
}

function mapQuoteRow(r) {
  return {
    id: r.id,
    customerId:    r.customer_id,
    customerName:  r.customer_name,
    customerPhone: r.customer_phone,
    customerEmail: r.customer_email,
    subtotal:      r.subtotal,
    status:        r.status,
    repNotes:      r.rep_notes,
    linkedOrderId: r.linked_order_id,
    createdAt:     r.created_at,
    updatedAt:     r.updated_at,
  };
}