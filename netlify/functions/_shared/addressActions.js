/**
 * Saved-address actions for customer-data (signed-in customers only).
 *
 *   address-list                         → { addresses }
 *   address-create      { address }      → { address }
 *   address-update      { id, address }  → { address }
 *   address-set-default { id }           → { address }
 *   address-delete      { id }           → { deleted }
 *
 * Every query is scoped to the SESSION customer on the server; the
 * browser never sends a customer_id (one in the body is ignored). An
 * id that isn't this customer's address is answered 404, exactly like
 * an id that doesn't exist. At most one default per customer.
 */
import { validateAddressInput } from "../../../src/lib/addressRules.js";

const ID_RE = /^[A-Za-z0-9-]{1,64}$/;
const LIMIT = 30;   // addresses per customer

/** customer_addresses row → what the owner gets back (no customer_id). */
export function toOwnAddress(row) {
  if (!row) return null;
  const { customer_id: _omit, ...rest } = row;
  return rest;
}

export function createAddressActions({ db, reply }) {
  const readId = (body) => {
    const id = body.id == null ? "" : String(body.id).trim();
    return ID_RE.test(id) ? id : null;
  };

  async function list(_body, session) {
    const rows = await db.listAddresses(session.customer.id);
    return reply(200, { ok: true, addresses: rows.map(toOwnAddress) });
  }

  async function create(body, session) {
    const checked = validateAddressInput(body.address);
    if (!checked.ok) return reply(400, { ok: false, error: checked.error });
    const customerId = session.customer.id;
    const existing = await db.listAddresses(customerId);
    if (existing.length >= LIMIT) return reply(400, { ok: false, error: `You can save up to ${LIMIT} addresses.` });
    const isDefault = checked.value.is_default || existing.length === 0;
    if (isDefault) await db.clearDefaultAddresses(customerId, null);
    const row = await db.insertAddress({ ...checked.value, is_default: isDefault, customer_id: customerId });
    return reply(200, { ok: true, address: toOwnAddress(row) });
  }

  async function update(body, session) {
    const id = readId(body);
    if (!id) return reply(400, { ok: false, error: "invalid_id" });
    const checked = validateAddressInput(body.address);
    if (!checked.ok) return reply(400, { ok: false, error: checked.error });
    const customerId = session.customer.id;
    const row = await db.updateOwnAddress(customerId, id, checked.value);
    if (!row) return reply(404, { ok: false, error: "not_found" });
    if (checked.value.is_default) await db.clearDefaultAddresses(customerId, id);
    return reply(200, { ok: true, address: toOwnAddress(row) });
  }

  async function setDefault(body, session) {
    const id = readId(body);
    if (!id) return reply(400, { ok: false, error: "invalid_id" });
    const customerId = session.customer.id;
    const row = await db.updateOwnAddress(customerId, id, { is_default: true });
    if (!row) return reply(404, { ok: false, error: "not_found" });
    await db.clearDefaultAddresses(customerId, id);
    return reply(200, { ok: true, address: toOwnAddress(row) });
  }

  async function remove(body, session) {
    const id = readId(body);
    if (!id) return reply(400, { ok: false, error: "invalid_id" });
    const deleted = await db.deleteOwnAddress(session.customer.id, id);
    if (!deleted) return reply(404, { ok: false, error: "not_found" });
    return reply(200, { ok: true, deleted: true });
  }

  return {
    "address-list": list,
    "address-create": create,
    "address-update": update,
    "address-set-default": setDefault,
    "address-delete": remove,
  };
}
