import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  getCurrentCustomer,
  requestOtp as apiRequestOtp,
  verifyOtp as apiVerifyOtp,
  signOutCurrent,
  updateProfile as apiUpdateProfile,
} from "../lib/customerAuth.js";

/**
 * AuthProvider
 *
 * Provides the storefront with a customer context. A customer here
 * is a SIGNED-IN customer — one who went through the explicit signup
 * or login flow and has a session token.
 *
 * Guest checkouts do NOT populate this context. They create a
 * customer row via upsertFromCheckout (called from StoreContext),
 * but no session is minted, so `customer` stays null.
 *
 * API:
 *   customer           — signed-in customer or null
 *   isAuthenticated    — !!customer
 *   loading            — true during initial session resolve
 *   requestOtp({phone, purpose})
 *   verifyOtp({phone, code, purpose, profile})
 *   signOut()
 *   updateProfile(patch)
 *   refresh()          — re-fetch current customer
 */

const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const c = await getCurrentCustomer();
    setCustomer(c);
    return c;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const c = await getCurrentCustomer();
      if (!cancelled) {
        setCustomer(c);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const requestOtp = useCallback((args) => apiRequestOtp(args), []);

  const verifyOtp = useCallback(async (args) => {
    const res = await apiVerifyOtp(args);
    if (res.ok) setCustomer(res.customer);
    return res;
  }, []);

  const signOut = useCallback(async () => {
    await signOutCurrent();
    setCustomer(null);
  }, []);

  const updateProfile = useCallback(async (patch) => {
    const res = await apiUpdateProfile(patch);
    if (res.ok) setCustomer(res.customer);
    return res;
  }, []);

  const value = useMemo(() => ({
    customer,
    isAuthenticated: !!customer,
    loading,
    requestOtp,
    verifyOtp,
    signOut,
    updateProfile,
    refresh,
  }), [customer, loading, requestOtp, verifyOtp, signOut, updateProfile, refresh]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCustomerAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useCustomerAuth must be used inside <AuthProvider>");
  return v;
}