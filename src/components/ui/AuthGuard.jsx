import { Navigate, useLocation } from "react-router-dom";
import { useCustomerAuth } from "../../context/AuthContext.jsx";

/**
 * Wrap a route element in <AuthGuard>...</AuthGuard> to require
 * sign-in. Unauthenticated visits redirect to /login carrying the
 * intended destination, so post-login they bounce right back.
 *
 *   <Route element={<AuthGuard><AccountLayout/></AuthGuard>}>
 *     <Route path="orders" element={<AccountOrders/>} />
 *   </Route>
 *
 * Reads sign-in state from the AuthProvider (real Supabase-backed
 * session). Renders nothing while the initial session resolve is
 * in flight — avoids the flash of "not signed in → redirect" that
 * would happen on a fresh page load / refresh.
 */
export default function AuthGuard({ children }) {
  const { customer, loading } = useCustomerAuth();
  const location = useLocation();

  // Session still being resolved on mount — wait, don't redirect.
  if (loading) return null;

  if (!customer) {
    return (
      <Navigate
        to={`/login?return=${encodeURIComponent(location.pathname + location.search)}`}
        replace
      />
    );
  }
  return children;
}