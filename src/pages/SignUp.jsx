import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Phone, User } from "lucide-react";
import { useCustomerAuth } from "../context/AuthContext.jsx";
import AuthShell from "../components/auth/AuthShell.jsx";

/**
 * SignUp  —  /signup
 *
 * REDESIGN: matches the new Login page visually via the shared
 * AuthShell. Tab strip flips "Create account" to active.
 *
 * Form logic unchanged — collect name + phone, requestOtp with
 * purpose 'signup', navigate to /verify-otp on success.
 */
export default function SignUp() {
  const navigate = useNavigate();
  const { requestOtp } = useCustomerAuth();

  const [name, setName]             = useState("");
  const [phone, setPhone]           = useState("");
  const [error, setError]           = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const prev = document.title;
    document.title = "Create account — NAVEN";
    return () => { document.title = prev; };
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);

    const cleanedName = name.trim();
    if (cleanedName.length < 2) {
      setError("Please enter your name.");
      return;
    }

    /* Same phone cleanup pattern as Login. */
    const digits = phone.replace(/\D/g, "");
    let cleaned = digits;
    if (cleaned.startsWith("234")) cleaned = "0" + cleaned.slice(3);
    if (cleaned.length === 10 && !cleaned.startsWith("0")) cleaned = "0" + cleaned;

    if (!/^0[7-9][01]\d{8}$/.test(cleaned)) {
      setError("Please enter a valid Nigerian phone number.");
      return;
    }

    setSubmitting(true);
    const res = await requestOtp({
      phone: cleaned,
      purpose: "signup",
      name:   cleanedName,
    });
    setSubmitting(false);

    if (!res.ok) {
      setError(res.error || "Couldn't send code. Please try again.");
      return;
    }
    navigate("/verify-otp", {
      state: { phone: cleaned, purpose: "signup", name: cleanedName },
    });
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
          Two quick fields and you're in. We'll send a code to your phone to confirm.
        </p>

        <form onSubmit={onSubmit}>
          <div className="ashell-field">
            <label htmlFor="name">Full name</label>
            <div className="ashell-field__input">
              <User size={16} />
              <input
                id="name"
                type="text"
                autoComplete="name"
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
            disabled={submitting || !phone.trim() || !name.trim()}
          >
            {submitting ? "Sending…" : "Continue →"}
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