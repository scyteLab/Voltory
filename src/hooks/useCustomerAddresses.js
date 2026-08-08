import { useCallback, useEffect, useState } from "react";
import {
  fetchAddresses,
  createAddress,
  updateAddress,
  setDefaultAddress,
  deleteAddress,
} from "../lib/customerAddressesClient.js";
import { useCustomerAuth } from "../context/AuthContext.jsx";

/**
 * useCustomerAddresses
 *
 * Loads the signed-in customer's saved addresses and exposes CRUD
 * helpers that re-fetch on success. Mirrors useCustomerOrders' shape
 * so account pages follow one convention.
 *
 * Returns { addresses, loading, error, refresh, create, update, makeDefault, remove }.
 * Every mutation helper returns { ok, error? } (same contract as
 * customerAddressesClient) so callers can show an inline error
 * without a refetch round-trip failing silently.
 */
export function useCustomerAddresses() {
  const { customer } = useCustomerAuth();
  const customerId = customer?.id || null;

  const [state, setState] = useState({ addresses: [], loading: true, error: null });

  const load = useCallback(async () => {
    if (!customerId) {
      setState({ addresses: [], loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    const res = await fetchAddresses(customerId);
    setState({ addresses: res.addresses, loading: false, error: res.ok ? null : res.error });
  }, [customerId]);

  useEffect(() => {
    load();
  }, [load]);

  const create = useCallback(async (input) => {
    const res = await createAddress(customerId, input);
    if (res.ok) await load();
    return res;
  }, [customerId, load]);

  const update = useCallback(async (id, patch) => {
    const res = await updateAddress(customerId, id, patch);
    if (res.ok) await load();
    return res;
  }, [customerId, load]);

  const makeDefault = useCallback(async (id) => {
    const res = await setDefaultAddress(customerId, id);
    if (res.ok) await load();
    return res;
  }, [customerId, load]);

  const remove = useCallback(async (id) => {
    const res = await deleteAddress(customerId, id);
    if (res.ok) await load();
    return res;
  }, [customerId, load]);

  return { ...state, refresh: load, create, update, makeDefault, remove };
}
