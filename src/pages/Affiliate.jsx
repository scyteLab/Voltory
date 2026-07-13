import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, BadgeCheck, Banknote, BarChart3, CheckCircle2,
  ChevronRight, Gift, Headphones, Home as HomeIcon,
  MessageCircle, Package, ShieldCheck, Star, TrendingUp,
  Users, Zap,
} from "lucide-react";
import { SITE } from "../config/site.js";

export default function Affiliate() {
  useEffect(() => {
    const prev = document.title;
    document.title = `Affiliate Program — ${SITE.name}`;
    return () => { document.title = prev; };
  }, []);

  const formRef = useRef(null);
  function scrollToForm() {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <main className="wrap mkt-page">
      <nav className="crumb" aria-label="Breadcrumb">
        <Link to="/"><HomeIcon size={13} /> Home</Link>
        <ChevronRight size={12} />
        <span>Affiliate Program</span>
      </nav>

      <HeroSection onApply={scrollToForm} />
      <WhySection />
      <CommissionSection />
      <CategoriesSection />
      <HowSection />
      <ApplySection formRef={formRef} />
      <FaqSection />
      <FinalCta onApply={scrollToForm} />
    </main>
  );
}

/* ---- HERO ---- */
function HeroSection({ onApply }) {
  return (
    <section className="aff2-hero">
      <div className="aff2-hero__copy">
        <span className="mkt-hero__pill"><Users size={12} /> {SITE.name} AFFILIATE PROGRAM</span>
        <h1>Earn by recommending electronics people already need.</h1>
        <p>
          Join {SITE.name}'s affiliate program and earn commissions by driving buyers
          to original appliances, electronics, kitchen products, TVs, ACs, freezers
          and power-protection products.
        </p>
        <div className="aff2-hero__actions">
          <button onClick={onApply} className="aff2-btn">Apply now <ArrowRight size={15} /></button>
          <a href="#commission" className="aff2-btn aff2-btn--outline">View commission plan</a>
        </div>
        <div className="aff2-hero__proof">
          <div className="aff2-proof-item"><strong>8+</strong><span>core appliance & electronics categories</span></div>
          <div className="aff2-proof-item"><strong>{SITE.currencySymbol}35k — {SITE.currencySymbol}1.5m+</strong><span>wide product value range</span></div>
          <div className="aff2-proof-item"><strong>B2C + B2B</strong><span>consumer and bulk purchase opportunities</span></div>
        </div>
      </div>
      <div className="aff2-hero__visual">
        <div className="aff2-ptile"><div className="aff2-ptile__stage"><img src="/products/ac.png" alt="Air conditioner" /></div><strong>Air conditioners</strong><span>High-consideration products with strong affiliate earning potential.</span></div>
        <div className="aff2-ptile"><div className="aff2-ptile__stage"><img src="/products/tv.png" alt="Television" /></div><strong>TVs & entertainment</strong><span>Easy to create content around home entertainment and upgrades.</span></div>
        <div className="aff2-ptile"><div className="aff2-ptile__stage"><img src="/products/ref.png" alt="Freezer" /></div><strong>Freezers</strong><span>Relevant to families, food vendors and frozen-food businesses.</span></div>
        <div className="aff2-ptile"><div className="aff2-ptile__stage"><img src="/products/ups.png" alt="Stabilizer" /></div><strong>Power protection</strong><span>Strong cross-sell product for Nigerian power realities.</span></div>
      </div>
    </section>
  );
}

