import { Navigate, useLocation } from "react-router-dom";
import { useStore } from "../../context/StoreContext.jsx";

/**
 * Wrap a route element in <AuthGuard>...</AuthGuard> to require
 * sign-in. Unauthenticated visits redirect to /login carrying the
 * intended destination, so post-login they bounce right back.
 *
 *   <Route element={<AuthGuard><AccountLayout/></AuthGuard>}>
 *     <Route path="orders" element={<AccountOrders/>} />
 *   </Route>
 */
export default function AuthGuard({ children }) {
  const { account } = useStore();
  const location = useLocation();
  if (!account) {
    return (
      <Navigate
        to={`/login?return=${encodeURIComponent(location.pathname + location.search)}`}
        replace
      />
    );
  }
  return children;
}