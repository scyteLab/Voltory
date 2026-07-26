import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  ArrowLeft, BarChart3, Eye, EyeOff, Layers, LockKeyhole,
  Mail, ShieldCheck, Sparkles,
} from "lucide-react";
import { useAdmin } from "../../context/AdminContext.jsx";
import { AdminThemeProvider, useAdminTheme } from "../../context/AdminThemeContext.jsx";
import Logo from "../../components/layout/Logo.jsx";

/**
 * Admin login \u2014 split-panel professional design.
 *
 * LEFT (brand panel):
 *   Deep-navy gradient with subtle radial highlight. Logo top-left.
 *   Big brand headline + tagline. Three trust bullets. Copyright
 *   bottom-left.
 *
 * RIGHT (form panel):
 *   Centered card on light background. Minimal: title, email,
 *   password with reveal toggle, submit. Password reveal is a
 *   small UX win; no other bells and whistles.
 *
 * The whole shell is wrapped in AdminThemeProvider so login
 * inherits the last-used theme (from localStorage) even though
 * no admin is signed in.
 */
export default function AdminLogin() {
  return (
    <AdminThemeProvider>
      <LoginInner />
    </AdminThemeProvider>
  );
}

function LoginInner() {
  const { session, signInAdmin } = useAdmin();
  const { theme, themeVars } = useAdminTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
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
    <div className="adm-login" data-mode={theme.mode} style={themeVars}>
      {/* LEFT: brand panel */}
      <aside className="adm-login__brand">
        <Link to="/" className="adm-login__logo">
          <Logo tagline={false} />
        </Link>

        <div className="adm-login__brand-body">
          <span className="adm-login__eyebrow">ADMIN CONSOLE</span>
          <h2 className="adm-login__headline">
            The command center<br />for your business.
          </h2>
          <p className="adm-login__tagline">
            Real-time inventory, orders, warranty claims and reports —
            everything you need to run Voltory in one place.
          </p>

          <ul className="adm-login__pillars">
            <li>
              <span className="adm-login__pillar-icon"><Layers size={16} /></span>
              <div>
                <b>Full catalog control</b>
                <small>Manage products, images, prices, and inventory in real time.</small>
              </div>
            </li>
            <li>
              <span className="adm-login__pillar-icon"><BarChart3 size={16} /></span>
              <div>
                <b>Live reporting</b>
                <small>Revenue trends, top sellers, and status breakdowns at a glance.</small>
              </div>
            </li>
            <li>
              <span className="adm-login__pillar-icon"><ShieldCheck size={16} /></span>
              <div>
                <b>Secure and audited</b>
                <small>Row-level security. Every change tied to an operator.</small>
              </div>
            </li>
          </ul>
        </div>

        <p className="adm-login__footer">
          © {new Date().getFullYear()} Voltory. All rights reserved.
          <br />
          <Link to="/"><ArrowLeft size={11} /> Back to storefront</Link>
        </p>
      </aside>

      {/* RIGHT: form panel */}
      <main className="adm-login__form">
        <div className="adm-login__card">
          <div className="adm-login__card-head">
            <span className="adm-login__spark">
              <Sparkles size={20} />
            </span>
            <h1>Welcome back</h1>
            <p>Sign in to your admin account to continue.</p>
          </div>

          <form onSubmit={onSubmit} noValidate className="adm-login__fields">
            <label className={"adm-login__field" + (error ? " adm-login__field--err" : "")}>
              <span className="adm-login__label">Email address</span>
              <span className="adm-login__input">
                <Mail size={15} />
                <input
                  type="email"
                  autoComplete="username"
                  placeholder="admin@voltory.ng"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(null); }}
                  autoFocus
                />
              </span>
            </label>

            <label className={"adm-login__field" + (error ? " adm-login__field--err" : "")}>
              <span className="adm-login__label">Password</span>
              <span className="adm-login__input">
                <LockKeyhole size={15} />
                <input
                  type={showPw ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(null); }}
                />
                <button
                  type="button"
                  className="adm-login__reveal"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </span>
              {error && <span className="adm-login__err">{error}</span>}
            </label>

            <button
              type="submit"
              className="adm-login__submit"
              disabled={submitting}
            >
              {submitting ? "Signing in\u2026" : "Sign in to Admin"}
            </button>
          </form>

          <p className="adm-login__hint">
            Trouble signing in? Contact your administrator or reset your password from the Supabase project.
          </p>
        </div>
      </main>
    </div>
  );
}