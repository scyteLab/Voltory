import { useAdmin } from "../context/AdminContext.jsx";

/**
 * usePermission(key)
 *
 * Minimal permission gate for admin pages that want a named check
 * ("can I manage this?") instead of hardcoding a role comparison.
 *
 * Current behaviour: any admin with a real role (gm or staff) is
 * granted every permission — this matches how every other admin
 * page (including Collections) already behaves today, gated only
 * by AdminGuard. `key` isn't used for branching yet, but keeping it
 * in the signature means individual permissions can be split apart
 * by role later without touching call sites like
 * usePermission("catalog.offers.manage").
 */
export function usePermission(key) { // eslint-disable-line no-unused-vars
  const { isGM, isStaff } = useAdmin();
  return isGM || isStaff;
}
