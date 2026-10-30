import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle, AtSign, CheckCircle2, ChevronRight, Clock, Home as HomeIcon, Mail,
  MapPin, MessageCircle, MessageSquare, Phone, Send, User,
} from "lucide-react";
import { SITE } from "../config/site.js";
import { useStore } from "../context/StoreContext.jsx";
import { useCustomerAuth } from "../context/AuthContext.jsx";
import { submitContactMessage } from "../lib/contactMessagesClient.js";
import { sendContactNotification } from "../lib/emailClient.js";
import SEOHead from "../components/seo/SEOHead.jsx";

const SUBJECTS = [
  "General enquiry",
  "Order issue",
  "Delivery question",
  "Product question",
  "Returns or refunds",
  "Warranty claim",
  "Partnership / Wholesale",
  "Other",
];

const RESUBMIT_COOLDOWN_MS = 30_000;
const LAST_SENT_KEY = "naven_contact_last_sent";

function readLastSent() {
  try { return Number(localStorage.getItem(LAST_SENT_KEY)) || 0; } catch { return 0; }
}
function writeLastSent(ts) {
  try { localStorage.setItem(LAST_SENT_KEY, String(ts)); } catch { /* noop */ }
}

export default function Contact() {
  const { requestCall } = useStore();
  const { customer } = useCustomerAuth();
  const account = customer;
  const emptyForm = () => ({
    name: account?.name || "",
    email: account?.email || "",
    phone: account?.phone || "",
    subject: SUBJECTS[0],
    message: "",
    website: "", // honeypot: real visitors never see or fill this
  });
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(false);
  const [lastSent, setLastSent] = useState(readLastSent);
  const [now, setNow] = useState(() => Date.now());

  const cooldownLeft = Math.max(0, Math.ceil((lastSent + RESUBMIT_COOLDOWN_MS - now) / 1000));

  // Tick once a second, only while a cooldown is running.
  useEffect(() => {
    if (cooldownLeft <= 0) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [cooldownLeft]);

  function markSent() {
    const ts = Date.now();
    writeLastSent(ts);
    setLastSent(ts);
    setNow(ts);
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (sending || cooldownLeft > 0) return;

    const name = form.name.trim();
    const email = form.email.trim();
    const phone = form.phone.trim();
    const message = form.message.trim();

    const errs = {};
    if (!name) errs.name = "Your name is required";
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = "Invalid email format";
    if (phone && phone.replace(/\D/g, "").length < 7) errs.phone = "Enter a valid phone number";
    if (!email && !phone) {
      errs.email = "Add an email or phone number so we can reply";
      errs.phone = "Add an email or phone number so we can reply";
    }
    if (!message) errs.message = "Please write a message";
    else if (message.length < 10) errs.message = "Please add a bit more detail (10 characters minimum)";

    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    // Honeypot filled: almost certainly a bot. Pretend it worked.
    if (form.website) {
      markSent();
      setSubmitted(true);
      return;
    }

    const payload = {
      name: name.slice(0, 120),
      email: email || null,
      phone: phone || null,
      subject: form.subject,
      message: message.slice(0, 5000),
    };

    setSending(true);
    setSendError(false);
    const res = await submitContactMessage(payload);
    setSending(false);

    if (!res.ok) {
      setSendError(true);
      return;
    }

    // Fire-and-forget: the message is already saved, so email
    // problems are logged and never shown to the customer.
    sendContactNotification(payload);

    markSent();
    setSubmitted(true);
    window.scrollTo({ top: 220, behavior: "smooth" });
  }

  function field(name, value) {
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((er) => (
      // email and phone share the "one of them is required" error
      name === "email" || name === "phone"
        ? { ...er, email: undefined, phone: undefined }
        : { ...er, [name]: undefined }
    ));
  }

  return (
    <main className="wrap support-page">
      <SEOHead
        title="Contact Us"
        description="Contact NAVEN — phone, WhatsApp, email. We're here to help with orders, product questions, and after-sales support."
      />
      <nav className="crumb" aria-label="Breadcrumb">
        <Link to="/"><HomeIcon size={13} /> Home</Link>
        <ChevronRight size={12} />
        <span>Contact Us</span>
      </nav>

      <header className="support-head">
        <span className="support-head__icon"><MessageSquare size={26} /></span>
        <div>
          <h1>Contact Us</h1>
          <p>We typically respond in minutes during business hours. For fastest help, message us on WhatsApp.</p>
        </div>
      </header>

      {/* Quick contact cards */}
      <section className="contact-cards">
        <a
          href={SITE.whatsappLink}
          target="_blank"
          rel="noreferrer"
          className="contact-card contact-card--wa"
        >
          <span className="contact-card__icon"><MessageCircle size={24} /></span>
          <div>
            <h3>WhatsApp</h3>
            <p>Fastest — we read every message</p>
            <b>{SITE.whatsapp}</b>
          </div>
          <ChevronRight size={16} className="contact-card__chev" />
        </a>

        <a
          href={`tel:${SITE.phone.replace(/\s/g, "")}`}
          className="contact-card"
          onClick={(e) => { e.preventDefault(); requestCall(SITE.phone); }}
        >
          <span className="contact-card__icon"><Phone size={24} /></span>
          <div>
            <h3>Phone</h3>
            <p>Mon–Sat, 8 AM – 7 PM</p>
            <b>{SITE.phone}</b>
          </div>
          <ChevronRight size={16} className="contact-card__chev" />
        </a>

        <a href={`mailto:${SITE.supportEmail}`} className="contact-card">
          <span className="contact-card__icon"><Mail size={24} /></span>
          <div>
            <h3>Email</h3>
            <p>For longer enquiries</p>
            <b>{SITE.supportEmail}</b>
          </div>
          <ChevronRight size={16} className="contact-card__chev" />
        </a>
      </section>

      {/* Form OR confirmation */}
      {submitted ? (
        <section className="contact-success">
          <span className="contact-success__icon"><CheckCircle2 size={56} /></span>
          <h2>Message received</h2>
          <p>Thanks, we've received your message and will reply within 1 working day.</p>
          <div className="contact-success__actions">
            <Link to="/" className="btn-shop">Back to Home</Link>
            <button
              className="contact-success__again"
              disabled={cooldownLeft > 0}
              onClick={() => {
                setSubmitted(false);
                setErrors({});
                setForm(emptyForm());
              }}
            >
              {cooldownLeft > 0 ? `Send another message (${cooldownLeft}s)` : "Send another message"}
            </button>
          </div>
        </section>
      ) : (
        <section className="contact-form-wrap">
          <div className="contact-form-side">
            <h3>Business hours</h3>
            <ul>
              <li><Clock size={14} /> Monday – Friday: 8 AM – 7 PM</li>
              <li><Clock size={14} /> Saturday: 9 AM – 5 PM</li>
              <li><Clock size={14} /> Sunday: Closed (WhatsApp only)</li>
            </ul>
            <h3 style={{ marginTop: 22 }}>Visit us</h3>
            <p>
              <MapPin size={14} style={{ verticalAlign: "middle", color: "var(--mut)" }} />{" "}
              Lagos, Nigeria<br />
              <small>Showroom address available on appointment.</small>
            </p>
            <p className="contact-form-side__note">
              Looking for an order update? It’s faster to use our{" "}
              <Link to="/track-order">Track Order</Link> page.
            </p>
          </div>

          <form className="contact-form" onSubmit={onSubmit} noValidate>
            <h3>Send us a message</h3>
            <p className="contact-form__hint">Give us an email or a phone number (or both) so we can reply.</p>

            {/* Honeypot: hidden from people and screen readers; bots fill it. */}
            <div aria-hidden="true" className="contact-hp">
              <label>
                Website
                <input
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={form.website}
                  onChange={(e) => field("website", e.target.value)}
                />
              </label>
            </div>

            <div className="ck-grid">
              <label className={"field field--full" + (errors.name ? " has-error" : "")}>
                <span className="field__label">Your Name</span>
                <span className="auth-input">
                  <User size={16} />
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => field("name", e.target.value)}
                    placeholder="Full name"
                    autoComplete="name"
                    maxLength={120}
                  />
                </span>
                {errors.name && <span className="field__error">{errors.name}</span>}
              </label>

              <label className={"field" + (errors.email ? " has-error" : "")}>
                <span className="field__label">Email Address</span>
                <span className="auth-input">
                  <AtSign size={16} />
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => field("email", e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    maxLength={254}
                  />
                </span>
                {errors.email && <span className="field__error">{errors.email}</span>}
              </label>

              <label className={"field" + (errors.phone ? " has-error" : "")}>
                <span className="field__label">Phone / WhatsApp</span>
                <span className="auth-input">
                  <Phone size={16} />
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => field("phone", e.target.value)}
                    placeholder="0803 000 0000"
                    autoComplete="tel"
                    maxLength={40}
                  />
                </span>
                {errors.phone && <span className="field__error">{errors.phone}</span>}
              </label>

              <label className="field field--full">
                <span className="field__label">Subject</span>
                <select
                  value={form.subject}
                  onChange={(e) => field("subject", e.target.value)}
                  className="contact-select"
                >
                  {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
                </select>
              </label>

              <label className={"field field--full" + (errors.message ? " has-error" : "")}>
                <span className="field__label">Message</span>
                <textarea
                  rows="5"
                  value={form.message}
                  onChange={(e) => field("message", e.target.value)}
                  placeholder="Tell us what we can help with. If it’s about an order, include the order ID."
                  className="contact-textarea"
                  maxLength={5000}
                />
                {errors.message && <span className="field__error">{errors.message}</span>}
              </label>
            </div>

            {sendError && (
              <div className="contact-error" role="alert">
                <AlertTriangle size={18} />
                <div>
                  <b>Sorry, your message couldn't be sent.</b>
                  <p>
                    Please try again, or message us directly on{" "}
                    <a href={SITE.whatsappLink} target="_blank" rel="noreferrer">
                      WhatsApp ({SITE.whatsapp})
                    </a>.
                  </p>
                </div>
              </div>
            )}

            <button
              type="submit"
              className="auth-submit contact-submit"
              disabled={sending || cooldownLeft > 0}
            >
              <Send size={15} />{" "}
              {sending ? "Sending…" : cooldownLeft > 0 ? `Please wait ${cooldownLeft}s` : "Send Message"}
            </button>
          </form>
        </section>
      )}
    </main>
  );
}
