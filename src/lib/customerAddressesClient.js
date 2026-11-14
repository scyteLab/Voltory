import { callCustomerData } from "./customerOrdersClient.js";
import { validateAddressInput } from "./addressRules.js";

/**
 * customerAddressesClient
 *
 * Saved addresses through the customer-data function ("address-*"
 * actions). The server scopes every call to the SIGNED-IN customer
 * (session cookie); the browser never sends a customer_id and never
 * touches the customer_addresses table.
 *
 * Every function returns { ok, error?, … } and never throws.
 */

const FAILED = "We couldn't save that right now. Please try again.";

function failure(status, data) {
  if (status === 401) return { ok: false, error: "Please sign in again to continue.", status };
  if (status === 404) return { ok: false, error: "That address no longer exists.", status };
  return { ok: false, error: (typeof data?.error === "string" && data.error.includes(" ")) ? data.error : FAILED, status };
}

/** Every saved address of the signed-in customer, default first. */
export async function fetchAddresses() {
  const { status, data } = await callCustomerData({ action: "address-list" });
  if (status === 200 && Array.isArray(data?.addresses)) return { ok: true, addresses: data.addresses };
  return { ...failure(status, data), addresses: [] };
}

export async function createAddress(input) {
  const checked = validateAddressInput(input);
  if (!checked.ok) return checked;
  const { status, data } = await callCustomerData({ action: "address-create", address: checked.value });
  if (status === 200 && data?.ok) return { ok: true, address: data.address };
  return failure(status, data);
}

export async function updateAddress(id, patch) {
  if (!id) return { ok: false, error: "Missing identifier" };
  const checked = validateAddressInput(patch);
  if (!checked.ok) return checked;
  const { status, data } = await callCustomerData({ action: "address-update", id, address: checked.value });
  if (status === 200 && data?.ok) return { ok: true, address: data.address };
  return failure(status, data);
}

export async function setDefaultAddress(id) {
  if (!id) return { ok: false, error: "Missing identifier" };
  const { status, data } = await callCustomerData({ action: "address-set-default", id });
  if (status === 200 && data?.ok) return { ok: true, address: data.address };
  return failure(status, data);
}

export async function deleteAddress(id) {
  if (!id) return { ok: false, error: "Missing identifier" };
  const { status, data } = await callCustomerData({ action: "address-delete", id });
  if (status === 200 && data?.ok) return { ok: true };
  return failure(status, data);
}
