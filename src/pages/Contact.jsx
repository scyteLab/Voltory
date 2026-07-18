import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AtSign, CheckCircle2, ChevronRight, Clock, Home as HomeIcon, Mail,
  MapPin, MessageCircle, MessageSquare, Phone, Send, User,
} from "lucide-react";
import { SITE } from "../config/site.js";
import { useStore } from "../context/StoreContext.jsx";
import {
  generateTicketId, saveTicket, TICKET_STATUS,
} from "../utils/supportTickets.js";

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

export default function Contact() {
  const { account, requestCall } = useStore();
  const [form, setForm] = useState({
    name: account?.name || "",
    email: account?.email || "",
    subject: SUBJECTS[0],
    message: "",
  });
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(null); // { id }

  useEffect(() => {
    const prev = document.title;
    document.title = `Contact Us \u2014 ${SITE.name}`;
    return () => { document.title = prev; };
  }, []);

  function onSubmit(e) {
    e.preventDefault();
    const errs = {};
    if (!form.name.trim()) errs.name = "Your name is required";
    if (!form.email.trim()) errs.email = "Email is required so we can reply";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = "Invalid email format";
    if (!form.message.trim()) errs.message = "Please write a message";
    else if (form.message.trim().length < 10) errs.message = "Please add a bit more detail (10 characters minimum)";

    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    const id = generateTicketId();
    const ticket = {
      id,
      createdAt: new Date().toISOString(),
      status: TICKET_STATUS.OPEN,
      ...form,
      name: form.name.trim(),
      email: form.email.trim(),
      message: form.message.trim(),
    };
    saveTicket(ticket);
    setSubmitted({ id });
    window.scrollTo({ top: 220, behavior: "smooth" });
  }

  function field(name, value) {
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((er) => ({ ...er, [name]: undefined }));
  }

  return (
    <main className="wrap support-page">
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
          <p>
            Thanks for getting in touch. Your support ticket has been created and our team will respond
            shortly by email.
          </p>
          <div className="contact-success__id">
            Ticket ID: <b className="mono">{submitted.id}</b>
          </div>
          <div className="contact-success__actions">
            <Link to="/" className="btn-shop">Back to Home</Link>
            <button
              className="contact-success__again"
              onClick={() => {
                setSubmitted(null);
                setForm({ name: account?.name || "", email: account?.email || "", subject: SUBJECTS[0], message: "" });
              }}
            >
              Send another message
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

            <div className="ck-grid">
              <label className={"field" + (errors.name ? " has-error" : "")}>
                <span className="field__label">Your Name</span>
                <span className="auth-input">
                  <User size={16} />
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => field("name", e.target.value)}
                    placeholder="Full name"
                    autoComplete="name"
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
                  />
                </span>
                {errors.email && <span className="field__error">{errors.email}</span>}
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
                  placeholder="Tell us what we can help with. If it\u2019s about an order, include the order ID."
                  className="contact-textarea"
                />
                {errors.message && <span className="field__error">{errors.message}</span>}
              </label>
            </div>

            <button type="submit" className="auth-submit contact-submit">
              <Send size={15} /> Send Message
            </button>
          </form>
        </section>
      )}
    </main>
  );
}