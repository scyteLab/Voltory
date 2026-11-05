import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import { useAdmin } from "../../context/AdminContext.jsx";
import { roleLabel } from "../../config/permissions.js";

/**
 * Shown in place of an admin page the signed-in role can't open
 * (AdminShell decides, from config/permissions.js). An account with
 * no role at all gets the same screen with a sign-out button.
 */
export default function NoAccess() {
  const { admin, role, signOutAdmin } = useAdmin();
  return (
    <div className="adm-page">
      <div className="adm-empty" style={{ maxWidth: 520, margin: "48px auto", textAlign: "center" }}>
        <Lock size={32} />
        <b>You don't have access to this page</b>
        {role ? (
          <p>
            You're signed in as <b>{admin?.email}</b> with the <b>{roleLabel(role)}</b> role.
            If you need this page, ask the GM to change your role.
          </p>
        ) : (
          <p>
            <b>{admin?.email}</b> has no active admin role. Ask the GM to add you on the Team page.
          </p>
        )}
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          {role
            ? <Link to="/admin" className="adm-btn adm-btn--primary">Back to dashboard</Link>
            : <button className="adm-btn adm-btn--primary" onClick={signOutAdmin}>Sign out</button>}
        </div>
      </div>
    </div>
  );
}
