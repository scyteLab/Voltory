import { useAdmin } from "../context/AdminContext.jsx";
import { can } from "../config/permissions.js";

/**
 * usePermission(key | [keys])
 *
 * True when the signed-in admin's role grants the key (or any of
 * the keys). The role → permission map lives in
 * src/config/permissions.js. No role (or a deactivated account)
 * → false for everything.
 *
 *   const canCancel = usePermission("orders.cancel");
 */
export function usePermission(key) {
  const { role } = useAdmin();
  return can(role, key);
}

/** Tooltip for a control the current role can't use. */
export const NO_ACCESS_TIP = "Your role doesn't allow this. Ask the GM.";