/* ---- WHY ---- */
function WhySection() {
  return (
    <section id="why" className="aff2-section">
      <div className="section-head">
        <div>
          <h2>Why this affiliate program works</h2>
          <p style={{ fontSize: 13, color: "var(--mut)", marginTop: 6, maxWidth: "60ch" }}>
            {SITE.name}'s category is practical, high-value and easy to recommend because
            people are already buying these products for homes, businesses and life upgrades.
          </p>
        </div>
      </div>
      <div className="mkt-grid mkt-grid--3">
        {[
          { icon: Package, num: "01", title: "Products with real demand", text: "ACs, TVs, freezers, refrigerators, cookers, washers, blenders and stabilizers are essential purchase categories for Nigerian homes and businesses." },
          { icon: TrendingUp, num: "02", title: "Higher order values", text: "Electronics and appliances usually have stronger average order values than everyday low-ticket ecommerce categories." },
          { icon: ShieldCheck, num: "03", title: "Trust-led selling", text: "Affiliates can promote original products, clearer choices, guided buying, warranty visibility and dependable support." },
        ].map((c) => (
          <div className="mkt-card aff-step" key={c.title}>
            <span className="aff-step__num">{c.num}</span>
            <span className="aff-step__icon"><c.icon size={24} /></span>
            <h3>{c.title}</h3>
            <p>{c.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---- COMMISSION ---- */
function CommissionSection() {
  return (
    <section id="commission" className="aff2-section aff2-commission">
      <div className="section-head">
        <div>
          <h2>Commission structure</h2>
          <p style={{ fontSize: 13, color: "var(--mut)", marginTop: 6, maxWidth: "60ch" }}>
            Suggested commission architecture for the first version of the program.
            Final rates can be adjusted based on category margin and campaign objectives.
          </p>
        </div>
      </div>
      <div className="aff2-comm-grid">
        <div className="aff2-table-wrap">
          <table className="aff2-table">
            <thead>
              <tr><th>Product group</th><th>Suggested commission</th><th>Best affiliate fit</th></tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Small kitchen appliances</strong><br /><span className="aff2-pill aff2-pill--green">High volume</span></td>
                <td>3% — 5%</td>
                <td>Food creators, lifestyle creators, deal pages</td>
              </tr>
              <tr>
                <td><strong>Power protection</strong><br /><span className="aff2-pill aff2-pill--amber">Cross-sell</span></td>
                <td>3% — 5%</td>
                <td>Tech pages, home setup creators, sales agents</td>
              </tr>
              <tr>
                <td><strong>TVs, washers, cookers</strong><br /><span className="aff2-pill">Mid-ticket</span></td>
                <td>2% — 4%</td>
                <td>Home, lifestyle, tech and review creators</td>
              </tr>
              <tr>
                <td><strong>ACs, freezers, refrigerators</strong><br /><span className="aff2-pill">High-ticket</span></td>
                <td>1.5% — 3%</td>
                <td>Home upgrade, B2B, real estate and SME partners</td>
              </tr>
              <tr>
                <td><strong>B2B / bulk orders</strong><br /><span className="aff2-pill aff2-pill--green">Custom</span></td>
                <td>Negotiated payout</td>
                <td>Corporate referrers, procurement partners, community connectors</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="aff2-earning-card">
          <h3>Affiliate earning logic</h3>
          <p>The program rewards both volume and quality of referrals. A creator who sends fewer but stronger purchase-ready leads should be valued differently from a page that only sends low-intent traffic.</p>
          <div className="aff2-earning-items">
            {[
              { icon: Banknote, title: "Base payout", text: "Commission on completed, paid and fulfilled orders." },
              { icon: Star, title: "Bonus payout", text: "Monthly bonus for top affiliates who exceed volume and quality targets." },
              { icon: Gift, title: "B2B referral payout", text: "Special reward for qualified corporate or bulk purchase opportunities." },
            ].map((e) => (
              <div className="aff2-earning-item" key={e.title}>
                <span className="aff2-earning-icon"><e.icon size={18} /></span>
                <div><b>{e.title}</b><p>{e.text}</p></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---- CATEGORIES ---- */
const AFFILIATE_CATS = [
  { img: "/products/ref.png", title: "Cooling & refrigeration", text: "Freezers, refrigerators and cold-storage products." },
  { img: "/products/ac.png", title: "Air conditioners", text: "Split, inverter and standing ACs for homes and offices." },
  { img: "/products/tv.png", title: "TVs & entertainment", text: "Smart TVs, LED TVs and home entertainment products." },
  { img: "/products/washing_machine.png", title: "Laundry appliances", text: "Front-load, top-load and semi-automatic washers." },
  { img: "/products/blender.png", title: "Small kitchen appliances", text: "Blenders, kettles, microwaves, mixers and more." },
  { img: "/products/cooker.png", title: "Cooking appliances", text: "Gas cookers, ovens, hobs and kitchen hardware." },
  { img: "/products/ups.png", title: "Power protection", text: "Stabilizers, surge protection and support devices." },
  { img: "/products/sbs_ref.png", title: "B2B / bulk supply", text: "Products for offices, hotels, schools, churches and SMEs." },
];

function CategoriesSection() {
  return (
    <section id="categories" className="aff2-section">
      <div className="section-head">
        <div>
          <h2>What affiliates can promote</h2>
          <p style={{ fontSize: 13, color: "var(--mut)", marginTop: 6, maxWidth: "60ch" }}>
            The best affiliate page makes the product universe easy to understand, because
            affiliates need to instantly know what kind of content they can create.
          </p>
        </div>
      </div>
      <div className="aff2-cats">
        {AFFILIATE_CATS.map((c) => (
          <div className="aff2-cat" key={c.title}>
            <div className="aff2-cat__img"><img src={c.img} alt={c.title} /></div>
            <div className="aff2-cat__body"><strong>{c.title}</strong><span>{c.text}</span></div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---- HOW IT WORKS ---- */
function HowSection() {
  return (
    <section id="how" className="aff2-section">
      <div className="section-head">
        <div>
          <h2>How the program works</h2>
          <p style={{ fontSize: 13, color: "var(--mut)", marginTop: 6, maxWidth: "60ch" }}>
            The experience should feel simple: apply, get approved, promote trackable products,
            and earn when your referrals become completed purchases.
          </p>
        </div>
      </div>
      <div className="aff2-flow">
        {[
          { num: 1, title: "Apply", text: "Affiliate submits name, platform, audience type, promotion channels and category interest." },
          { num: 2, title: "Get approved", text: `${SITE.name} reviews fit, audience quality, content style and fraud risk before approval.` },
          { num: 3, title: "Promote", text: "Affiliate receives links, campaign assets, product highlights and category scripts." },
          { num: 4, title: "Earn", text: "Affiliate earns on completed orders after payment, fulfilment and return-window validation." },
        ].map((s) => (
          <div className="mkt-card aff2-flow-card" key={s.num}>
            <span className="aff2-flow-num">{s.num}</span>
            <h3>{s.title}</h3>
            <p>{s.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---- APPLICATION ---- */
function ApplySection({ formRef }) {
  const [form, setForm] = useState({
    name: "", email: "", phone: "", type: "Content creator",
    channel: "", audience: "Under 5,000", category: "TVs & Entertainment", message: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <section id="apply" className="aff2-section aff2-apply" ref={formRef}>
      <div className="aff2-apply-grid">
        <div>
          <div className="section-head" style={{ display: "block", marginBottom: 18 }}>
            <h2>Apply to become a {SITE.name} affiliate</h2>
            <p style={{ fontSize: 13, color: "var(--mut)", marginTop: 6 }}>
              Designed for creators, bloggers, publishers, deal pages, community owners,
              sales referrers, corporate connectors and product reviewers.
            </p>
          </div>
          <div className="aff2-apply-info">
            {[
              { title: "Who should apply?", text: "Home/lifestyle creators, tech reviewers, food creators, real estate communities, deal pages, student/community groups, B2B connectors and trusted sales agents." },
              { title: "What makes a strong affiliate?", text: "Audience trust, clear content, responsible product claims, quality traffic, and the ability to drive real purchase intent." },
              { title: "Approval note", text: `${SITE.name} manually reviews affiliates first to protect brand trust before scaling to open registration.` },
            ].map((c) => (
              <div className="aff2-apply-card" key={c.title}>
                <b>{c.title}</b>
                <p>{c.text}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="aff2-form-card">
          <h3>Affiliate application</h3>
          {submitted ? (
            <div className="aff-form-success">
              <CheckCircle2 size={48} />
              <h3>Application Received!</h3>
              <p>We'll review your application and send your offer letter to <b>{form.email}</b> within 48 hours.</p>
              <Link to="/" className="aff2-btn" style={{ marginTop: 16 }}>
                Back to Home <ArrowRight size={16} />
              </Link>
            </div>
          ) : (
            <form className="aff2-form" onSubmit={(e) => { e.preventDefault(); setSubmitted(true); }}>
              <div className="aff2-form__row">
                <div className="aff2-field"><label>Full name</label><input required placeholder="Enter your name" value={form.name} onChange={set("name")} /></div>
                <div className="aff2-field"><label>Email address</label><input type="email" required placeholder="you@email.com" value={form.email} onChange={set("email")} /></div>
              </div>
              <div className="aff2-form__row">
                <div className="aff2-field"><label>Phone / WhatsApp</label><input placeholder="080..." value={form.phone} onChange={set("phone")} /></div>
                <div className="aff2-field">
                  <label>Affiliate type</label>
                  <select value={form.type} onChange={set("type")}>
                    <option>Content creator</option><option>Deal page</option><option>Blog / publisher</option>
                    <option>Community owner</option><option>B2B referrer</option><option>Sales agent</option>
                  </select>
                </div>
              </div>
              <div className="aff2-field"><label>Primary channel</label><input placeholder="Instagram, TikTok, YouTube, website, WhatsApp community..." value={form.channel} onChange={set("channel")} /></div>
              <div className="aff2-form__row">
                <div className="aff2-field">
                  <label>Estimated audience size</label>
                  <select value={form.audience} onChange={set("audience")}>
                    <option>Under 5,000</option><option>5,000 — 25,000</option><option>25,000 — 100,000</option><option>100,000+</option>
                  </select>
                </div>
                <div className="aff2-field">
                  <label>Preferred product category</label>
                  <select value={form.category} onChange={set("category")}>
                    <option>TVs & Entertainment</option><option>Air Conditioners</option><option>Freezers & Refrigerators</option>
                    <option>Kitchen Appliances</option><option>Power Protection</option><option>B2B / Bulk</option>
                  </select>
                </div>
              </div>
              <div className="aff2-field"><label>Why do you want to partner with {SITE.name}?</label><textarea rows={4} placeholder="Tell us about your audience and how you plan to promote the products." value={form.message} onChange={set("message")} /></div>
              <button type="submit" className="aff2-btn aff2-btn--full">Submit application</button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

/* ---- FAQ ---- */
const FAQS = [
  { q: "When do affiliates get paid?", a: "Recommended policy: pay after the order is completed, delivered, and the return/issue validation window has passed." },
  { q: "Can affiliates promote all products?", a: "Yes, but the best early approach is to push priority categories and campaign products with good stock and stronger margins." },
  { q: "Will affiliates get creative assets?", a: `Yes. ${SITE.name} provides banners, product highlights, short captions, product links and campaign talking points.` },
  { q: "How are sales tracked?", a: "Production version uses unique affiliate links, coupon codes, UTM tracking and an affiliate dashboard or monthly report." },
  { q: "Can B2B referrals qualify?", a: "Yes. B2B referrals have a custom reward model because bulk orders have different margins and timelines." },
  { q: "Who approves affiliates?", a: `${SITE.name} manually approves affiliates at launch to protect brand safety, customer trust and quality of traffic.` },
];

function FaqSection() {
  return (
    <section className="aff2-section">
      <div className="section-head">
        <div>
          <h2>Affiliate FAQs</h2>
          <p style={{ fontSize: 13, color: "var(--mut)", marginTop: 6 }}>
            These answers reduce friction and make the program feel credible.
          </p>
        </div>
      </div>
      <div className="aff2-faqs">
        {FAQS.map((f) => (
          <div className="aff2-faq" key={f.q}>
            <b>{f.q}</b>
            <p>{f.a}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---- FINAL CTA ---- */
function FinalCta({ onApply }) {
  return (
    <section className="aff2-final">
      <div className="aff2-final__copy">
        <h2>Ready to sell trusted electronics?</h2>
        <p>
          Join the {SITE.name} affiliate network and earn from products people
          actively need for homes, offices, businesses and everyday living.
        </p>
      </div>
      <button onClick={onApply} className="aff2-btn aff2-btn--amber">Start application <ArrowRight size={15} /></button>
    </section>
  );
}
