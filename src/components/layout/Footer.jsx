import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, BadgeCheck, Banknote, Check, CreditCard, Facebook,
  Headphones, Instagram, Lock, Mail, MapPin, MessageCircle,
  Phone, ShieldCheck, Truck, Twitter,
} from "lucide-react";
import { SITE } from "../../config/site.js";
import { addSubscriber } from "../../utils/newsletterSubscribers.js";
import Logo from "./Logo.jsx";

const BADGE_ICONS = { "Secure Payments": Lock, "Pay on Delivery": Banknote, "Nationwide Delivery": Truck };

/**
 * Footer link map \u2014 single source of truth for where each label
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
  "Returns & Refunds": "/help#returns",
  "Warranty Information": "/help#warranty",
  "Contact Us": "/contact",
  "FAQs": "/help#faqs",
  "About Us": "/about",
  "Our Brands": "/brands",
  "Blog": "/blog",
  "Careers": "/careers",
  "Terms & Conditions": "#",
  "Privacy Policy": "#",
};

function resolveLink(label) {
  return LINK_MAP[label] || "#";
}

export default function Footer() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState("idle"); // idle | ok | dup | err

  function onSubmit(e) {
    e.preventDefault();
    const result = addSubscriber({ email, source: "footer" });
    if (result.added) {
      setState("ok");
      setEmail("");
      setTimeout(() => setState("idle"), 3500);
    } else if (result.reason === "duplicate") {
      setState("dup");
      setTimeout(() => setState("idle"), 3500);
    } else {
      setState("err");
      setTimeout(() => setState("idle"), 3500);
    }
  }

  return (
    <footer className="ftr">
      {/* main grid */}
      <div className="wrap ftr__grid">
        <div className="ftr__col ftr__col--brand">
          <Logo tagline={false} />
          <p className="ftr__promise">{SITE.footerPromise}</p>
          <div className="ftr__contact">
            <a href={`tel:${SITE.phone.replace(/\s/g, "")}`}><Phone size={13} /> {SITE.phone}</a>
            <a href={`mailto:${SITE.supportEmail}`}><Mail size={13} /> {SITE.supportEmail}</a>
            <span><MapPin size={13} /> Lagos, Nigeria</span>
          </div>
          <div className="ftr__social">
            <a href="#" aria-label="Facebook" className="ftr__social-icon"><Facebook size={15} /></a>
            <a href="#" aria-label="Instagram" className="ftr__social-icon"><Instagram size={15} /></a>
            <a href="#" aria-label="Twitter" className="ftr__social-icon"><Twitter size={15} /></a>
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
            <input
              type="email"
              placeholder={state === "ok" ? "You're on the list!" : "Enter your email"}
              aria-label="Email address"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setState("idle"); }}
              disabled={state === "ok"}
            />
            <button type="submit" aria-label="Subscribe">
              {state === "ok" ? <Check size={16} /> : <ArrowRight size={16} />}
            </button>
          </form>
          {state === "dup" && <small className="ftr__news-msg">Already subscribed!</small>}
          {state === "err" && <small className="ftr__news-msg ftr__news-msg--err">Please enter a valid email.</small>}

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
        <span>&copy; {SITE.copyrightYear} {SITE.name}. All Rights Reserved.</span>
        <span className="ftr__legal">
          <Link to="#">Privacy Policy</Link>
          <Link to="#">Terms &amp; Conditions</Link>
        </span>
      </div>
    </footer>
  );
}