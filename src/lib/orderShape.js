/**
 * Order shapes shared by the storefront and the customer-data
 * Netlify function (which imports this file), so both sides agree on
 * exactly what an order looks like. Pure: no browser or Node APIs.
 */

/** Supabase orders row (with order_items) → storefront order shape. */
export function toStorefrontShape(row) {
  if (!row) return null;
  const items = Array.isArray(row.order_items) ? row.order_items : [];
  return {
    id: row.id,
    createdAt: row.created_at,
    status: row.status,
    items: items.map((i) => ({
      sku: i.sku,
      qty: i.qty,
      price: i.unit_price,
      name: i.product_name,
      image: i.image || null,
    })),
    contact: {
      name:  row.customer_name  || "",
      phone: row.customer_phone || "",
      email: row.customer_email || "",
    },
    address: row.address || {},
    payment: { method: row.payment_method },
    paymentStatus: row.payment_status || "unpaid",
    paystackRef: row.paystack_ref || null,
    installation: (row.installation_fee || 0) > 0,
    totals: {
      subtotal:        row.subtotal || 0,
      discount:        row.discount || 0,
      deliveryFee:     row.delivery_fee || 0,
      installationFee: row.installation_fee || 0,
      grand:           row.total || 0,
    },
    account: { phone: row.customer_phone, name: row.customer_name },
    accountCreated: false,
    customer_id: row.customer_id || null,
    syncedAt: row.created_at,
  };
}

/**
 * Tracking view for guests: status, dates, items, totals and the
 * delivery area only. No name, street, landmark, email, payment
 * reference or customer id. `phone` is the number the visitor typed
 * (already proven to match), echoed back for display.
 */
export function toTrackingShape(row, phone) {
  const full = toStorefrontShape(row);
  if (!full) return null;
  return {
    id: full.id,
    createdAt: full.createdAt,
    status: full.status,
    items: full.items,
    totals: full.totals,
    installation: full.installation,
    payment: full.payment,
    paymentStatus: full.paymentStatus,
    contact: { name: "", phone: phone || "", email: "" },
    address: { state: full.address?.state || "", lga: full.address?.lga || "" },
    syncedAt: full.syncedAt,
    trackingOnly: true,
  };
}
