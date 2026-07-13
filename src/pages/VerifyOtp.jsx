import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, ShieldCheck } from "lucide-react";
import { useStore } from "../context/StoreContext.jsx";

const RESEND_SECONDS = 30;

/** "08031234567" → "0803 123 4567" */
function formatPhone(p) {
  const d = (p || "").replace(/\D/g, "");
  if (d.length !== 11) return p;
  return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
}

export default function VerifyOtp() {
  const [searchParams] = useSearchParams();
  const phone = searchParams.get("phone");
  const path = searchParams.get("path") || "login"; // "login" | "signup"
  const payload = searchParams.get("payload");
  const returnTo = searchParams.get("return") || "/account";
  const navigate = useNavigate();
  const { signIn, account } = useStore();

  const [digits, setDigits] = useState(["", "", "", ""]);
  const [error, setError] = useState(null);
  const [resendIn, setResendIn] = useState(RESEND_SECONDS);
  const [unknownNumber, setUnknownNumber] = useState(false);
  const inputsRef = useRef([]);

  if (!phone) return <Navigate to="/login" replace />;

  // For login path: flag when the phone doesn't match an existing account.
  useEffect(() => {
    if (path === "login" && !account) setUnknownNumber(true);
    else setUnknownNumber(false);
  }, [path, phone, account]);

  // Resend countdown
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  // Focus first input on mount
  useEffect(() => { inputsRef.current[0]?.focus(); }, []);

  function setDigit(idx, value) {
    if (!/^\d?$/.test(value)) return;
    const next = [...digits];
    next[idx] = value;
    setDigits(next);
    setError(null);
    if (value && idx < 3) inputsRef.current[idx + 1]?.focus();
    if (idx === 3 && value && next.every((d) => d !== "")) submitCode(next.join(""));
  }

  function onKeyDown(idx, e) {
    if (e.key === "Backspace" && !digits[idx] && idx > 0) {
      inputsRef.current[idx - 1]?.focus();
    } else if (e.key === "ArrowLeft" && idx > 0) {
      inputsRef.current[idx - 1]?.focus();
    } else if (e.key === "ArrowRight" && idx < 3) {
      inputsRef.current[idx + 1]?.focus();
    }
  }

  function onPaste(e) {
    const pasted = (e.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, 4);
    if (pasted.length === 4) {
      e.preventDefault();
      setDigits(pasted.split(""));
      submitCode(pasted);
    }
  }

  function submitCode(code) {
    if (!/^\d{4}$/.test(code)) { setError("Code must be 4 digits"); return; }

    if (path === "signup" && payload) {
      try {
        signIn(JSON.parse(decodeURIComponent(payload)));
      } catch {
        setError("Something went wrong reading your signup details. Please start over.");
        return;
      }
    } else {
      const accountPhoneDigits = (account?.phone || "").replace(/\D/g, "");
      if (account && phone.replace(/\D/g, "") === accountPhoneDigits) {
        signIn(account); // touches updatedAt
      } else {
        signIn({ name: "", phone, email: "" });
      }
    }
    navigate(returnTo, { replace: true });
  }

  function resend() {
    if (resendIn > 0) return;
    setResendIn(RESEND_SECONDS);
    // Real impl will call the SMS API once Termii is integrated.
  }

  return (
    <div className="auth-card">
      <div className="auth-card__head">
        <span className="auth-card__icon"><ShieldCheck size={26} /></span>
        <h1>Verify your phone</h1>
        <p>
          We've sent a 4-digit code to <b className="mono">{formatPhone(phone)}</b>.
          <br />
          Enter it below to {path === "signup" ? "create your account" : "sign in"}.
        </p>
      </div>

      {unknownNumber && (
        <div className="auth-warn">
          <p>
            <b>We don't recognise this number.</b> No account exists yet for{" "}
            <b className="mono">{formatPhone(phone)}</b>. You can still verify and we'll
            create one for you — or{" "}
            <Link to={`/signup?return=${encodeURIComponent(returnTo)}`}>
              create an account properly
            </Link>{" "}
            with your name and email.
          </p>
        </div>
      )}

      <div className="otp-row" onPaste={onPaste}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => (inputsRef.current[i] = el)}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={d}
            onChange={(e) => setDigit(i, e.target.value)}
            onKeyDown={(e) => onKeyDown(i, e)}
            className={"otp-input" + (error ? " otp-input--error" : "")}
            aria-label={`Digit ${i + 1}`}
          />
        ))}
      </div>

      {error && <p className="auth-error">{error}</p>}

      <p className="auth-dev-hint">
        <small>Dev mode: any 4 digits will be accepted while we wait for Termii integration.</small>
      </p>

      <button
        className="otp-resend"
        onClick={resend}
        disabled={resendIn > 0}
        type="button"
      >
        {resendIn > 0 ? <>Resend code in <b>{resendIn}s</b></> : <>Resend code</>}
      </button>

      <p className="auth-foot">
        <Link to={path === "signup" ? "/signup" : "/login"}>
          <ChevronLeft size={14} style={{ verticalAlign: "middle" }} /> Use a different number
        </Link>
      </p>
    </div>
  );
}
