import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, BadgeCheck, Banknote, Check, CreditCard, Facebook,
  Headphones, Instagram, Lock, Mail, MapPin, MessageCircle, Music2,
  Phone, ShieldCheck, Truck, Twitter, Youtube,
} from "lucide-react";
import { SITE } from "../../config/site.js";
import { legalNameWithReg } from "../../config/businessInfo.js";
import { useStore } from "../../context/StoreContext.jsx";
import { subscribeNewsletter } from "../../lib/publicFormsClient.js";
import { usePublicFormGuard } from "../../hooks/usePublicFormGuard.js";
import HoneypotField from "../ui/HoneypotField.jsx";
import Logo from "./Logo.jsx";

const BADGE_ICONS = { "Secure Payments": Lock, "Pay on Delivery": Banknote, "Nationwide Delivery": Truck };

/**
 * Footer link map — single source of truth for where each label
 * routes. Labels not in the map fall through to "#" so a developer
 * spots them immediately. Updated to route Blog to its own page.
 */
const LINK_MAP = {
  "All Categories": "/categories",
  "Bestsellers": "/best-sellers",
  "New Arrivals": "/new",
  "Deals & Offers": "/deals",
  "Clearance Sale": "/deals",
  "Installation Services": "/services/installation",
  "Help Center": "/help",
  "Track Your Order": "/track-order",
  "Returns & Refunds": "/returns",
  "Warranty Information": "/help#warranty",
  "Review Guidelines": "/reviews-guidelines",
  "Contact Us": "/contact",
  "FAQs": "/help#faqs",
  "About Us": "/about",
  "Our Brands": "/brands",
  "Blog": "/blog",
  "Careers": "/careers",
  "Terms & Conditions": "/terms",
  "Privacy Policy": "/privacy",
};

function resolveLink(label) {
  return LINK_MAP[label] || "#";
}

export default function Footer() {
  const { requestCall } = useStore();
  const [email, setEmail] = useState("");
  const [state, setState] = useState("idle"); // idle | sending | ok | dup | invalid | err
  const guard = usePublicFormGuard("newsletter");

  async function onSubmit(e) {
    e.preventDefault();
    if (state === "sending" || guard.cooldownLeft > 0) return;

    // Honeypot filled: almost certainly a bot. Pretend it worked.
    if (guard.isBot()) {
      guard.markSent();
      setState("ok");
      return;
    }

    setState("sending");
    const result = await subscribeNewsletter({ email, source: "footer" });
    if (result.ok) {
      guard.markSent();
      setState(result.duplicate ? "dup" : "ok");
      setEmail("");
      setTimeout(() => setState("idle"), 3500);
    } else {
      setState(result.reason === "invalid" ? "invalid" : "err");
    }
  }

  return (
    <footer className="ftr">
      {/* main grid */}
      <div className="wrap ftr__grid">
        <div className="ftr__col ftr__col--brand">
          <Logo variant="lockup" ariaLabel="NAVEN — The Premium Electronics" />
          <div className="ftr__contact">
            <a
              href={`tel:${SITE.phone.replace(/\s/g, "")}`}
              onClick={(e) => { e.preventDefault(); requestCall(SITE.phone); }}
            >
              <Phone size={13} /> {SITE.phone}
            </a>
            <a href={`mailto:${SITE.supportEmail}`}><Mail size={13} /> {SITE.supportEmail}</a>
            <span><MapPin size={13} /> Lagos, Nigeria</span>
          </div>
          <div className="ftr__social">
            <a href="https://web.facebook.com/mynavenhq/" target="_blank" rel="noreferrer" aria-label="Facebook" className="ftr__social-icon"><Facebook size={15} /></a>
            <a href="https://www.instagram.com/mynavenhq" target="_blank" rel="noreferrer" aria-label="Instagram" className="ftr__social-icon"><Instagram size={15} /></a>
            <a href="https://x.com/mynavenhq" target="_blank" rel="noreferrer" aria-label="X (Twitter)" className="ftr__social-icon"><Twitter size={15} /></a>
            <a href="https://www.tiktok.com/@mynavenhq" target="_blank" rel="noreferrer" aria-label="TikTok" className="ftr__social-icon"><Music2 size={15} /></a>
            <a href="https://www.youtube.com/@mynavenhq" target="_blank" rel="noreferrer" aria-label="YouTube" className="ftr__social-icon"><Youtube size={15} /></a>
            <a href={SITE.whatsappLink} target="_blank" rel="noreferrer" aria-label="WhatsApp" className="ftr__social-icon"><MessageCircle size={15} /></a>
          </div>
        </div>

        {SITE.footerColumns.map((col) => (
          <div className="ftr__col" key={col.title}>
            <h5>{col.title}</h5>
            {col.links.map((l) => {
              const to = resolveLink(l);
              return <Link key={l} to={to}>{l}</Link>;
            })}
          </div>
        ))}

        <div className="ftr__col">
          <h5>Stay Updated</h5>
          <p className="ftr__news-blurb">
            Subscribe for the latest deals, news and expert tips.
          </p>
          <form
            className={"ftr__news" + (state === "ok" ? " ftr__news--ok" : "")}
            onSubmit={onSubmit}
            noValidate
          >
            <HoneypotField value={guard.honeypot} onChange={guard.setHoneypot} />
            <input
              type="email"
              placeholder={state === "ok" ? "You're on the list!" : "Enter your email"}
              aria-label="Email address"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setState("idle"); }}
              disabled={state === "ok" || state === "sending"}
              maxLength={254}
              autoComplete="email"
            />
            <button type="submit" aria-label="Subscribe" disabled={state === "sending" || guard.cooldownLeft > 0}>
              {state === "ok" ? <Check size={16} /> : <ArrowRight size={16} />}
            </button>
          </form>
          {state === "dup" && <small className="ftr__news-msg">You're already subscribed.</small>}
          {state === "invalid" && <small className="ftr__news-msg ftr__news-msg--err">Please enter a valid email.</small>}
          {state === "err" && (
            <small className="ftr__news-msg ftr__news-msg--err">
              Couldn't subscribe right now. Try again, or{" "}
              <a href={SITE.whatsappLink} target="_blank" rel="noreferrer">message us on WhatsApp</a>.
            </small>
          )}

          <h5 className="ftr__pay-head">We Accept</h5>
          <div className="ftr__pay">
            <span><CreditCard size={16} /> Cards</span>
            <span><Banknote size={16} /> Transfer</span>
            <span><Banknote size={16} /> Pay on Delivery</span>
          </div>
        </div>
      </div>

      {/* trust bar */}
      <div className="ftr__trust">
        <div className="wrap ftr__trust-inner">
          <span><ShieldCheck size={14} /> Secure Payments</span>
          <span><Truck size={14} /> Nationwide Delivery</span>
          <span><Headphones size={14} /> 24/7 Support</span>
          <span><BadgeCheck size={14} /> Original Products</span>
        </div>
      </div>

      {/* bottom bar */}
      <div className="wrap ftr__base">
        <span>&copy; {SITE.copyrightYear} {legalNameWithReg}</span>
        <span className="ftr__legal">
          <Link to="/privacy">Privacy Policy</Link>
          <Link to="/terms">Terms &amp; Conditions</Link>
        </span>
      </div>
    </footer>
  );
}