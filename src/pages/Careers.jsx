import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AtSign, Briefcase, CheckCircle2, ChevronDown, ChevronRight,
  Home as HomeIcon, Link2, MapPin, MessageCircle, Send, Smartphone,
  User, Users,
} from "lucide-react";
import { SITE } from "../config/site.js";
import { useStore } from "../context/StoreContext.jsx";
import {
  CAREERS_BENEFITS, CAREERS_FAQ, CAREERS_HERO,
  CAREERS_ROLES, CAREERS_VALUES,
} from "../config/careersContent.js";
import {
  generateApplicationId, saveApplication, APPLICATION_STATUS,
} from "../utils/careerApplications.js";
import Icon from "../components/ui/Icon.jsx";

const OPEN_APPLICATION = { id: "open", title: "Open Application \u2014 no specific role" };

export default function Careers() {
  const { account } = useStore();
  const formRef = useRef(null);
  const [openRoles, setOpenRoles] = useState({});
  const [openFaq, setOpenFaq] = useState({});
  const [form, setForm] = useState({
    name: account?.name || "",
    email: account?.email || "",
    phone: account?.phone || "",
    roleId: CAREERS_ROLES[0].id,
    linkedin: "",
    portfolio: "",
    coverNote: "",
  });
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(null);

  useEffect(() => {
    const prev = document.title;
    document.title = `Careers \u2014 ${SITE.name}`;
    return () => { document.title = prev; };
  }, []);

  function scrollToForm() {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function field(name, value) {
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((er) => ({ ...er, [name]: undefined }));
  }

  function toggleRole(id) {
    setOpenRoles((m) => ({ ...m, [id]: !m[id] }));
  }
  function toggleFaq(i) {
    setOpenFaq((m) => ({ ...m, [i]: !m[i] }));
  }

  function applyToRole(roleId) {
    setForm((f) => ({ ...f, roleId }));
    setTimeout(scrollToForm, 50);
  }

  function onSubmit(e) {
    e.preventDefault();
    const errs = {};
    if (!form.name.trim()) errs.name = "Your name is required";
    if (!form.email.trim()) errs.email = "Email is required so we can reply";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = "Invalid email format";
    if (form.phone) {
      const cleaned = form.phone.replace(/\s/g, "");
      if (!/^0[789][01]\d{8}$/.test(cleaned)) errs.phone = "Phone format: 0803 123 4567";
    }
    if (!form.coverNote.trim()) errs.coverNote = "Tell us a bit about yourself \u2014 even one paragraph";
    else if (form.coverNote.trim().length < 30) errs.coverNote = "Please add a bit more (at least 30 characters)";

    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    const role = [OPEN_APPLICATION, ...CAREERS_ROLES].find((r) => r.id === form.roleId);
    const id = generateApplicationId();
    const application = {
      id,
      createdAt: new Date().toISOString(),
      status: APPLICATION_STATUS.RECEIVED,
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.replace(/\s/g, ""),
      roleId: form.roleId,
      roleTitle: role?.title || form.roleId,
      linkedin: form.linkedin.trim(),
      portfolio: form.portfolio.trim(),
      coverNote: form.coverNote.trim(),
      source: "careers",
    };
    saveApplication(application);
    setSubmitted({ id, roleTitle: application.roleTitle });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className="wrap mkt-page">
      <nav className="crumb" aria-label="Breadcrumb">
        <Link to="/"><HomeIcon size={13} /> Home</Link>
        <ChevronRight size={12} />
        <span>Careers</span>
      </nav>

      {/* HERO */}
      <section className="mkt-hero mkt-hero--careers">
        <div className="mkt-hero__copy">
          <span className="mkt-hero__pill">
            <Briefcase size={13} /> JOIN VOLTORY
          </span>
          <h1>{CAREERS_HERO.headline}</h1>
          <p>{CAREERS_HERO.body}</p>
          <div className="mkt-hero__cta">
            <button onClick={scrollToForm} className="mkt-hero__primary">
              See open roles <ChevronRight size={16} />
            </button>
          </div>
        </div>
        <div className="mkt-hero__art">
          <Users size={140} strokeWidth={0.7} />
        </div>
      </section>

      {/* WHY JOIN */}
      <div className="section-head" style={{ marginTop: 32 }}>
        <h2>Why join Voltory right now</h2>
        <p style={{ fontSize: 12.5, color: "var(--mut)", margin: 0 }}>
          The work is real, the ownership is real, the impact is real
        </p>
      </div>
      <section className="mkt-grid mkt-grid--4">
        {CAREERS_VALUES.map((v) => (
          <article key={v.title} className="mkt-card">
            <span className="mkt-card__icon">
              <Icon name={v.icon} size={22} />
            </span>
            <b>{v.title}</b>
            <p>{v.body}</p>
          </article>
        ))}
      </section>

      {/* OPEN ROLES */}
      <div className="section-head" style={{ marginTop: 32 }}>
        <h2>Open roles</h2>
        <p style={{ fontSize: 12.5, color: "var(--mut)", margin: 0 }}>
          {CAREERS_ROLES.length} positions open right now
        </p>
      </div>
      <section className="cr-roles">
        {CAREERS_ROLES.map((r) => {
          const open = !!openRoles[r.id];
          return (
            <article key={r.id} className={"cr-role" + (open ? " cr-role--open" : "")}>
              <button className="cr-role__top" onClick={() => toggleRole(r.id)} aria-expanded={open}>
                <div>
                  <b>{r.title}</b>
                  <div className="cr-role__meta">
                    <span><MapPin size={11} /> {r.location}</span>
                    <span>·</span>
                    <span>{r.department}</span>
                    <span>·</span>
                    <span>{r.type}</span>
                  </div>
                </div>
                <ChevronDown size={18} className="cr-role__chev" />
              </button>

              {open && (
                <div className="cr-role__body">
                  <p className="cr-role__snapshot">{r.snapshot}</p>

                  <div className="cr-role__cols">
                    <div>
                      <h4>What you\u2019ll own</h4>
                      <ul>
                        {r.youll.map((line) => (
                          <li key={line}><CheckCircle2 size={13} /> {line}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4>Who fits</h4>
                      <ul>
                        {r.looking.map((line) => (
                          <li key={line}><CheckCircle2 size={13} /> {line}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {r.bonus && (
                    <p className="cr-role__bonus">
                      <b>Bonus:</b> {r.bonus}
                    </p>
                  )}

                  <button className="cr-role__apply" onClick={() => applyToRole(r.id)}>
                    Apply for this role <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </section>

      {/* BENEFITS */}
      <div className="section-head" style={{ marginTop: 32 }}>
        <h2>Benefits & support</h2>
        <p style={{ fontSize: 12.5, color: "var(--mut)", margin: 0 }}>
          What we offer the team
        </p>
      </div>
      <section className="cr-benefits">
        <ul>
          {CAREERS_BENEFITS.map((b) => (
            <li key={b}><CheckCircle2 size={15} /> {b}</li>
          ))}
        </ul>
      </section>

      {/* APPLICATION FORM */}
      <div className="section-head" style={{ marginTop: 40 }} ref={formRef}>
        <h2>Apply now</h2>
        <p style={{ fontSize: 12.5, color: "var(--mut)", margin: 0 }}>
          We review every application within 5 working days
        </p>
      </div>

      {submitted ? (
        <section className="cr-success">
          <span className="cr-success__icon"><CheckCircle2 size={56} /></span>
          <h3>Application received</h3>
          <p>
            Thanks — we’ve recorded your application for{" "}
            <b>{submitted.roleTitle}</b>. You’ll hear from us within
            <b> 5 working days</b>.
          </p>
          <div className="cr-success__id">
            Application ID: <b className="mono">{submitted.id}</b>
          </div>
          <p className="cr-success__note">
            Keep this ID for your records. If you need to reference your application
            later, mention it when contacting us.
          </p>
          <div className="cr-success__actions">
            <Link to="/" className="btn-shop">Back to Home</Link>
            <button onClick={() => setSubmitted(null)} className="cr-success__again">
              Submit another application
            </button>
          </div>
        </section>
      ) : (
        <form className="cr-form" onSubmit={onSubmit} noValidate>
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

              <label className={"field" + (errors.email ? " has-error" : "")}>
                <span className="field__label">Email Address</span>
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

              <label className={"field field--full" + (errors.phone ? " has-error" : "")}>
                <span className="field__label">
                  Phone Number <small className="field__note">— optional but recommended</small>
                </span>
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
            </div>
          </fieldset>

          <fieldset>
            <legend>The role</legend>
            <div className="ck-grid">
              <label className="field field--full">
                <span className="field__label">Which role are you applying for?</span>
                <select
                  className="contact-select"
                  value={form.roleId}
                  onChange={(e) => field("roleId", e.target.value)}
                >
                  {CAREERS_ROLES.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title} — {r.location}
                    </option>
                  ))}
                  <option value={OPEN_APPLICATION.id}>{OPEN_APPLICATION.title}</option>
                </select>
              </label>

              <label className="field">
                <span className="field__label">
                  LinkedIn Profile <small className="field__note">— optional</small>
                </span>
                <span className="auth-input">
                  <Link2 size={16} />
                  <input
                    type="url"
                    value={form.linkedin}
                    onChange={(e) => field("linkedin", e.target.value)}
                    placeholder="https://linkedin.com/in/your-handle"
                  />
                </span>
              </label>

              <label className="field">
                <span className="field__label">
                  Portfolio / CV Link <small className="field__note">— optional</small>
                </span>
                <span className="auth-input">
                  <Link2 size={16} />
                  <input
                    type="url"
                    value={form.portfolio}
                    onChange={(e) => field("portfolio", e.target.value)}
                    placeholder="Drive link, personal site, or portfolio URL"
                  />
                </span>
              </label>

              <label className={"field field--full" + (errors.coverNote ? " has-error" : "")}>
                <span className="field__label">Why Voltory?</span>
                <textarea
                  className="contact-textarea"
                  rows="5"
                  value={form.coverNote}
                  onChange={(e) => field("coverNote", e.target.value)}
                  placeholder="Tell us briefly: what you do well, what you\u2019d want to own at Voltory, and anything relevant about your background. One paragraph is fine."
                />
                {errors.coverNote && <span className="field__error">{errors.coverNote}</span>}
              </label>
            </div>
          </fieldset>

          <div className="cr-form__foot">
            <small>
              By submitting, you consent to Voltory storing your application details
              for review and future role-matching. We never share applicant information
              with third parties.
            </small>
            <button type="submit" className="auth-submit cr-form__submit">
              <Send size={15} /> Submit Application
            </button>
          </div>
        </form>
      )}

      {/* FAQ */}
      <div className="section-head" style={{ marginTop: 40 }}>
        <h2>Frequently asked</h2>
        <p style={{ fontSize: 12.5, color: "var(--mut)", margin: 0 }}>
          Everything candidates usually want to know
        </p>
      </div>
      <section className="cr-faq">
        <ul>
          {CAREERS_FAQ.map((it, i) => {
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
      </section>

      {/* CTA */}
      <section className="mkt-cta">
        <div>
          <h2>Questions before applying?</h2>
          <p>WhatsApp us — we’re honest about whether a role fits.</p>
        </div>
        <div className="mkt-cta__actions">
          <a href={SITE.whatsappLink} target="_blank" rel="noreferrer" className="mkt-cta__wa">
            <MessageCircle size={16} /> Chat on WhatsApp
          </a>
          <Link to="/contact" className="mkt-cta__alt">
            Contact form
          </Link>
        </div>
      </section>
    </main>
  );
}