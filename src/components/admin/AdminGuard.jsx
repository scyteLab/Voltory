import { Navigate } from "react-router-dom";
import { useAdmin } from "../../context/AdminContext.jsx";

/**
 * Same shape as components/ui/AuthGuard.jsx, checking the real
 * Supabase admin session instead of the storefront's local account.
 *
 *   <Route element={<AdminGuard><AdminLayout/></AdminGuard>}>
 *     <Route path="/admin" element={<AdminDashboard/>} />
 *   </Route>
 */
export default function AdminGuard({ children }) {
  const { session, adminLoading } = useAdmin();

  if (adminLoading) return null; // brief — avoid a login flash while the session check resolves
  if (!session) return <Navigate to="/admin/login" replace />;
  return children;
}
