import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AtSign, CalendarDays, CheckCircle2, ChevronDown, ChevronRight,
  Hammer, Home as HomeIcon, MapPin, MessageCircle, Phone, Send,
  ShieldCheck, Smartphone, User, Wrench,
} from "lucide-react";
import { SITE } from "../config/site.js";
import { useStore } from "../context/StoreContext.jsx";
import {
  INSTALL_APPLIANCES, INSTALL_STEPS, INSTALL_COVERAGE,
  INSTALL_TRUST, INSTALL_FAQ,
} from "../config/installationServices.js";
import {
  generateInstallId, saveInstallRequest, INSTALL_STATUS,
} from "../utils/installationRequests.js";
import { naira } from "../utils/format.js";
import Icon from "../components/ui/Icon.jsx";

const NG_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue",
  "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu",
  "FCT (Abuja)", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina",
  "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo",
  "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara",
];

export default function InstallationServices() {
  const { account } = useStore();
  const formRef = useRef(null);
  const [openFaq, setOpenFaq] = useState({});
  const [form, setForm] = useState({
    name: account?.name || "",
    phone: account?.phone || "",
    email: account?.email || "",
    state: "",
    lga: "",
    street: "",
    applianceId: INSTALL_APPLIANCES[0].id,
    brand: "",
    model: "",
    preferredDate: "",
    notes: "",
  });
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(null);

  useEffect(() => {
    const prev = document.title;
    document.title = `Installation Services \u2014 ${SITE.name}`;
    return () => { document.title = prev; };
  }, []);

  function scrollToForm() {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function field(name, value) {
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((er) => ({ ...er, [name]: undefined }));
  }

  function onSubmit(e) {
    e.preventDefault();
    const errs = {};
    if (!form.name.trim()) errs.name = "Your name is required";
    const cleanedPhone = form.phone.replace(/\s/g, "");
    if (!/^0[789][01]\d{8}$/.test(cleanedPhone)) errs.phone = "Enter a valid Nigerian phone number";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = "Invalid email format";
    if (!form.state) errs.state = "Select your state";
    if (!form.street.trim()) errs.street = "Street address is required";
    if (!form.brand.trim()) errs.brand = "Brand is required";

    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    const appliance = INSTALL_APPLIANCES.find((a) => a.id === form.applianceId);
    const id = generateInstallId();
    const req = {
      id,
      createdAt: new Date().toISOString(),
      status: INSTALL_STATUS.REQUESTED,
      name: form.name.trim(),
      phone: cleanedPhone,
      email: form.email.trim(),
      address: {
        state: form.state,
        lga: form.lga.trim(),
        street: form.street.trim(),
      },
      applianceId: form.applianceId,
      applianceName: appliance.name,
      brand: form.brand.trim(),
      model: form.model.trim(),
      preferredDate: form.preferredDate || null,
      notes: form.notes.trim(),
      fee: appliance.fee,
    };
    saveInstallRequest(req);
    setSubmitted({ id, applianceName: appliance.name, fee: appliance.fee });
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function toggleFaq(i) {
    setOpenFaq((m) => ({ ...m, [i]: !m[i] }));
  }

  return (
    <main className="wrap install-page">
      <nav className="crumb" aria-label="Breadcrumb">
        <Link to="/"><HomeIcon size={13} /> Home</Link>
        <ChevronRight size={12} />
        <span>Installation Services</span>
      </nav>

      {/* HERO */}
      <section className="ins-hero">
        <div className="ins-hero__copy">
          <span className="ins-hero__pill">
            <Wrench size={13} /> NATIONWIDE SERVICE
          </span>
          <h1>Professional Installation,<br />Done Right the First Time.</h1>
          <p>
            Certified technicians for ACs, fridges, washing machines, TVs and more \u2014
            across Lagos, Abuja and all 36 states. Manufacturer warranty stays intact.
          </p>
          <div className="ins-hero__cta">
            <button onClick={scrollToForm} className="ins-hero__book">
              Book Installation <ChevronRight size={16} />
            </button>
            <a href={SITE.whatsappLink} target="_blank" rel="noreferrer" className="ins-hero__wa">
              <MessageCircle size={16} /> Chat on WhatsApp
            </a>
          </div>
        </div>
        <div className="ins-hero__art">
          <Hammer size={140} strokeWidth={0.8} />
        </div>
      </section>

      {/* WHY VOLTORY */}
      <section className="ins-trust">
        {INSTALL_TRUST.map((t) => (
          <div key={t.title} className="ins-trust__card">
            <span className="ins-trust__icon"><Icon name={t.icon} size={22} /></span>
            <b>{t.title}</b>
            <p>{t.body}</p>
          </div>
        ))}
      </section>

      {/* APPLIANCES */}
      <div className="section-head" style={{ marginTop: 32 }}>
        <h2>What We Install</h2>
        <p style={{ fontSize: 12.5, color: "var(--mut)", margin: 0 }}>
          Transparent fees \u2014 what we quote is what you pay
        </p>
      </div>
      <section className="ins-grid">
        {INSTALL_APPLIANCES.map((a) => (
          <article key={a.id} className="ins-card">
            <div className="ins-card__top">
              <span className="ins-card__icon"><Icon name={a.icon} size={22} /></span>
              <div>
                <b>{a.name}</b>
                <small>{a.sizeNote}</small>
              </div>
              <span className="ins-card__fee">{naira(a.fee)}</span>
            </div>
            <ul>
              {a.includes.map((line) => (
                <li key={line}>
                  <CheckCircle2 size={13} /> {line}
                </li>
              ))}
            </ul>
            {a.upcharge && <small className="ins-card__upcharge">{a.upcharge}</small>}
            <button onClick={() => { field("applianceId", a.id); scrollToForm(); }} className="ins-card__cta">
              Book this install <ChevronRight size={14} />
            </button>
          </article>
        ))}
      </section>

      {/* HOW IT WORKS */}
      <div className="section-head" style={{ marginTop: 40 }}>
        <h2>How It Works</h2>
        <p style={{ fontSize: 12.5, color: "var(--mut)", margin: 0 }}>
          From booking to done \u2014 typically same day in Lagos & Abuja
        </p>
      </div>
      <section className="ins-steps">
        {INSTALL_STEPS.map((s) => (
          <div key={s.n} className="ins-step">
            <span className="ins-step__n">{s.n}</span>
            <div>
              <b>{s.title}</b>
              <p>{s.body}</p>
            </div>
          </div>
        ))}
      </section>

      {/* COVERAGE */}
      <div className="section-head" style={{ marginTop: 40 }}>
        <h2>Coverage & Response Times</h2>
        <p style={{ fontSize: 12.5, color: "var(--mut)", margin: 0 }}>
          We install nationwide \u2014 here\u2019s what to expect by region
        </p>
      </div>
      <section className="ins-coverage">
        {INSTALL_COVERAGE.map((c) => (
          <div key={c.zone} className="ins-coverage__row">
            <span className="ins-coverage__dot" style={{ background: c.color }} />
            <b>{c.zone}</b>
            <span>{c.sla}</span>
          </div>
        ))}
      </section>

      {/* BOOKING FORM (or success) */}
      <div className="section-head" style={{ marginTop: 40 }} ref={formRef}>
        <h2>Book Your Installation</h2>
        <p style={{ fontSize: 12.5, color: "var(--mut)", margin: 0 }}>
          Takes under 2 minutes. A technician will call to confirm within 2 hours.
        </p>
      </div>

      {submitted ? (
        <section className="ins-success">
          <span className="ins-success__icon"><CheckCircle2 size={56} /></span>
          <h3>Installation request received</h3>
          <p>
            Thanks \u2014 a Voltory technician will call you within <b>2 hours</b> to confirm
            your {submitted.applianceName.toLowerCase()} installation slot.
          </p>
          <div className="ins-success__summary">
            <div>
              <small>Request ID</small>
              <b className="mono">{submitted.id}</b>
            </div>
            <div>
              <small>Service fee</small>
              <b>{naira(submitted.fee)}</b>
            </div>
          </div>
          <p className="ins-success__note">
            Payment is collected after the install is complete. You\u2019ll receive an SMS
            with the technician\u2019s name and ETA once your slot is confirmed.
          </p>
          <div className="ins-success__actions">
            <Link to="/" className="btn-shop">Back to Home</Link>
            <button onClick={() => setSubmitted(null)} className="ins-success__again">
              Book another install
            </button>
          </div>
        </section>
      ) : (
        <section className="ins-form-wrap">
          <form className="ins-form" onSubmit={onSubmit} noValidate>
            <fieldset>
              <legend>Your details</legend>
              <div className="ck-grid">
                <label className={"field" + (errors.name ? " has-error" : "")}>
                  <span className="field__label">Full Name</span>
                  <span className="auth-input">
                    <User size={16} />
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => field("name", e.target.value)}
                      placeholder="Your name"
                    />
                  </span>
                  {errors.name && <span className="field__error">{errors.name}</span>}
                </label>

                <label className={"field" + (errors.phone ? " has-error" : "")}>
                  <span className="field__label">Phone Number</span>
                  <span className="auth-input">
                    <Smartphone size={16} />
                    <input
                      type="tel"
                      inputMode="tel"
                      value={form.phone}
                      onChange={(e) => field("phone", e.target.value)}
                      placeholder="0803 123 4567"
                    />
                  </span>
                  {errors.phone && <span className="field__error">{errors.phone}</span>}
                </label>

                <label className={"field field--full" + (errors.email ? " has-error" : "")}>
                  <span className="field__label">
                    Email Address <small className="field__note">\u2014 optional, for the install certificate</small>
                  </span>
                  <span className="auth-input">
                    <AtSign size={16} />
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => field("email", e.target.value)}
                      placeholder="you@example.com"
                    />
                  </span>
                  {errors.email && <span className="field__error">{errors.email}</span>}
                </label>
              </div>
            </fieldset>

            <fieldset>
              <legend>Installation address</legend>
              <div className="ck-grid">
                <label className={"field" + (errors.state ? " has-error" : "")}>
                  <span className="field__label">State</span>
                  <select
                    className="contact-select"
                    value={form.state}
                    onChange={(e) => field("state", e.target.value)}
                  >
                    <option value="">Select your state</option>
                    {NG_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  {errors.state && <span className="field__error">{errors.state}</span>}
                </label>

                <label className="field">
                  <span className="field__label">LGA / Area <small className="field__note">\u2014 optional</small></span>
                  <span className="auth-input">
                    <MapPin size={16} />
                    <input
                      type="text"
                      value={form.lga}
                      onChange={(e) => field("lga", e.target.value)}
                      placeholder="e.g. Ikeja, Lekki, Wuse"
                    />
                  </span>
                </label>

                <label className={"field field--full" + (errors.street ? " has-error" : "")}>
                  <span className="field__label">Street Address</span>
                  <span className="auth-input">
                    <MapPin size={16} />
                    <input
                      type="text"
                      value={form.street}
                      onChange={(e) => field("street", e.target.value)}
                      placeholder="House number, street name, landmark"
                    />
                  </span>
                  {errors.street && <span className="field__error">{errors.street}</span>}
                </label>
              </div>
            </fieldset>

            <fieldset>
              <legend>What needs installing</legend>
              <div className="ck-grid">
                <label className="field field--full">
                  <span className="field__label">Appliance Type</span>
                  <select
                    className="contact-select"
                    value={form.applianceId}
                    onChange={(e) => field("applianceId", e.target.value)}
                  >
                    {INSTALL_APPLIANCES.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} \u2014 {naira(a.fee)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={"field" + (errors.brand ? " has-error" : "")}>
                  <span className="field__label">Brand</span>
                  <span className="auth-input">
                    <input
                      type="text"
                      value={form.brand}
                      onChange={(e) => field("brand", e.target.value)}
                      placeholder="e.g. Scanfrost, Samsung, LG"
                    />
                  </span>
                  {errors.brand && <span className="field__error">{errors.brand}</span>}
                </label>

                <label className="field">
                  <span className="field__label">Model <small className="field__note">\u2014 optional</small></span>
                  <span className="auth-input">
                    <input
                      type="text"
                      value={form.model}
                      onChange={(e) => field("model", e.target.value)}
                      placeholder="e.g. SF-AC15GENINV"
                    />
                  </span>
                </label>

                <label className="field">
                  <span className="field__label">Preferred Date</span>
                  <span className="auth-input">
                    <CalendarDays size={16} />
                    <input
                      type="date"
                      value={form.preferredDate}
                      onChange={(e) => field("preferredDate", e.target.value)}
                      min={new Date().toISOString().slice(0, 10)}
                    />
                  </span>
                </label>

                <label className="field field--full">
                  <span className="field__label">Anything else? <small className="field__note">\u2014 optional</small></span>
                  <textarea
                    className="contact-textarea"
                    rows="3"
                    value={form.notes}
                    onChange={(e) => field("notes", e.target.value)}
                    placeholder="e.g. 3rd floor, no lift; remove old AC; need disposal of packaging"
                  />
                </label>
              </div>
            </fieldset>

            <div className="ins-form__foot">
              <small>
                <ShieldCheck size={13} style={{ verticalAlign: "middle", marginRight: 4, color: "var(--ok)" }} />
                No payment now. Pay the technician after install is complete and you\u2019re happy.
              </small>
              <button type="submit" className="auth-submit ins-form__submit">
                <Send size={15} /> Send Booking Request
              </button>
            </div>
          </form>
        </section>
      )}

      {/* FAQ */}
      <div className="section-head" style={{ marginTop: 40 }}>
        <h2>Installation FAQ</h2>
        <p style={{ fontSize: 12.5, color: "var(--mut)", margin: 0 }}>
          The most common questions about Voltory installation
        </p>
      </div>
      <section className="ins-faq">
        <ul>
          {INSTALL_FAQ.map((it, i) => {
            const open = !!openFaq[i];
            return (
              <li key={i} className={"help-item" + (open ? " help-item--open" : "")}>
                <button className="help-item__q" onClick={() => toggleFaq(i)} aria-expanded={open}>
                  <span>{it.q}</span>
                  <ChevronDown size={16} className="help-item__chev" />
                </button>
                {open && (
                  <div className="help-item__a">
                    <p>{it.a}</p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <p className="ins-faq__more">
          Have a different question?{" "}
          <Link to="/help">Browse the full Help Center</Link>{" "}
          or{" "}
          <a href={SITE.whatsappLink} target="_blank" rel="noreferrer">chat with us on WhatsApp</a>.
        </p>
      </section>
    </main>
  );
}