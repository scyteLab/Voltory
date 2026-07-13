import { useState } from "react";
import { Smartphone, X } from "lucide-react";
import { SITE } from "../../config/site.js";

/**
 * App download promo with the Pidgin-flavoured funny popup.
 * Both store buttons trigger the same popup — the app isn't out yet.
 * The popup is dismissable; clicks outside it also dismiss.
 */
export default function AppPromo() {
  const [open, setOpen] = useState(false);
  const p = SITE.app.funnyPopup;

  return (
    <>
      <section className="app-promo" aria-label="Download our app">
        <div className="wrap app-promo__inner">
          <div className="app-promo__copy">
            <span className="app-promo__kicker">
              <Smartphone size={14} /> Coming Soon
            </span>
            <h2>{SITE.app.headline}</h2>
            <p>{SITE.app.subhead}</p>
            <div className="app-promo__stores">
              <button className="storebtn" onClick={() => setOpen(true)}>
                <svg className="storebtn__icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                  <path fill="currentColor" d="M3 20.5V3.5c0-.4.3-.7.7-.7.2 0 .4.1.6.2L18.2 11l-13.9 9c-.2.1-.4.2-.6.2-.4 0-.7-.3-.7-.7Z M19.4 11.7l-3.1-2L4.4 18l11.9-7.7 3.1-2L4.4 6l11.9 8 3.1-2c.4-.3.6-.7.6-1 0-.3-.2-.7-.6-1Z"/>
                </svg>
                <span>
                  <small>Get it on</small>
                  <b>Google Play</b>
                </span>
              </button>
              <button className="storebtn" onClick={() => setOpen(true)}>
                <svg className="storebtn__icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                  <path fill="currentColor" d="M17.05 12.04c-.03-2.66 2.17-3.94 2.27-4-1.24-1.81-3.17-2.06-3.85-2.09-1.64-.17-3.2.96-4.03.96-.85 0-2.12-.94-3.5-.91-1.79.03-3.45 1.04-4.37 2.65-1.88 3.25-.48 8.06 1.34 10.71.91 1.3 1.99 2.76 3.39 2.7 1.36-.05 1.87-.88 3.52-.88 1.63 0 2.11.88 3.55.85 1.46-.02 2.39-1.31 3.28-2.62 1.04-1.5 1.46-2.96 1.49-3.04-.03-.01-2.86-1.1-2.89-4.33ZM14.5 4.2c.75-.91 1.26-2.18 1.12-3.45-1.08.04-2.39.72-3.16 1.63-.7.81-1.31 2.1-1.14 3.35 1.2.09 2.43-.62 3.18-1.53Z"/>
                </svg>
                <span>
                  <small>Download on the</small>
                  <b>App Store</b>
                </span>
              </button>
            </div>
          </div>
          <div className="app-promo__art">
            <Smartphone size={88} strokeWidth={1} />
          </div>
        </div>
      </section>

      {open && (
        <div className="popup-back" onClick={() => setOpen(false)}>
          <div className="popup" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <button className="popup__x" onClick={() => setOpen(false)} aria-label="Close">
              <X size={18} />
            </button>
            <span className="popup__emoji" aria-hidden="true">😅</span>
            <h3>{p.title}</h3>
            <p>{p.message}</p>
            <button className="popup__cta" onClick={() => setOpen(false)}>
              {p.button}
            </button>
          </div>
        </div>
      )}
    </>
  );
}