import { useCallback, useEffect, useRef, useState } from "react";
import { useAdmin } from "../context/AdminContext.jsx";
import { fetchTotpSecret, verifyTotpCode } from "../lib/gmPortalClient.js";

/**
 * useGMPortal  \u2014  unlock state + timeout + TOTP verification
 *
 * State machine:
 *   'locked'    \u2014 GM must enter TOTP code
 *   'unlocked'  \u2014 portal accessible, timeout running
 *
 * Behavior:
 *   \u00B7 Unlock lasts 30 minutes of user activity. Any activity
 *     inside the portal (click, keypress) resets the timer.
 *   \u00B7 Unlock state is stored ONLY in React state \u2014 never in
 *     localStorage. That means a page refresh forces re-unlock,
 *     which is the correct security tradeoff. If we cached it,
 *     someone who briefly gets access to an unlocked machine
 *     could steal a persistent unlock.
 *   \u00B7 When admin session ends (sign-out) the portal auto-locks.
 *
 * Returns:
 *   {
 *     state: 'locked' | 'unlocked',
 *     unlock(code) \u2192 Promise<{ok, error?}>,
 *     lock(),
 *     touch()   \u2014 called by the portal UI on activity to reset timeout
 *   }
 */
const UNLOCK_DURATION_MS = 30 * 60 * 1000; // 30 minutes

export function useGMPortal() {
  const { admin } = useAdmin();
  const [state, setState] = useState("locked");
  const timeoutRef = useRef(null);

  /* Reset the auto-lock timer. Called on unlock and on any
     activity inside the portal. */
  const scheduleLock = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setState("locked");
      timeoutRef.current = null;
    }, UNLOCK_DURATION_MS);
  }, []);

  /* Attempt to unlock by verifying a TOTP code against the
     GM's stored secret. */
  const unlock = useCallback(async (code) => {
    if (!admin?.id) return { ok: false, error: "Not signed in as admin." };
    const secret = await fetchTotpSecret(admin.id);
    if (!secret) {
      return {
        ok: false,
        error: "TOTP not enrolled. Visit /admin/gm-setup to enroll your authenticator.",
      };
    }
    if (!verifyTotpCode(secret, code)) {
      return { ok: false, error: "Invalid code. Try again." };
    }
    setState("unlocked");
    scheduleLock();
    return { ok: true };
  }, [admin?.id, scheduleLock]);

  const lock = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setState("locked");
  }, []);

  /* Called by portal UI on user activity to reset the timeout.
     Debounced by the caller if needed \u2014 the hook itself is fine
     with being called every event. */
  const touch = useCallback(() => {
    if (state === "unlocked") scheduleLock();
  }, [state, scheduleLock]);

  /* If the admin signs out, immediately lock the portal. Prevents
     a lingering unlocked state if someone signs out and a
     different admin signs in on the same tab. */
  useEffect(() => {
    if (!admin?.id) lock();
  }, [admin?.id, lock]);

  /* Cleanup on unmount. */
  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  return { state, unlock, lock, touch };
}