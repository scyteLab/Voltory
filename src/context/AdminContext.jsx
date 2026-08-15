import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";
import { fetchAdminRole } from "../lib/gmPortalClient.js";

/**
 * Admin session state, backed by Supabase Auth (real, server-checked \u2014
 * unlike the storefront's phone-only StoreContext auth).
 *
 * Extended in the GM Portal sub-session to also fetch the
 * admin's role from admin_roles (if any). Existing callers of
 * useAdmin() continue to work \u2014 session / admin / adminLoading /
 * signInAdmin / signOutAdmin / changePassword are unchanged.
 * New: role, isGM, isStaff, roleLoading, totpEnrolled, refreshRole.
 */
const Ctx = createContext(null);

export function AdminProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = still checking

  /* Role state \u2014 fetched from admin_roles once we have a session.
     Null means "checked and this user has no role row" (i.e. they
     can sign in but aren't a designated GM or staff). Undefined
     means "not yet checked." */
  const [roleData, setRoleData] = useState(undefined); // undefined = loading

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data }) => setSession(data.session))
      .catch(() => setSession(null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  /* When session changes (sign-in, sign-out, refresh), refetch
     the role. This is the single source of truth for isGM. */
  useEffect(() => {
    let cancelled = false;
    async function loadRole() {
      console.log("[AdminContext] loadRole called, user id =", session?.user?.id);
      if (!session?.user?.id) {
        if (!cancelled) setRoleData(null);
        return;
      }
      setRoleData(undefined);
      const data = await fetchAdminRole(session.user.id);
      console.log("[AdminContext] fetchAdminRole returned =", data);
      if (!cancelled) setRoleData(data);
    }
    loadRole();
    return () => { cancelled = true; };
  }, [session?.user?.id]);

  const signInAdmin = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.session;
  };

  const signOutAdmin = async () => {
    await supabase.auth.signOut();
  };

  /* Requires the current password again before rotating it, so a
     hijacked-but-unlocked session alone can't change the password. */
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

  /* Force a re-fetch of the role. Called after TOTP enrollment
     completes so isGM / totpEnrolled reflect the new state
     without needing to sign out and back in. */
  const refreshRole = async () => {
    if (!session?.user?.id) return;
    const data = await fetchAdminRole(session.user.id);
    setRoleData(data);
  };

  const role         = roleData?.role ?? null;
  const isGM         = role === "gm";
  const isStaff      = role === "staff";
  const totpEnrolled = Boolean(roleData?.totp_enrolled_at);

  return (
    <Ctx.Provider
      value={{
        session,
        adminLoading: session === undefined,
        admin: session?.user ?? null,
        signInAdmin, signOutAdmin, changePassword,
        // GM portal additions
        role, isGM, isStaff, totpEnrolled,
        roleLoading: roleData === undefined,
        refreshRole,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useAdmin = () => useContext(Ctx);