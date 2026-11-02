import { useState } from "react";
import { Link } from "react-router-dom";
import {
  AirVent, BookOpen, CheckCircle2, ChevronRight, Hammer,
  Home as HomeIcon, Lightbulb, Sparkles, Tag, Wrench, Zap,
} from "lucide-react";
import { SITE } from "../config/site.js";
import { subscribeNewsletter } from "../lib/publicFormsClient.js";
import { usePublicFormGuard } from "../hooks/usePublicFormGuard.js";
import HoneypotField from "../components/ui/HoneypotField.jsx";
import FormSendError from "../components/ui/FormSendError.jsx";
import SEOHead from "../components/seo/SEOHead.jsx";

/**
 * Blog — Coming Soon page with newsletter capture and topic
 * preferences. Subscribers are saved to newsletter_subscribers and
 * listed in Admin → Inbox → Newsletter. When real blog posts ship, this page
 * becomes the blog landing.
 */
const TOPICS = [
  { id: "ac-guides",    icon: AirVent,   label: "AC buying & sizing guides" },
  { id: "energy",       icon: Zap,       label: "Energy-saving tips" },
  { id: "new-launches", icon: Sparkles,  label: "New product launches" },
  { id: "install",      icon: Hammer,    label: "Installation know-how" },
  { id: "deals",        icon: Tag,       label: "Exclusive subscriber deals" },
  { id: "maintenance",  icon: Wrench,    label: "Care & maintenance" },
];

export default function Blog() {
  const [email, setEmail] = useState("");
  const [selected, setSelected] = useState(new Set(["ac-guides", "deals"]));
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);
  const [alreadySubscribed, setAlreadySubscribed] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendFailed, setSendFailed] = useState(false);
  const guard = usePublicFormGuard("newsletter");


  function toggleTopic(id) {
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (sending || guard.cooldownLeft > 0) return;
    setError(null);
    setSendFailed(false);

    // Honeypot filled: almost certainly a bot. Pretend it worked.
    if (guard.isBot()) {
      guard.markSent();
      setSubmitted(true);
      return;
    }

    setSending(true);
    const result = await subscribeNewsletter({
      email,
      topics: Array.from(selected),
      source: "blog",
    });
    setSending(false);
    if (!result.ok) {
      if (result.reason === "invalid") setError("Please enter a valid email address.");
      else setSendFailed(true);
      return;
    }
    guard.markSent();
    setAlreadySubscribed(Boolean(result.duplicate));
    setSubmitted(true);
  }

  return (
    <main className="wrap blog-page">
      <SEOHead
        title="Blog"
        description="Appliance buying guides, product reviews, and tips from NAVEN — Nigeria's premium electronics store."
      />
      <nav className="crumb" aria-label="Breadcrumb">
        <Link to="/"><HomeIcon size={13} /> Home</Link>
        <ChevronRight size={12} />
        <span>Blog</span>
      </nav>

      <section className="blog-hero">
        <div className="blog-hero__copy">
          <span className="blog-hero__pill">
            <BookOpen size={13} /> COMING SOON
          </span>
          <h1>The {SITE.name} Blog<br />is on its way.</h1>
          <p>
            We’re building a library of practical buying guides, energy-saving
            tips, and honest product breakdowns — written by people who actually
            install these appliances in Nigerian homes.
          </p>
          <p className="blog-hero__sub">
            Join the list and we’ll let you know the moment our first article goes live.
            No spam, ever. One email per fortnight at most.
          </p>
        </div>
        <img className="blog-hero__img" src="/banners/blog-hero.png" alt="" />
      </section>

      {submitted ? (
        <section className="blog-success">
          <span className="blog-success__icon"><CheckCircle2 size={56} /></span>
          <h2>{alreadySubscribed ? "You’re already subscribed" : "You’re on the list"}</h2>
          <p>
            {alreadySubscribed ? "No need to sign up again — " : "Thanks — "}
            we’ll send your first email to <b className="mono">{email}</b>{" "}
            as soon as the blog launches.
          </p>
          {selected.size > 0 && (
            <p className="blog-success__topics">
              We’ll prioritise <b>{selected.size}</b> topic{selected.size === 1 ? "" : "s"} you picked.
            </p>
          )}
          <div className="blog-success__actions">
            <Link to="/" className="btn-shop">Back to Home</Link>
            <Link to="/deals" className="blog-success__deals">
              Browse Deals of the Day <ChevronRight size={14} />
            </Link>
          </div>
        </section>
      ) : (
        <section className="blog-signup">
          <h2>What would you like to read about?</h2>
          <p className="blog-signup__sub">
            Pick the topics that interest you. We’ll tailor what we send.
          </p>

          <ul className="blog-topics">
            {TOPICS.map((t) => {
              const on = selected.has(t.id);
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    className={"blog-topic" + (on ? " blog-topic--on" : "")}
                    onClick={() => toggleTopic(t.id)}
                    aria-pressed={on}
                  >
                    <span className="blog-topic__icon"><t.icon size={16} /></span>
                    <span>{t.label}</span>
                    {on && <CheckCircle2 size={14} className="blog-topic__check" />}
                  </button>
                </li>
              );
            })}
          </ul>

          <form className={"blog-form" + (error ? " has-error" : "")} onSubmit={onSubmit} noValidate>
            <HoneypotField value={guard.honeypot} onChange={guard.setHoneypot} />
            <label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(null); }}
                placeholder="Enter your email address"
                aria-label="Email address"
                autoComplete="email"
                maxLength={254}
              />
              <button type="submit" disabled={sending || guard.cooldownLeft > 0}>
                {sending ? "Sending…" : <>Notify Me <ChevronRight size={14} /></>}
              </button>
            </label>
            {error && <small className="blog-form__error">{error}</small>}
            {sendFailed && <FormSendError what="signup" />}
            <small className="blog-form__terms">
              By subscribing you agree to our Privacy Policy. Unsubscribe anytime.
            </small>
          </form>
        </section>
      )}

      <p className="blog-meanwhile">
        In the meantime, browse our{" "}
        <Link to="/help">Help Center</Link>{" "}
        — it already has 26 in-depth answers to the most common questions.
      </p>
    </main>
  );
}