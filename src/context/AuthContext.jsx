import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  getCurrentCustomer,
  signUp as apiSignUp,
  signIn as apiSignIn,
  signOutCurrent,
  updateProfile as apiUpdateProfile,
  changePassword as apiChangePassword,
  UNAUTHORIZED_EVENT,
} from "../lib/customerAuth.js";

/**
 * AuthProvider  \u2014  storefront customer context (password-based)
 *
 * Phone + password, checked by the customer-auth Netlify function;
 * the session is an HttpOnly cookie (Phase 2 of the lockdown plan).
 *
 * Public API:
 *   customer          \u2014 signed-in customer or null
 *   isAuthenticated   \u2014 !!customer
 *   loading           \u2014 true during initial session resolve
 *   signUp({ phone, password, name, email? })   → { ok, customer, earlierGuestOrders }
 *   signIn({ phone, password })
 *   signOut()
 *   updateProfile(patch)
 *   changePassword({ currentPassword, newPassword })
 *   refresh()         \u2014 re-fetch current customer
 *
 * Backwards compatibility: the OLD requestOtp / verifyOtp
 * functions no longer exist. Any component still importing
 * them will fail at import time \u2014 which surfaces the
 * migration cleanly.
 */

const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading]   = useState(true);

  const refresh = useCallback(async () => {
    const c = await getCurrentCustomer();
    setCustomer(c);
    return c;
  }, []);

  // Any 401 from the customer functions (session expired, revoked by a
  // password change elsewhere, …): sign out locally. Account pages
  // then redirect to /login?return=<this page>.
  useEffect(() => {
    const onUnauthorized = () => setCustomer(null);
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
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

  const signUp = useCallback(async (args) => {
    const res = await apiSignUp(args);
    if (res.ok) setCustomer(res.customer);
    return res;
  }, []);

  const signIn = useCallback(async (args) => {
    const res = await apiSignIn(args);
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

  const changePassword = useCallback((args) => apiChangePassword(args), []);

  const value = useMemo(() => ({
    customer,
    isAuthenticated: !!customer,
    loading,
    signUp,
    signIn,
    signOut,
    updateProfile,
    changePassword,
    refresh,
  }), [customer, loading, signUp, signIn, signOut, updateProfile, changePassword, refresh]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCustomerAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useCustomerAuth must be used inside <AuthProvider>");
  return v;
}