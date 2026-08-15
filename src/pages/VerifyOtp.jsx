import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, ShieldCheck } from "lucide-react";
import { useCustomerAuth } from "../context/AuthContext.jsx";

const RESEND_SECONDS = 30;

/** "08031234567" → "0803 123 4567" */
function formatPhone(p) {
  const d = (p || "").replace(/\D/g, "");
  if (d.length !== 11) return p;
  return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
}

/**
 * VerifyOtp — Session 30
 *
 * Reads phone + path (login|signup) + optional payload from the URL.
 * Calls verifyOtp() from AuthContext on submission. On success the
 * AuthContext state updates and we navigate to returnTo (default
 * /account).
 *
 * The "Development Mode: OTP is 1234" banner is deliberately loud.
 * Session 32 removes it when Termii is wired.
 */
export default function VerifyOtp() {
  const [searchParams] = useSearchParams();
  const phone = searchParams.get("phone");
  const path = searchParams.get("path") || "login"; // "login" | "signup"
  const payload = searchParams.get("payload");
  const returnTo = searchParams.get("return") || "/account";
  const navigate = useNavigate();
  const { verifyOtp, requestOtp } = useCustomerAuth();

  const [digits, setDigits] = useState(["", "", "", ""]);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [resendIn, setResendIn] = useState(RESEND_SECONDS);
  const inputsRef = useRef([]);

  if (!phone) return <Navigate to="/login" replace />;

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  useEffect(() => {
    inputsRef.current[0]?.focus();
    // Dev-only hint. Invisible in the UI; only shows up to anyone
    // who explicitly opens DevTools. Removed with the whole dev-OTP
    // path in Session 32 when Termii is wired.
    // eslint-disable-next-line no-console
    console.info(
      "%c[dev] NAVEN OTP = 1234",
      "color:#94a3b8;font-size:11px;font-style:italic"
    );
  }, []);

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

  async function submitCode(code) {
    if (!/^\d{4}$/.test(code)) { setError("Code must be 4 digits"); return; }

    let profile = {};
    if (path === "signup" && payload) {
      try {
        profile = JSON.parse(decodeURIComponent(payload));
      } catch {
        setError("Something went wrong reading your signup details. Please start over.");
        return;
      }
    }

    setSubmitting(true);
    const res = await verifyOtp({
      phone,
      code,
      purpose: path === "signup" ? "signup" : "login",
      profile,
    });
    setSubmitting(false);

    if (!res.ok) {
      setError(res.error || "That didn't work. Try again.");
      // Clear the inputs so they can retry
      setDigits(["", "", "", ""]);
      inputsRef.current[0]?.focus();
      return;
    }

    navigate(returnTo, { replace: true });
  }

  async function resend() {
    if (resendIn > 0) return;
    setResendIn(RESEND_SECONDS);
    await requestOtp({
      phone: phone.replace(/\s/g, ""),
      purpose: path === "signup" ? "signup" : "login",
    });
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
            disabled={submitting}
            aria-label={`Digit ${i + 1}`}
          />
        ))}
      </div>

      {error && <p className="auth-error">{error}</p>}

      <button
        className="otp-resend"
        onClick={resend}
        disabled={resendIn > 0 || submitting}
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