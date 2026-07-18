import { Phone, X } from "lucide-react";
import { useStore } from "../../context/StoreContext.jsx";

/**
 * Friendly Yes/No gate in front of every "tel:" link in the app —
 * dialing a stranger's number sight-unseen feels risky on mobile,
 * this makes the intent explicit before it happens.
 *
 * Mounted once in App.jsx, driven by StoreContext's callConfirm state
 * — every phone link in the app calls requestCall(SITE.phone) instead
 * of navigating straight to tel:.
 */
export default function CallConfirmModal() {
  const { callConfirm, cancelCall, confirmCall } = useStore();
  if (!callConfirm) return null;

  return (
    <div className="callconfirm__backdrop" onClick={cancelCall}>
      <div
        className="callconfirm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="callconfirm-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="callconfirm__x" onClick={cancelCall} aria-label="Close">
          <X size={16} />
        </button>
        <span className="callconfirm__icon">
          <Phone size={26} />
        </span>
        <h3 id="callconfirm-title">Give us a ring? 📞</h3>
        <p>
          We’ll open your dialer for <b>{callConfirm.phone}</b>. Promise it’s
          a friendly voice on the other end.
        </p>
        <div className="callconfirm__actions">
          <button className="callconfirm__no" onClick={cancelCall}>
            Not now
          </button>
          <button className="callconfirm__yes" onClick={confirmCall}>
            Yes, call!
          </button>
        </div>
      </div>
    </div>
  );
}
