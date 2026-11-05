import { supabase } from "./supabaseClient.js";
import { createApproval } from "./gmPortalClient.js";
import { executeRoleChange } from "./adminTeamClient.js";
import {
  createOffer, deleteOffer, toggleOfferActive, updateOffer,
} from "./adminOffersClient.js";

/**
 * approvalActions  —  changes that need the GM's sign-off
 *
 * Store staff can't change prices or offers, or cancel orders,
 * directly (config/permissions.js). Instead these helpers file an
 * `approvals` row; the GM approves it in the GM Portal, which calls
 * executeApprovedAction() with the GM's own session.
 *
 *   action_type          payload
 *   price_change         { sku, name, current_price, current_was, new_price, new_was }
 *   price_bulk_change    { rows: [{ sku, current_price, current_was, new_price, new_was }], source }
 *   offer_change         { op: create|update|delete|toggle, offer_id, label, offer?, is_active? }
 *   order_cancel         { order_id, customer_name, total, status, reason }
 *   admin_role_change    (legacy, from the old Team page)
 *
 * Every function resolves { ok, ... } or { ok: false, error }.
 */

export const APPROVAL_LABELS = {
  admin_role_change: "Admin role change",
  price_change:      "Price change",
  price_bulk_change: "Bulk price update",
  offer_change:      "Offer change",
  order_cancel:      "Order cancellation",
};

const numOrNull = (v) => (v === "" || v == null ? null : Number(v));

/* ------------------------------------------------------------
   Propose
   ------------------------------------------------------------ */

export function proposePriceChange({ createdBy, sku, name, currentPrice, currentWas, newPrice, newWas }) {
  return createApproval({
    actionType: "price_change",
    createdBy,
    payload: {
      sku, name: name || sku,
      current_price: numOrNull(currentPrice), current_was: numOrNull(currentWas),
      new_price: numOrNull(newPrice), new_was: numOrNull(newWas),
    },
  });
}

export function proposeBulkPriceChange({ createdBy, rows, source = "CSV price import" }) {
  if (!rows?.length) return Promise.resolve({ ok: false, error: "Nothing to submit." });
  return createApproval({
    actionType: "price_bulk_change",
    createdBy,
    payload: {
      source,
      rows: rows.map((r) => ({
        sku: r.sku,
        current_price: numOrNull(r.currentPrice), current_was: numOrNull(r.currentWas),
        new_price: numOrNull(r.price), new_was: numOrNull(r.was),
      })),
    },
  });
}

/** op: "create" | "update" (offer = the form payload) | "delete" | "toggle" (isActive). */
export function proposeOfferChange({ createdBy, op, offerId = null, label, offer = null, isActive = null }) {
  return createApproval({
    actionType: "offer_change",
    createdBy,
    payload: { op, offer_id: offerId, label, offer, is_active: isActive },
  });
}

export function requestOrderCancel({ createdBy, order, reason }) {
  if (!reason?.trim()) return Promise.resolve({ ok: false, error: "Give a reason for the cancellation." });
  return createApproval({
    actionType: "order_cancel",
    createdBy,
    payload: {
      order_id: order.id,
      customer_name: order.customer_name || null,
      total: order.total ?? null,
      status: order.status,
      reason: reason.trim(),
    },
  });
}

/* ------------------------------------------------------------
   Execute (GM Portal, after approval)
   ------------------------------------------------------------ */

async function applyPrice(sku, price, was) {
  if (!(Number(price) > 0)) return { ok: false, error: `Invalid price for ${sku}.` };
  const { data, error } = await supabase
    .from("products")
    .update({ price: Number(price), was: numOrNull(was) })
    .eq("sku", sku)
    .select("sku");
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: `Product ${sku} no longer exists.` };
  return { ok: true };
}

async function executeBulkPrice(rows) {
  const failed = [];
  for (const r of rows || []) {
    const res = await applyPrice(r.sku, r.new_price, r.new_was);
    if (!res.ok) failed.push(`${r.sku}: ${res.error}`);
  }
  return failed.length
    ? { ok: false, error: `${failed.length} of ${rows.length} failed — ${failed.slice(0, 3).join("; ")}` }
    : { ok: true };
}

function executeOffer(p) {
  switch (p.op) {
    case "create": return createOffer(p.offer || {});
    case "update": return updateOffer(p.offer_id, p.offer || {});
    case "delete": return deleteOffer(p.offer_id);
    case "toggle": return toggleOfferActive(p.offer_id, !!p.is_active);
    default:       return Promise.resolve({ ok: false, error: `Unknown offer operation '${p.op}'.` });
  }
}

const CANCELLABLE = ["pending_payment", "confirmed", "processing"];

async function executeOrderCancel(p) {
  const { data, error } = await supabase
    .from("orders")
    .update({ status: "cancelled" })
    .eq("id", p.order_id)
    .in("status", CANCELLABLE)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: "The order has moved on (shipped, delivered or already cancelled)." };
  return { ok: true };
}

export async function executeApprovedAction(approval) {
  const p = approval.payload || {};
  try {
    switch (approval.action_type) {
      case "admin_role_change": return await executeRoleChange(p);
      case "price_change":      return await applyPrice(p.sku, p.new_price, p.new_was);
      case "price_bulk_change": return await executeBulkPrice(p.rows);
      case "offer_change":      return await executeOffer(p);
      case "order_cancel":      return await executeOrderCancel(p);
      default:
        return { ok: false, error: `Unknown action type '${approval.action_type}'. Manual intervention required.` };
    }
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}
