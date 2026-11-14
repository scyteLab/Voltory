/**
 * Service-role data access for customer-auth and customer-data
 * (PostgREST through _shared/serviceDb.js). Injected into both
 * handlers so tests can swap in a fake with the same methods.
 *
 * Every customer-scoped query takes the customer id from the SESSION
 * (never from the browser) and filters on it here.
 */
import { enc } from "./serviceDb.js";
import { earlierOrdersFilter, ownedOrdersFilter } from "./orderOwnership.js";

/** Columns a customer may see about themselves (never the hash). */
export const CUSTOMER_PUBLIC_COLUMNS = ["id", "name", "phone", "email", "gender", "dob", "marketing_opt_in", "created_at"];

const quoteList = (values) => values.map((v) => `"${String(v).replace(/"/g, "")}"`).join(",");

export function restDb(rest) {
  return {
    /* ---- sessions ---- */
    async getSessionByHash(hash) {
      const r = await rest("GET",
        `customer_sessions?select=id,customer_id,expires_at,revoked_at,last_seen_at&token_hash=eq.${enc(hash)}&limit=1`);
      return r.data?.[0] || null;
    },
    // LEGACY (delete after Step B): browser-minted plain-text tokens.
    async getLegacySession(token) {
      const r = await rest("GET",
        `customer_sessions?select=id,customer_id,expires_at,revoked_at&token=eq.${enc(token)}&token_hash=is.null&limit=1`);
      return r.data?.[0] || null;
    },
    async createSession(row) {
      const r = await rest("POST", "customer_sessions", { body: row, prefer: "return=representation" });
      return r.data?.[0] || null;
    },
    async touchSession(id, iso) {
      await rest("PATCH", `customer_sessions?id=eq.${enc(id)}`, { body: { last_seen_at: iso }, prefer: "return=minimal" });
    },
    async deleteSession(id) {
      await rest("DELETE", `customer_sessions?id=eq.${enc(id)}`, { prefer: "return=minimal" });
    },
    // LEGACY (delete after Step B): sign-out of an old header session.
    async deleteLegacySession(token) {
      await rest("DELETE", `customer_sessions?token=eq.${enc(token)}&token_hash=is.null`, { prefer: "return=minimal" });
    },
    /** Every session of this customer except keepId (cookie and legacy rows alike). */
    async deleteOtherSessions(customerId, keepId) {
      const r = await rest("DELETE",
        `customer_sessions?customer_id=eq.${enc(customerId)}${keepId ? `&id=neq.${enc(keepId)}` : ""}`,
        { prefer: "return=representation" });
      return Array.isArray(r.data) ? r.data.length : 0;
    },

    /* ---- customers + credentials ---- */
    async getCustomer(id) {
      const r = await rest("GET", `customers?select=*&id=eq.${enc(id)}&limit=1`);
      return r.data?.[0] || null;
    },
    /** Rows with either spelling of the phone ("080…" / "+23480…"). */
    async findCustomersByPhone(phones) {
      const r = await rest("GET", `customers?select=*&phone=in.${enc(`(${quoteList(phones)})`)}&order=created_at.asc&limit=5`);
      return r.data || [];
    },
    async insertCustomer(row) {
      const r = await rest("POST", "customers", { body: row, prefer: "return=representation" });
      return r.data?.[0] || null;
    },
    async updateCustomer(id, patch) {
      const r = await rest("PATCH", `customers?id=eq.${enc(id)}`, { body: patch, prefer: "return=representation" });
      return r.data?.[0] || null;
    },
    async getCredential(customerId) {
      const r = await rest("GET",
        `customer_credentials?select=customer_id,password_hash,claimed_at&customer_id=eq.${enc(customerId)}&limit=1`);
      return r.data?.[0] || null;
    },
    async getCredentials(customerIds) {
      if (!customerIds.length) return [];
      const r = await rest("GET",
        `customer_credentials?select=customer_id,password_hash,claimed_at&customer_id=in.${enc(`(${quoteList(customerIds)})`)}`);
      return r.data || [];
    },
    /** Insert only (HTTP 409 if a row exists: the phone was claimed meanwhile). */
    async insertCredential(row) {
      const r = await rest("POST", "customer_credentials", { body: row, prefer: "return=representation" });
      return r.data?.[0] || null;
    },
    async updateCredentialHash(customerId, passwordHash, updatedAt) {
      const r = await rest("PATCH", `customer_credentials?customer_id=eq.${enc(customerId)}`,
        { body: { password_hash: passwordHash, updated_at: updatedAt }, prefer: "return=representation" });
      return r.data?.[0] || null;
    },

    /* ---- orders (ownership rule: _shared/orderOwnership.js) ---- */
    async getOrder(id) {
      const r = await rest("GET", `orders?select=*,order_items(*)&id=eq.${enc(id)}&limit=1`);
      return r.data?.[0] || null;
    },
    async listOrdersForOwner(owner) {
      const f = ownedOrdersFilter(owner);
      if (!f) return [];
      const r = await rest("GET", `orders?select=*,order_items(*)&${f}&order=created_at.desc`);
      return r.data || [];
    },
    /** Guest orders for this phone placed before the claim (count only; shown as a notice). */
    async countEarlierOrders(owner, phones) {
      const f = earlierOrdersFilter(owner, phones);
      if (!f) return 0;
      const r = await rest("GET", `orders?select=id&${f}&limit=1`);
      return Array.isArray(r.data) ? r.data.length : 0;
    },
    async findDeliveredOrderWithSku(owner, sku) {
      const f = ownedOrdersFilter(owner);
      if (!f) return null;
      const r = await rest("GET",
        `orders?select=id,order_items!inner(sku)&status=eq.delivered&order_items.sku=eq.${enc(sku)}&${f}&order=created_at.desc&limit=1`);
      return r.data?.[0] || null;
    },
    async listDeliveredOrders(owner) {
      const f = ownedOrdersFilter(owner);
      if (!f) return [];
      const r = await rest("GET",
        `orders?select=id,created_at,order_items(*)&status=eq.delivered&${f}&order=created_at.desc&limit=200`);
      return r.data || [];
    },

    /* ---- addresses (always scoped to the session customer) ---- */
    async listAddresses(customerId) {
      const r = await rest("GET",
        `customer_addresses?select=*&customer_id=eq.${enc(customerId)}&order=is_default.desc,created_at.desc`);
      return r.data || [];
    },
    async insertAddress(row) {
      const r = await rest("POST", "customer_addresses", { body: row, prefer: "return=representation" });
      return r.data?.[0] || null;
    },
    async updateOwnAddress(customerId, id, patch) {
      const r = await rest("PATCH", `customer_addresses?id=eq.${enc(id)}&customer_id=eq.${enc(customerId)}`,
        { body: patch, prefer: "return=representation" });
      return r.data?.[0] || null;
    },
    async clearDefaultAddresses(customerId, exceptId) {
      await rest("PATCH",
        `customer_addresses?customer_id=eq.${enc(customerId)}&is_default=is.true${exceptId ? `&id=neq.${enc(exceptId)}` : ""}`,
        { body: { is_default: false }, prefer: "return=minimal" });
    },
    async deleteOwnAddress(customerId, id) {
      const r = await rest("DELETE", `customer_addresses?id=eq.${enc(id)}&customer_id=eq.${enc(customerId)}`,
        { prefer: "return=representation" });
      return Array.isArray(r.data) && r.data.length > 0;
    },

    /* ---- reviews ---- */
    async getProduct(sku) {
      const r = await rest("GET", `products?select=sku,name,slug,image,status&sku=eq.${enc(sku)}&limit=1`);
      return r.data?.[0] || null;
    },
    async getProducts(skus) {
      const r = await rest("GET", `products?select=sku,name,slug,image&sku=in.${enc(`(${quoteList(skus)})`)}`);
      return r.data || [];
    },
    async getOwnReview(customerId, sku) {
      const r = await rest("GET", `reviews?select=*&customer_id=eq.${enc(customerId)}&product_sku=eq.${enc(sku)}&limit=1`);
      return r.data?.[0] || null;
    },
    async listOwnReviews(customerId) {
      const r = await rest("GET", `reviews?select=*&customer_id=eq.${enc(customerId)}&order=created_at.desc`);
      return r.data || [];
    },
    async insertReview(row) {
      const r = await rest("POST", "reviews", { body: row, prefer: "return=representation" });
      return r.data?.[0] || null;
    },
    async updateOwnReview(id, customerId, patch) {
      const r = await rest("PATCH", `reviews?id=eq.${enc(id)}&customer_id=eq.${enc(customerId)}`,
        { body: patch, prefer: "return=representation" });
      return r.data?.[0] || null;
    },
    async deleteOwnReview(customerId, sku) {
      const r = await rest("DELETE", `reviews?customer_id=eq.${enc(customerId)}&product_sku=eq.${enc(sku)}`,
        { prefer: "return=representation" });
      return Array.isArray(r.data) && r.data.length > 0;
    },

    /* ---- product Q&A ---- */
    async insertQuestion(row) {
      const r = await rest("POST", "product_questions", { body: row, prefer: "return=representation" });
      return r.data?.[0] || null;
    },
    async getOwnQuestion(customerId, id) {
      const r = await rest("GET", `product_questions?select=*&id=eq.${enc(id)}&customer_id=eq.${enc(customerId)}&limit=1`);
      return r.data?.[0] || null;
    },
    async listOwnQuestions(customerId) {
      const r = await rest("GET", `product_questions?select=*&customer_id=eq.${enc(customerId)}&order=created_at.desc&limit=200`);
      return r.data || [];
    },
    async deleteOwnPendingQuestion(customerId, id) {
      const r = await rest("DELETE",
        `product_questions?id=eq.${enc(id)}&customer_id=eq.${enc(customerId)}&status=eq.pending&answer=is.null`,
        { prefer: "return=representation" });
      return Array.isArray(r.data) && r.data.length > 0;
    },
  };
}
