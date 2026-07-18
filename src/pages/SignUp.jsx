import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AtSign, ChevronRight, Smartphone, User, UserPlus } from "lucide-react";
import { SITE } from "../config/site.js";

export default function SignUp() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState({});
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("return") || "/account";

  function onSubmit(e) {
    e.preventDefault();
    const errs = {};
    if (!name.trim()) errs.name = "Full name required";
    const cleanedPhone = phone.replace(/\s/g, "");
    if (!/^0[789][01]\d{8}$/.test(cleanedPhone)) {
      errs.phone = "Enter a valid Nigerian phone number";
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errs.email = "Invalid email format";
    }
    if (Object.keys(errs).length) { setErrors(errs); return; }

    const payload = encodeURIComponent(
      JSON.stringify({ name: name.trim(), phone: cleanedPhone, email: email.trim() })
    );
    navigate(
      `/verify-otp?phone=${encodeURIComponent(cleanedPhone)}&path=signup&payload=${payload}&return=${encodeURIComponent(returnTo)}`
    );
  }

  return (
    <div className="auth-card">
      <div className="auth-card__head">
        <span className="auth-card__icon"><UserPlus size={26} /></span>
        <h1>Create your account</h1>
        <p>Sign up to track orders, save addresses, and check out faster next time.</p>
      </div>

      <form onSubmit={onSubmit} className="auth-form" noValidate>
        <label className={"field" + (errors.name ? " has-error" : "")}>
          <span className="field__label">Full Name</span>
          <span className="auth-input">
            <User size={16} />
            <input
              type="text"
              autoComplete="name"
              placeholder="e.g. Chinedu Okafor"
              value={name}
              onChange={(e) => { setName(e.target.value); setErrors((er) => ({ ...er, name: undefined })); }}
            />
          </span>
          {errors.name && <span className="field__error">{errors.name}</span>}
        </label>

        <label className={"field" + (errors.phone ? " has-error" : "")}>
          <span className="field__label">
            Phone Number <small className="field__note">— your account ID</small>
          </span>
          <span className="auth-input">
            <Smartphone size={16} />
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="0803 123 4567"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setErrors((er) => ({ ...er, phone: undefined })); }}
            />
          </span>
          {errors.phone && <span className="field__error">{errors.phone}</span>}
        </label>

        <label className={"field" + (errors.email ? " has-error" : "")}>
          <span className="field__label">
            Email Address <small className="field__note">— optional</small>
          </span>
          <span className="auth-input">
            <AtSign size={16} />
            <input
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setErrors((er) => ({ ...er, email: undefined })); }}
            />
          </span>
          {errors.email && <span className="field__error">{errors.email}</span>}
        </label>

        <button type="submit" className="auth-submit">
          Send Verification Code <ChevronRight size={16} />
        </button>
      </form>

      <p className="auth-foot">
        Already have an account?{" "}
        <Link to={`/login${returnTo !== "/account" ? `?return=${encodeURIComponent(returnTo)}` : ""}`}>
          Sign in
        </Link>
      </p>

      <p className="auth-terms">
        By creating an account you agree to {SITE.name}'s Terms of Service and Privacy Policy.
        You don't need an account to shop — we can create one for you at checkout instead.
      </p>
    </div>
  );
}
