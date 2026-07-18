import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AirVent, BookOpen, CheckCircle2, ChevronRight, Hammer,
  Home as HomeIcon, Lightbulb, Sparkles, Tag, Wrench, Zap,
} from "lucide-react";
import { SITE } from "../config/site.js";
import { addSubscriber } from "../utils/newsletterSubscribers.js";

/**
 * Blog \u2014 Coming Soon page with newsletter capture and topic
 * preferences. Subscribers are saved to localStorage; the admin
 * will surface them later. When real blog posts ship, this page
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

  useEffect(() => {
    const prev = document.title;
    document.title = `Blog \u2014 ${SITE.name}`;
    return () => { document.title = prev; };
  }, []);

  function toggleTopic(id) {
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function onSubmit(e) {
    e.preventDefault();
    setError(null);
    const result = addSubscriber({
      email,
      topics: Array.from(selected),
      source: "blog",
    });
    if (!result.added) {
      if (result.reason === "duplicate") {
        setError("You\u2019re already on the list \u2014 we\u2019ll be in touch.");
      } else {
        setError("Please enter a valid email address.");
      }
      return;
    }
    setSubmitted(true);
  }

  return (
    <main className="wrap blog-page">
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
          <h2>You’re on the list</h2>
          <p>
            Thanks — we’ll send your first email to <b className="mono">{email}</b>{" "}
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
            <label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(null); }}
                placeholder="Enter your email address"
                aria-label="Email address"
                autoComplete="email"
              />
              <button type="submit">Notify Me <ChevronRight size={14} /></button>
            </label>
            {error && <small className="blog-form__error">{error}</small>}
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