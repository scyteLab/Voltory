import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";

/**
 * Admin session state, backed by Supabase Auth (real, server-checked —
 * unlike the storefront's phone-only StoreContext auth). Single admin
 * account for now; no roles/permissions yet.
 */
const Ctx = createContext(null);

export function AdminProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = still checking

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data }) => setSession(data.session))
      // Network/config failure (e.g. Supabase not set up yet) should
      // resolve to "signed out", not leave the guard stuck loading forever.
      .catch(() => setSession(null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signInAdmin = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.session;
  };

  const signOutAdmin = async () => {
    await supabase.auth.signOut();
  };

  // Requires the current password again before rotating it, so a
  // hijacked-but-unlocked session alone can't change the password.
  const changePassword = async (currentPassword, newPassword) => {
    const email = session?.user?.email;
    if (!email) throw new Error("Not signed in.");
    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email, password: currentPassword,
    });
    if (reauthError) throw new Error("Current password is incorrect.");
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  };

  return (
    <Ctx.Provider
      value={{
        session,
        adminLoading: session === undefined,
        admin: session?.user ?? null,
        signInAdmin, signOutAdmin, changePassword,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useAdmin = () => useContext(Ctx);
