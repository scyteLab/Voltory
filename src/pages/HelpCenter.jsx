import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ChevronDown, ChevronRight, Home as HomeIcon, LifeBuoy, MessageCircle,
  Search, X,
} from "lucide-react";
import { HELP_TOPICS } from "../config/helpCenter.js";
import { SITE } from "../config/site.js";
import Icon from "../components/ui/Icon.jsx";

export default function HelpCenter() {
  const [query, setQuery] = useState("");
  const [activeTopicId, setActiveTopicId] = useState(null); // null = all
  const [openItems, setOpenItems] = useState({}); // { "topic.q-index": true }

  useEffect(() => {
    const prev = document.title;
    document.title = `Help Center \u2014 ${SITE.name}`;
    return () => { document.title = prev; };
  }, []);

  // Filter logic: substring match across question + answer.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return HELP_TOPICS.map((topic) => {
      if (activeTopicId && topic.id !== activeTopicId) return null;
      if (!q) return topic;
      const matches = topic.items.filter(
        (it) =>
          it.q.toLowerCase().includes(q) ||
          it.a.toLowerCase().includes(q)
      );
      return matches.length ? { ...topic, items: matches } : null;
    }).filter(Boolean);
  }, [query, activeTopicId]);

  // Auto-expand all results during search
  useEffect(() => {
    if (!query) return;
    const next = {};
    for (const t of filtered) {
      for (let i = 0; i < t.items.length; i++) next[`${t.id}-${i}`] = true;
    }
    setOpenItems(next);
  }, [query, filtered]);

  function toggle(key) {
    setOpenItems((m) => ({ ...m, [key]: !m[key] }));
  }

  return (
    <main className="wrap support-page">
      <nav className="crumb" aria-label="Breadcrumb">
        <Link to="/"><HomeIcon size={13} /> Home</Link>
        <ChevronRight size={12} />
        <span>Help Center</span>
      </nav>

      <header className="support-head support-head--centered">
        <span className="support-head__icon"><LifeBuoy size={26} /></span>
        <div>
          <h1>How can we help?</h1>
          <p>Find quick answers to the most common questions.</p>
        </div>
      </header>

      <div className="help-search">
        <Search size={17} />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the Help Center..."
          aria-label="Search help articles"
        />
        {query && (
          <button onClick={() => setQuery("")} aria-label="Clear search">
            <X size={16} />
          </button>
        )}
      </div>

      {/* Topic tiles \u2014 hidden while searching */}
      {!query && (
        <section className="help-topics">
          <button
            className={"help-topic-pill" + (activeTopicId === null ? " help-topic-pill--on" : "")}
            onClick={() => setActiveTopicId(null)}
          >
            All Topics
          </button>
          {HELP_TOPICS.map((t) => (
            <button
              key={t.id}
              className={"help-topic-pill" + (activeTopicId === t.id ? " help-topic-pill--on" : "")}
              onClick={() => setActiveTopicId(t.id)}
            >
              <Icon name={t.icon} size={14} /> {t.label}
            </button>
          ))}
        </section>
      )}

      {/* Topics + Q&A */}
      {filtered.length === 0 ? (
        <div className="help-empty">
          <h3>No results for "{query}"</h3>
          <p>Try a different keyword, or contact our team and we’ll get back to you within a few hours.</p>
          <Link to="/contact" className="btn-shop">Contact Support</Link>
        </div>
      ) : (
        <div className="help-body">
          {filtered.map((topic) => (
            <section key={topic.id} className="help-topic">
              <div className="help-topic__head">
                <span className="help-topic__icon"><Icon name={topic.icon} size={18} /></span>
                <div>
                  <h2>{topic.label}</h2>
                  {!query && <p>{topic.blurb}</p>}
                </div>
              </div>
              <ul className="help-items">
                {topic.items.map((it, i) => {
                  const key = `${topic.id}-${i}`;
                  const open = !!openItems[key];
                  return (
                    <li key={key} className={"help-item" + (open ? " help-item--open" : "")}>
                      <button
                        className="help-item__q"
                        onClick={() => toggle(key)}
                        aria-expanded={open}
                      >
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
          ))}
        </div>
      )}

      {/* Still stuck banner */}
      <section className="help-stillstuck">
        <div>
          <h3>Still stuck?</h3>
          <p>Our support team responds in minutes during business hours, and within a few hours otherwise.</p>
        </div>
        <div className="help-stillstuck__actions">
          <a href={SITE.whatsappLink} target="_blank" rel="noreferrer" className="help-stillstuck__wa">
            <MessageCircle size={16} /> Chat on WhatsApp
          </a>
          <Link to="/contact" className="btn-shop">Contact Form</Link>
        </div>
      </section>
    </main>
  );
}