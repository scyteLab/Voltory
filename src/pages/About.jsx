import { useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, ChevronRight, Compass, Home as HomeIcon,
  MessageCircle, Sparkles, User,
} from "lucide-react";
import { SITE } from "../config/site.js";
import {
  ABOUT_FOUNDER, ABOUT_MISSION, ABOUT_PARTNERS, ABOUT_PROBLEM,
  ABOUT_PROMISES, ABOUT_TIMELINE, ABOUT_VALUES,
} from "../config/aboutContent.js";
import { useCatalog } from "../context/CatalogContext.jsx";
import Icon from "../components/ui/Icon.jsx";
import BrandLogo from "../components/brand/BrandLogo.jsx";

export default function About() {
  const { brands: BRANDS } = useCatalog();

  useEffect(() => {
    const prev = document.title;
    document.title = `About \u2014 ${SITE.name}`;
    return () => { document.title = prev; };
  }, []);

  return (
    <main className="wrap mkt-page">
      <nav className="crumb" aria-label="Breadcrumb">
        <Link to="/"><HomeIcon size={13} /> Home</Link>
        <ChevronRight size={12} />
        <span>About Us</span>
      </nav>

      {/* HERO */}
      <section className="mkt-hero mkt-hero--about">
        <div className="mkt-hero__copy">
          <span className="mkt-hero__pill">
            <Sparkles size={13} /> OUR STORY
          </span>
          <h1>{ABOUT_MISSION.headline}</h1>
          <p>{ABOUT_MISSION.body}</p>
        </div>
        <div className="mkt-hero__art">
          <Compass size={140} strokeWidth={0.7} />
        </div>
      </section>

      {/* THE PROBLEM */}
      <div className="section-head" style={{ marginTop: 32 }}>
        <h2>The problem we set out to fix</h2>
        <p style={{ fontSize: 12.5, color: "var(--mut)", margin: 0 }}>
          Buying appliances in Nigeria shouldn’t feel like a gamble
        </p>
      </div>
      <section className="mkt-grid mkt-grid--3">
        {ABOUT_PROBLEM.map((p) => (
          <article key={p.title} className="mkt-card mkt-card--problem">
            <span className="mkt-card__icon mkt-card__icon--warn">
              <Icon name={p.icon} size={22} />
            </span>
            <b>{p.title}</b>
            <p>{p.body}</p>
          </article>
        ))}
      </section>

      {/* THE PROMISE */}
      <div className="section-head" style={{ marginTop: 32 }}>
        <h2>What we promise every customer</h2>
        <p style={{ fontSize: 12.5, color: "var(--mut)", margin: 0 }}>
          Four commitments — not just words on a page
        </p>
      </div>
      <section className="mkt-grid mkt-grid--4">
        {ABOUT_PROMISES.map((p) => (
          <article key={p.title} className="mkt-card">
            <span className="mkt-card__icon">
              <Icon name={p.icon} size={22} />
            </span>
            <b>{p.title}</b>
            <p>{p.body}</p>
          </article>
        ))}
      </section>

      {/* VALUES */}
      <section className="mkt-values">
        <div className="mkt-values__head">
          <h2>How we work</h2>
          <p>Four values that show up in every decision we make.</p>
        </div>
        <ul>
          {ABOUT_VALUES.map((v) => (
            <li key={v.title}>
              <span className="mkt-values__icon"><Icon name={v.icon} size={20} /></span>
              <div>
                <b>{v.title}</b>
                <p>{v.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* TIMELINE */}
      <div className="section-head" style={{ marginTop: 32 }}>
        <h2>Our journey so far</h2>
        <p style={{ fontSize: 12.5, color: "var(--mut)", margin: 0 }}>
          Real milestones — no fluff
        </p>
      </div>
      <section className="mkt-timeline">
        {ABOUT_TIMELINE.map((m, i) => (
          <div key={i} className="mkt-tl">
            <span className="mkt-tl__year">{m.year}</span>
            <div className="mkt-tl__body">
              <b>{m.title}</b>
              <p>{m.body}</p>
            </div>
          </div>
        ))}
      </section>

      {/* FOUNDER */}
      <section className="mkt-founder">
        <div className="mkt-founder__head">
          <span className="mkt-founder__avatar"><User size={32} /></span>
          <div>
            <h2>{ABOUT_FOUNDER.name}</h2>
            <small>{ABOUT_FOUNDER.role}</small>
          </div>
        </div>
        <p>{ABOUT_FOUNDER.bio}</p>
        <p className="mkt-founder__aside">{ABOUT_FOUNDER.also}</p>
      </section>

      {/* PARTNERS */}
      <section className="mkt-partners">
        <h2>{ABOUT_PARTNERS.headline}</h2>
        <p>{ABOUT_PARTNERS.body}</p>
        <div className="mkt-partners__logos">
          {BRANDS.map((b) => (
            <Link key={b.id} to={`/brand/${b.id}`}>
              <BrandLogo brand={b} size="md" />
            </Link>
          ))}
        </div>
        <Link to="/brands" className="mkt-partners__cta">
          See all brands <ArrowRight size={14} />
        </Link>
      </section>

      {/* CTA */}
      <section className="mkt-cta">
        <div>
          <h2>Want to talk to us?</h2>
          <p>WhatsApp is fastest. We read every message.</p>
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