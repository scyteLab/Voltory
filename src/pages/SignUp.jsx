import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, KeyRound, Mail, Phone, User } from "lucide-react";
import { useCustomerAuth } from "../context/AuthContext.jsx";
import AuthShell from "../components/auth/AuthShell.jsx";

/**
 * SignUp  \u2014  /signup
 *
 * Password-based account creation. Email is OPTIONAL \u2014
 * collected for future password-reset via email but not
 * required today (would block sign-up for Nigerian customers
 * without an active email).
 */
export default function SignUp() {
  const navigate = useNavigate();
  const { signUp } = useCustomerAuth();

  const [name, setName]             = useState("");
  const [phone, setPhone]           = useState("");
  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [confirm, setConfirm]       = useState("");
  const [showPw, setShowPw]         = useState(false);
  const [error, setError]           = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const prev = document.title;
    document.title = "Create account \u2014 NAVEN";
    return () => { document.title = prev; };
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    const res = await signUp({ phone, password, name, email: email || null });
    setSubmitting(false);

    if (!res.ok) {
      setError(res.error || "Couldn't create account. Please try again.");
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
            aria-selected="false"
            className="ashell-form__tab"
          >
            Sign in
          </Link>
          <Link
            to="/signup"
            role="tab"
            aria-selected="true"
            className="ashell-form__tab ashell-form__tab--active"
          >
            Create account
          </Link>
        </div>

        <h2 className="ashell-form__title">Create your account</h2>
        <p className="ashell-form__sub">
          Quick setup. Your phone is your login \u2014 email is optional for password recovery.
        </p>

        <form onSubmit={onSubmit}>
          <div className="ashell-field">
            <label htmlFor="name">Full name</label>
            <div className="ashell-field__input">
              <User size={16} />
              <input
                id="name" type="text" autoComplete="name"
                placeholder="Adaeze Okoye"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>

          <div className="ashell-field">
            <label htmlFor="phone">Phone number</label>
            <div className="ashell-field__input">
              <Phone size={16} />
              <input
                id="phone" type="tel" inputMode="numeric" autoComplete="tel"
                placeholder="0803 123 4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>

          <div className="ashell-field">
            <label htmlFor="email">Email (optional)</label>
            <div className="ashell-field__input">
              <Mail size={16} />
              <input
                id="email" type="email" autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
                autoComplete="new-password"
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

          <div className="ashell-field">
            <label htmlFor="confirm">Confirm password</label>
            <div className="ashell-field__input">
              <KeyRound size={16} />
              <input
                id="confirm"
                type={showPw ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Type it again"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>

          {error && <div className="ashell-error">{error}</div>}

          <button
            type="submit"
            className="ashell-btn ashell-btn--primary"
            disabled={submitting || !phone.trim() || !name.trim() || !password || !confirm}
          >
            {submitting ? "Creating account\u2026" : "Create account \u2192"}
          </button>
        </form>

        <p className="ashell-form__legal">
          By creating an account you agree to NAVEN's{" "}
          <Link to="/terms">Terms</Link> &amp;{" "}
          <Link to="/privacy">Privacy Policy</Link>.
        </p>
      </div>
    </AuthShell>
  );
}