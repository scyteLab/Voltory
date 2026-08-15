import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import {
  AlertTriangle, CheckCircle2, KeyRound, Loader2, ShieldCheck,
} from "lucide-react";
import { useAdmin } from "../../context/AdminContext.jsx";
import {
  generateTotpSecret, verifyTotpCode, confirmTotpEnrollment,
} from "../../lib/gmPortalClient.js";

/**
 * GMSetup  —  /admin/gm-setup
 *
 * One-time TOTP enrollment for the GM. Steps:
 *   1. We generate a fresh TOTP secret + otpauth URL
 *   2. GM scans the QR code with Google Authenticator (or any
 *      TOTP app — Authy, 1Password, etc.)
 *   3. GM enters a test code
 *   4. If valid, we save the secret to admin_roles and mark
 *      enrollment complete
 *   5. Redirect to /admin/gm-portal
 *
 * Guards:
 *   · Only GMs can access this page. Non-GMs redirect to /admin.
 *   · If GM is already enrolled, we let them re-enroll
 *     (overwriting the old secret) — useful for "I lost my phone."
 *     A warning banner shows this is destructive.
 *
 * Security notes:
 *   · The secret is generated client-side and never leaves the
 *     GM's browser until they confirm the enrollment via a valid
 *     TOTP code. If they close the tab before confirming, the
 *     secret is lost — which is correct behaviour.
 *   · We hold the secret in React state during setup. If the
 *     GM navigates away and back, they get a fresh secret. Also
 *     correct — no half-enrolled state persists.
 */
export default function GMSetup() {
  const { admin, isGM, roleLoading, totpEnrolled, refreshRole } = useAdmin();
  const navigate = useNavigate();

  const [candidate, setCandidate] = useState(null); // { secret, otpauthUrl }
  const [code, setCode]           = useState("");
  const [error, setError]         = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]           = useState(false);

  /* Generate the candidate secret once on mount. If the GM
     reloads the page or navigates away, they get a fresh secret
     next time — no persistence, no "in-progress" state to
     manage. */
  useEffect(() => {
    if (!admin?.email) return;
    setCandidate(generateTotpSecret(admin.email));
  }, [admin?.email]);

  /* Guards — wait for role check, then enforce GM access. */
  if (roleLoading) {
    return <div className="adm-page"><div className="hb__loading">Checking access…</div></div>;
  }
  if (!isGM) return <Navigate to="/admin" replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!candidate?.secret) {
      setError("Setup key not ready. Refresh the page.");
      return;
    }
    if (!verifyTotpCode(candidate.secret, code)) {
      setError("That code doesn't match. Check your authenticator and try the current 6-digit code.");
      return;
    }
    setSubmitting(true);
    const res = await confirmTotpEnrollment(admin.id, candidate.secret);
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error || "Couldn't save enrollment. Try again.");
      return;
    }
    await refreshRole();
    setDone(true);
    setTimeout(() => navigate("/admin/gm-portal", { replace: true }), 1500);
  }

  if (done) {
    return (
      <div className="adm-page adm-gm-setup__done">
        <CheckCircle2 size={48} className="adm-gm-setup__done-icon" />
        <h1>Enrollment complete</h1>
        <p>Taking you to the GM Approvals portal…</p>
      </div>
    );
  }

  return (
    <div className="adm-page">
      <header className="adm-page__head">
        <div>
          <h1>GM Portal — Authenticator setup</h1>
          <p>
            Two-factor authentication protects the approvals portal.
            You'll scan a QR code once, then enter a code from your
            authenticator every time you unlock the portal.
          </p>
        </div>
      </header>

      {totpEnrolled && (
        <div className="adm-gm-setup__warn">
          <AlertTriangle size={16} />
          <div>
            <b>You are already enrolled.</b>
            <p>
              Completing this setup will REPLACE your existing authenticator.
              Only proceed if you lost your device or want to re-enroll.
            </p>
          </div>
        </div>
      )}

      <div className="adm-gm-setup__grid">
        {/* Step 1: Scan the QR */}
        <div className="adm-gm-setup__step">
          <div className="adm-gm-setup__num">1</div>
          <div className="adm-gm-setup__body">
            <h2>Scan with your authenticator</h2>
            <p>
              Open Google Authenticator (or Authy, 1Password, Microsoft
              Authenticator) and scan this QR code. A new "NAVEN Admin"
              entry will appear.
            </p>

            <div className="adm-gm-setup__qr">
              {candidate ? (
                <QRCodeSVG
                  value={candidate.otpauthUrl}
                  size={200}
                  level="M"
                  bgColor="#ffffff"
                  fgColor="#0f172a"
                />
              ) : (
                <Loader2 className="waq-spin" />
              )}
            </div>

            {candidate && (
              <details className="adm-gm-setup__manual">
                <summary>Can't scan? Enter this key manually</summary>
                <code>{candidate.secret}</code>
              </details>
            )}
          </div>
        </div>

        {/* Step 2: Verify */}
        <div className="adm-gm-setup__step">
          <div className="adm-gm-setup__num">2</div>
          <div className="adm-gm-setup__body">
            <h2>Enter the current code</h2>
            <p>
              Type the 6-digit code your authenticator is showing right now.
              We'll only save your enrollment after we confirm this works.
            </p>

            <form onSubmit={onSubmit} className="adm-gm-setup__form">
              <label>
                <span>Authenticator code</span>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={6}
                  placeholder="000000"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                    setError(null);
                  }}
                  disabled={submitting}
                />
              </label>

              {error && (
                <div className="adm-gm-setup__err">
                  <AlertTriangle size={13} /> {error}
                </div>
              )}

              <button
                type="submit"
                className="adm-btn adm-btn--primary"
                disabled={submitting || code.length !== 6}
              >
                {submitting ? "Verifying…" : "Confirm enrollment"}
                <ShieldCheck size={14} />
              </button>
            </form>
          </div>
        </div>
      </div>

      <div className="adm-gm-setup__tip">
        <KeyRound size={14} />
        <div>
          <b>Save your recovery codes</b>
          <p>
            Google Authenticator lets you export your codes to a backup.
            Do this now — if you lose your phone without a backup, you'll
            need direct DB access to reset enrollment.
          </p>
        </div>
      </div>
    </div>
  );
}