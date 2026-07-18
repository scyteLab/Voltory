import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ChevronRight, LogIn, Smartphone } from "lucide-react";
import { SITE } from "../config/site.js";

export default function Login() {
  const [phone, setPhone] = useState("");
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("return") || "/account";

  function onSubmit(e) {
    e.preventDefault();
    const cleaned = phone.replace(/\s/g, "");
    if (!/^0[789][01]\d{8}$/.test(cleaned)) {
      setError("Enter a valid Nigerian phone number (e.g. 0803 123 4567)");
      return;
    }
    navigate(
      `/verify-otp?phone=${encodeURIComponent(cleaned)}&path=login&return=${encodeURIComponent(returnTo)}`
    );
  }

  return (
    <div className="auth-card">
      <div className="auth-card__head">
        <span className="auth-card__icon"><LogIn size={26} /></span>
        <h1>Welcome back</h1>
        <p>Enter your phone number to sign in. We'll send you a 4-digit code to verify.</p>
      </div>

      <form onSubmit={onSubmit} className="auth-form" noValidate>
        <label className={"field" + (error ? " has-error" : "")}>
          <span className="field__label">Phone Number</span>
          <span className="auth-input">
            <Smartphone size={16} />
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="0803 123 4567"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setError(null); }}
            />
          </span>
          {error && <span className="field__error">{error}</span>}
        </label>

        <button type="submit" className="auth-submit">
          Send Verification Code <ChevronRight size={16} />
        </button>
      </form>

      <p className="auth-foot">
        New to {SITE.name}?{" "}
        <Link to={`/signup${returnTo !== "/account" ? `?return=${encodeURIComponent(returnTo)}` : ""}`}>
          Create an account
        </Link>
      </p>

      <div className="auth-aside">
        <p>
          <b>Already shopped with us?</b><br />
          Your account was created automatically the first time you checked out.
          Just enter the phone number you used and we'll sign you straight in.
        </p>
      </div>
    </div>
  );
}
