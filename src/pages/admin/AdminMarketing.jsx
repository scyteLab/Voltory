import { useEffect, useState } from "react";
import { Megaphone, Percent, Save, Truck } from "lucide-react";
import {
  fetchCheckoutSettings, updateCheckoutSetting, FALLBACKS,
} from "../../lib/checkoutSettingsClient.js";
import { naira } from "../../utils/format.js";

/**
 * AdminMarketing  —  /admin/marketing
 *
 * Manages the two site-wide checkout values (free-delivery
 * threshold and default discount %).
 *
 * Coupon codes, approval workflow, and campaign management come
 * in follow-up sessions. This is the foundation.
 *
 * Design:
 *   · Two independent cards, each a small form. Editing one
 *     doesn't force saving the other.
 *   · Each card has its own save state so UI feedback is
 *     scoped to what the admin just did.
 *   · On mount we fetch current DB values. If the fetch fails,
 *     inputs are prepopulated with hardcoded fallbacks and a
 *     warning banner shows.
 *
 * NO ROLE GATING YET. Any admin who can reach this page can
 * edit both values.
 */
export default function AdminMarketing() {
  const [threshold, setThreshold] = useState(FALLBACKS.free_delivery_threshold_ngn);
  const [discount, setDiscount]   = useState(FALLBACKS.default_checkout_discount_pct);

  const [loading, setLoading]     = useState(true);
  const [loadError, setLoadError] = useState(null);

  /* Per-card save state:
       null    — idle
       'saving'— in-flight
       'saved' — success (auto-clears after 2s)
       {error} — failure with message                              */
  const [thresholdSave, setThresholdSave] = useState(null);
  const [discountSave,  setDiscountSave]  = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetchCheckoutSettings();
      if (cancelled) return;
      if (res.ok) {
        setThreshold(res.settings.free_delivery_threshold_ngn ?? FALLBACKS.free_delivery_threshold_ngn);
        setDiscount(res.settings.default_checkout_discount_pct ?? FALLBACKS.default_checkout_discount_pct);
        setLoadError(null);
      } else {
        setLoadError("Couldn't load current values from the database. Editing will still work, but you may be overwriting stale data.");
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  async function saveThreshold() {
    const n = Number(threshold);
    if (!Number.isFinite(n) || n < 0) {
      setThresholdSave({ error: "Enter a whole number of naira, 0 or higher." });
      return;
    }
    setThresholdSave("saving");
    const res = await updateCheckoutSetting("free_delivery_threshold_ngn", Math.round(n));
    if (res.ok) {
      setThresholdSave("saved");
      setTimeout(() => setThresholdSave(null), 2000);
    } else {
      setThresholdSave({ error: res.error || "Save failed. Try again." });
    }
  }

  async function saveDiscount() {
    const n = Number(discount);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      setDiscountSave({ error: "Enter a percentage between 0 and 100." });
      return;
    }
    setDiscountSave("saving");
    const res = await updateCheckoutSetting("default_checkout_discount_pct", n);
    if (res.ok) {
      setDiscountSave("saved");
      setTimeout(() => setDiscountSave(null), 2000);
    } else {
      setDiscountSave({ error: res.error || "Save failed. Try again." });
    }
  }

  if (loading) {
    return <div className="adm-page"><div className="hb__loading">Loading marketing settings…</div></div>;
  }

  return (
    <div className="adm-page">
      <header className="adm-page__head">
        <div>
          <h1>Marketing</h1>
          <p>Site-wide checkout values. Edits take effect immediately for all new orders.</p>
        </div>
      </header>

      {loadError && (
        <div className="mkt-warn">{loadError}</div>
      )}

      {/* ---- Free delivery threshold card ---- */}
      <section className="mkt-card">
        <div className="mkt-card__icon"><Truck size={20} /></div>
        <div className="mkt-card__body">
          <h2>Free delivery threshold</h2>
          <p>
            Delivery is free when the customer's cart subtotal is at or above this amount.
            Current value: <b>{naira(threshold)}</b>. Setting to 0 makes delivery always free.
          </p>

          <div className="mkt-field">
            <label htmlFor="threshold">Threshold (₦)</label>
            <div className="mkt-field__input">
              <span className="mkt-field__prefix">₦</span>
              <input
                id="threshold"
                type="number"
                min="0"
                step="1000"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                disabled={thresholdSave === "saving"}
              />
            </div>
          </div>

          {thresholdSave?.error && (
            <div className="mkt-error">{thresholdSave.error}</div>
          )}

          <div className="mkt-card__actions">
            <button
              className="adm-btn adm-btn--primary"
              onClick={saveThreshold}
              disabled={thresholdSave === "saving"}
            >
              <Save size={13} />
              {thresholdSave === "saving" ? "Saving…" :
               thresholdSave === "saved"  ? "Saved" :
                                             "Save threshold"}
            </button>
          </div>
        </div>
      </section>

      {/* ---- Default discount card ---- */}
      <section className="mkt-card">
        <div className="mkt-card__icon"><Percent size={20} /></div>
        <div className="mkt-card__body">
          <h2>Default checkout discount</h2>
          <p>
            A percentage applied to every customer's cart subtotal at checkout.
            Use 0 for no default discount. Use sparingly — anything you set here applies
            to every order until you change it back.
          </p>

          <div className="mkt-field">
            <label htmlFor="discount">Discount (%)</label>
            <div className="mkt-field__input">
              <input
                id="discount"
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                disabled={discountSave === "saving"}
              />
              <span className="mkt-field__suffix">%</span>
            </div>
          </div>

          {discountSave?.error && (
            <div className="mkt-error">{discountSave.error}</div>
          )}

          <div className="mkt-card__actions">
            <button
              className="adm-btn adm-btn--primary"
              onClick={saveDiscount}
              disabled={discountSave === "saving"}
            >
              <Save size={13} />
              {discountSave === "saving" ? "Saving…" :
               discountSave === "saved"  ? "Saved" :
                                            "Save discount"}
            </button>
          </div>
        </div>
      </section>

      {/* ---- Roadmap note ---- */}
      <section className="mkt-roadmap">
        <div className="mkt-roadmap__icon"><Megaphone size={16} /></div>
        <div>
          <b>Coming next</b>
          <p>
            Promo codes with an approval workflow, campaign scheduling, and per-customer discount limits.
            These are being built in a follow-up session and will surface here.
          </p>
        </div>
      </section>
    </div>
  );
}