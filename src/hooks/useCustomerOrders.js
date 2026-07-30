import { useEffect, useState } from "react";
import { fetchCustomerOrders } from "../lib/customerOrdersClient.js";
import { useCustomerAuth } from "../context/AuthContext.jsx";

/**
 * useCustomerOrders
 *
 * Fetches the signed-in customer's orders from Supabase (merged
 * with any localStorage-only orders) on mount. Refetches when the
 * customer identity changes.
 *
 * Returns { orders, loading, error, source, refresh }.
 *   \u00B7 orders  \u2014 always an array (possibly empty)
 *   \u00B7 loading \u2014 true only during first fetch
 *   \u00B7 error   \u2014 string message on Supabase failure (still returns local orders)
 *   \u00B7 source  \u2014 "supabase" | "local" \u2014 useful for a DevTools banner
 *   \u00B7 refresh \u2014 manual refetch (e.g. after placing an order)
 */
export function useCustomerOrders() {
  const { customer } = useCustomerAuth();
  const [state, setState] = useState({ orders: [], loading: true, error: null, source: null });

  const customerId = customer?.id || null;
  const phone      = customer?.phone || null;

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!customer) {
        // Not signed in \u2014 nothing to fetch. Emit empty list.
        setState({ orders: [], loading: false, error: null, source: null });
        return;
      }
      setState((s) => ({ ...s, loading: true }));
      const res = await fetchCustomerOrders({ customerId, phone });
      if (cancelled) return;
      setState({
        orders:  res.orders,
        loading: false,
        error:   res.error,
        source:  res.source,
      });
    }

    run();
    return () => { cancelled = true; };
  }, [customerId, phone, customer]);

  async function refresh() {
    if (!customer) return;
    setState((s) => ({ ...s, loading: true }));
    const res = await fetchCustomerOrders({ customerId, phone });
    setState({ orders: res.orders, loading: false, error: res.error, source: res.source });
  }

  return { ...state, refresh };
}