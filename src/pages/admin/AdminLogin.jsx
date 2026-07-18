import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { LockKeyhole, LogIn, Mail } from "lucide-react";
import { useAdmin } from "../../context/AdminContext.jsx";
import Logo from "../../components/layout/Logo.jsx";

/**
 * Standalone admin sign-in — deliberately not routed through the
 * storefront's <AuthLayout> (App.jsx), which is written for shoppers
 * (trust badges, "Create an account"). Same .auth-shell/.auth-card
 * visual language, admin-appropriate copy.
 */
export default function AdminLogin() {
  const { session, signInAdmin } = useAdmin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  if (session) return <Navigate to="/admin" replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signInAdmin(email.trim(), password);
      navigate("/admin", { replace: true });
    } catch {
      setError("Incorrect email or password.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-brand">
        <Link to="/" className="auth-brand__logo-link">
          <Logo tagline={false} />
        </Link>
        <div className="auth-brand__body">
          <h2 className="auth-brand__headline">Admin Console</h2>
          <p className="auth-brand__sub">Catalog, orders and settings — staff only.</p>
        </div>
        <p className="auth-brand__back">
          <Link to="/">← Back to store</Link>
        </p>
      </div>
      <div className="auth-form-panel">
        <div className="auth-card">
          <div className="auth-card__head">
            <span className="auth-card__icon"><LogIn size={26} /></span>
            <h1>Admin sign in</h1>
            <p>Enter your admin email and password to continue.</p>
          </div>

          <form onSubmit={onSubmit} className="auth-form" noValidate>
            <label className={"field" + (error ? " has-error" : "")}>
              <span className="field__label">Email</span>
              <span className="auth-input">
                <Mail size={16} />
                <input
                  type="email"
                  autoComplete="username"
                  placeholder="admin@voltory.ng"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(null); }}
                />
              </span>
            </label>

            <label className={"field" + (error ? " has-error" : "")}>
              <span className="field__label">Password</span>
              <span className="auth-input">
                <LockKeyhole size={16} />
                <input
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(null); }}
                />
              </span>
              {error && <span className="field__error">{error}</span>}
            </label>

            <button type="submit" className="auth-submit" disabled={submitting}>
              {submitting ? "Signing in…" : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
