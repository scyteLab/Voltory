import React from "react";
import { Navigate } from "react-router-dom";
import { useAdmin } from "../../context/AdminContext.jsx";

class AdminRouteBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
          <section style={{ maxWidth: 480, textAlign: "center" }}>
            <h1>Admin console unavailable</h1>
            <p>Something went wrong while loading this page. Reload to try again.</p>
            <button type="button" onClick={() => window.location.reload()}>Reload admin</button>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}

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

  if (adminLoading) {
    return (
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <p>Checking admin session...</p>
      </main>
    );
  }
  if (!session) return <Navigate to="/admin/login" replace />;
  return <AdminRouteBoundary>{children}</AdminRouteBoundary>;
}
