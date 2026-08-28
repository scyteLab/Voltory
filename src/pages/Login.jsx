import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, KeyRound, Phone } from "lucide-react";
import { useCustomerAuth } from "../context/AuthContext.jsx";
import AuthShell from "../components/auth/AuthShell.jsx";

/**
 * Login  \u2014  /login
 *
 * Password-based sign-in with phone as the identifier.
 *
 * If the user's phone exists in customers but they have no
 * password (legacy row from guest checkout), the API returns
 * needsSignup: true so we can nudge them to the signup page.
 */
export default function Login() {
  const navigate = useNavigate();
  const { signIn } = useCustomerAuth();

  const [phone, setPhone]           = useState("");
  const [password, setPassword]     = useState("");
  const [showPw, setShowPw]         = useState(false);
  const [error, setError]           = useState(null);
  const [needsSignup, setNeedsSignup] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const prev = document.title;
    document.title = "Sign in \u2014 NAVEN";
    return () => { document.title = prev; };
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setNeedsSignup(false);
    setSubmitting(true);

    const res = await signIn({ phone, password });
    setSubmitting(false);

    if (!res.ok) {
      setError(res.error || "Sign-in failed. Please try again.");
      if (res.needsSignup) setNeedsSignup(true);
      return;
    }
    navigate("/account", { replace: true });
  }

  return (
    <AuthShell>
      <div className="ashell-form__inner">
        <div className="ashell-form__tabs" role="tablist">
          <Link
            to="/login"
            role="tab"
            aria-selected="true"
            className="ashell-form__tab ashell-form__tab--active"
          >
            Sign in
          </Link>
          <Link
            to="/signup"
            role="tab"
            aria-selected="false"
            className="ashell-form__tab"
          >
            Create account
          </Link>
        </div>

        <h2 className="ashell-form__title">Welcome back</h2>
        <p className="ashell-form__sub">
          Enter your phone number and password to sign in.
        </p>

        <form onSubmit={onSubmit}>
          <div className="ashell-field">
            <label htmlFor="phone">Phone number</label>
            <div className="ashell-field__input">
              <Phone size={16} />
              <input
                id="phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                placeholder="0803 123 4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>

          <div className="ashell-field">
            <label htmlFor="password">Password</label>
            <div className="ashell-field__input">
              <KeyRound size={16} />
              <input
                id="password"
                type={showPw ? "text" : "password"}
                autoComplete="current-password"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
              />
              <button
                type="button"
                className="ashell-field__toggle"
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? "Hide password" : "Show password"}
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="ashell-error">
              {error}
              {needsSignup && (
                <>
                  {" "}
                  <Link to="/signup" style={{ textDecoration: "underline", fontWeight: 600 }}>
                    Sign up here
                  </Link>
                </>
              )}
            </div>
          )}

          <button
            type="submit"
            className="ashell-btn ashell-btn--primary"
            disabled={submitting || !phone.trim() || !password}
          >
            {submitting ? "Signing in\u2026" : "Sign in \u2192"}
          </button>
        </form>

        <p className="ashell-form__legal" style={{ marginTop: 24 }}>
          Forgot your password?{" "}
          <a href={`https://wa.me/2348000000000?text=${encodeURIComponent("Hi NAVEN, I forgot my password. My registered phone is: ")}`}
             target="_blank" rel="noreferrer">
            Contact support on WhatsApp
          </a>
        </p>

        <p className="ashell-form__legal">
          By continuing you agree to NAVEN's{" "}
          <Link to="/terms">Terms</Link> &amp;{" "}
          <Link to="/privacy">Privacy Policy</Link>.
        </p>
      </div>
    </AuthShell>
  );
}