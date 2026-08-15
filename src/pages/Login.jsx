import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Phone } from "lucide-react";
import { useCustomerAuth } from "../context/AuthContext.jsx";
import AuthShell from "../components/auth/AuthShell.jsx";

/**
 * Login  —  /login
 *
 * REDESIGN: dropped the orbital-bubble character showcase in
 * favor of a Termii-style animated brand panel. Now uses the
 * shared AuthShell + AuthShowcase components so the visual
 * language stays consistent with SignUp forever.
 *
 * Form logic unchanged from the previous version — clean phone
 * number, call requestOtp, surface errors, navigate to /verify-otp
 * on success.
 */
export default function Login() {
  const navigate = useNavigate();
  const { requestOtp } = useCustomerAuth();

  const [phone, setPhone]           = useState("");
  const [error, setError]           = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const prev = document.title;
    document.title = "Sign in — NAVEN";
    return () => { document.title = prev; };
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);

    /* Clean the phone: strip non-digits, coerce +234 or missing
       leading 0 to canonical 11-digit local form. Server does
       the final validation. */
    const digits = phone.replace(/\D/g, "");
    let cleaned = digits;
    if (cleaned.startsWith("234")) cleaned = "0" + cleaned.slice(3);
    if (cleaned.length === 10 && !cleaned.startsWith("0")) cleaned = "0" + cleaned;

    if (!/^0[7-9][01]\d{8}$/.test(cleaned)) {
      setError("Please enter a valid Nigerian phone number.");
      return;
    }

    setSubmitting(true);
    const res = await requestOtp({ phone: cleaned, purpose: "login" });
    setSubmitting(false);

    if (!res.ok) {
      setError(res.error || "Couldn't send code. Please try again.");
      return;
    }
    navigate("/verify-otp", { state: { phone: cleaned, purpose: "login" } });
  }

  return (
    <AuthShell>
      <div className="ashell-form__inner">
        {/* Segmented control that visually shows Sign in / Sign up
            as tabs. Links to real routes; keeps the pages separate
            per your design decision, but presents them as a
            connected pair like Termii. */}
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
          Enter your phone number to sign in. We'll send you a 4-digit code to verify.
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

          {error && <div className="ashell-error">{error}</div>}

          <button
            type="submit"
            className="ashell-btn ashell-btn--primary"
            disabled={submitting || !phone.trim()}
          >
            {submitting ? "Sending…" : "Continue →"}
          </button>
        </form>

        <div className="ashell-form__note">
          <b>Already shopped with us?</b>
          <p>
            Your account was created automatically the first time you checked out.
            Just enter the phone number you used and we'll sign you straight in.
          </p>
        </div>

        <p className="ashell-form__legal">
          By continuing you agree to NAVEN's{" "}
          <Link to="/terms">Terms</Link> &amp;{" "}
          <Link to="/privacy">Privacy Policy</Link>.
        </p>
      </div>
    </AuthShell>
  );
}