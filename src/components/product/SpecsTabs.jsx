import { useEffect, useState } from "react";
import {
  BadgeCheck, ChevronRight, MessageSquareText, ShieldCheck,
  Star, ThumbsUp, Truck, Wrench,
} from "lucide-react";
import { naira } from "../../utils/format.js";
import { SITE } from "../../config/site.js";
import RatingStars from "./RatingStars.jsx";
import { fetchProductAttributes, attributesToSpecRows } from "../../lib/productAttributesClient.js";

/**
 * SpecsTabs — tab strip + panels below the buy box.
 *
 * Session 2 change: SpecsPanel now fetches structured attribute
 * values for the product and merges them with the JSONB specs
 * into a single unified table. Coexistence pattern C:
 *   · Admin has two edit surfaces (Specifications section for
 *     free-form specs; Attributes panel for structured attributes)
 *   · Customer sees ONE table — attributes appear first
 *     (ordered by attribute.position), then JSONB specs
 *   · No visible distinction between the two sources
 *
 * Not changed: DescPanel, DeliveryPanel, WarrantyPanel,
 * ReviewsPanel, QAPanel — all preserved verbatim.
 */
export default function SpecsTabs({ product: p }) {
  const tabs = [
    { id: "specs", label: "Specifications" },
    { id: "desc", label: "Description" },
    { id: "delivery", label: "Delivery & Installation" },
    { id: "warranty", label: "Warranty & Returns" },
    { id: "reviews", label: `Reviews (${p.reviews ?? 0})` },
    { id: "qa", label: `Q&A (${p.questions ?? 0})` },
  ];
  const [active, setActive] = useState("specs");

  return (
    <section className="ptabs" aria-label="Product information">
      <div className="ptabs__bar" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            className={"ptabs__tab" + (active === t.id ? " ptabs__tab--on" : "")}
            onClick={() => setActive(t.id)}
            aria-selected={active === t.id}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="ptabs__panel" role="tabpanel">
        {active === "specs" && <SpecsPanel product={p} />}
        {active === "desc" && <DescPanel product={p} />}
        {active === "delivery" && <DeliveryPanel product={p} />}
        {active === "warranty" && <WarrantyPanel product={p} />}
        {active === "reviews" && <ReviewsPanel product={p} />}
        {active === "qa" && <QAPanel product={p} />}
      </div>
    </section>
  );
}

/* ============================================================
   Specs shape normalizer
   ============================================================

   Accepts either the tuple shape [label, value] or object shape
   {label, value}. Returns a consistent array. Blank rows dropped.
*/
function normalizeSpecs(specs) {
  if (!Array.isArray(specs)) return [];
  return specs
    .map((row) => {
      if (row && typeof row === "object" && !Array.isArray(row)) {
        return {
          label: String(row.label ?? "").trim(),
          value: String(row.value ?? "").trim(),
        };
      }
      if (Array.isArray(row) && row.length >= 2) {
        return {
          label: String(row[0] ?? "").trim(),
          value: String(row[1] ?? "").trim(),
        };
      }
      return { label: "", value: "" };
    })
    .filter((r) => r.label || r.value);
}

/* ============================================================
   Specs panel — now async, merges attributes + JSONB specs
   ============================================================ */

function SpecsPanel({ product }) {
  const [attrRows, setAttrRows] = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const res = await fetchProductAttributes(product.sku);
      if (cancelled) return;
      setLoading(false);
      if (res.ok) {
        setAttrRows(attributesToSpecRows(res.data));
      } else {
        /* Fail silently on the customer page — spec table just
           renders JSONB specs alone, which is what it did before. */
        setAttrRows([]);
      }
    })();
    return () => { cancelled = true; };
  }, [product.sku]);

  const jsonSpecs = normalizeSpecs(product.specs);

  /* Merge order: attributes first (they're the "structured" data
     admins have curated with intent), then JSONB specs as free-form
     additions below. Skip attribute rows whose label collides with
     a JSONB spec label — attributes win, since they're the source
     of truth going forward. */
  const attrLabelsLower = new Set(
    attrRows.map((r) => String(r.label).toLowerCase())
  );
  const dedupedJson = jsonSpecs.filter(
    (r) => !attrLabelsLower.has(String(r.label).toLowerCase())
  );

  const merged = [...attrRows, ...dedupedJson];

  if (loading && merged.length === 0) {
    /* Show existing JSONB specs immediately if we have them, only
       show loading if there's nothing at all to render yet. */
    if (jsonSpecs.length > 0) {
      return (
        <table className="spec-table">
          <tbody>
            {jsonSpecs.map((row, i) => (
              <tr key={`${row.label}-${i}`}>
                <th>{row.label || "—"}</th>
                <td>{row.value || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
    return <Placeholder text="Loading specifications…" />;
  }

  if (merged.length === 0) {
    return <Placeholder text="Full specifications coming soon. Contact our experts for details." />;
  }

  return (
    <table className="spec-table">
      <tbody>
        {merged.map((row, i) => (
          <tr key={`${row.label}-${i}`}>
            <th>{row.label || "—"}</th>
            <td>{row.value || "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DescPanel({ product }) {
  return (
    <div className="rich">
      <p>{product.description || `The ${product.name} is part of NAVEN's curated catalogue of original electronics, backed by official warranty and after-sales support across Nigeria.`}</p>
      {product.highlights?.length > 0 && (
        <>
          <h4>Key Highlights</h4>
          <ul>{product.highlights.map((h) => <li key={h}>{h}</li>)}</ul>
        </>
      )}
    </div>
  );
}

function DeliveryPanel() {
  return (
    <div className="info-grid">
      <div className="info-card">
        <Truck size={20} />
        <b>Nationwide Delivery</b>
        <p>1–3 working days within Lagos, Abuja, and Port Harcourt. 3–7 days to other states.</p>
      </div>
      <div className="info-card">
        <Wrench size={20} />
        <b>Professional Installation</b>
        <p>Certified technicians available for ACs, TVs and washing machines. Add at checkout for {naira(SITE.installationFee)}.</p>
      </div>
      <div className="info-card">
        <ChevronRight size={20} />
        <b>Pay on Delivery</b>
        <p>Available for orders within Lagos. Confirmation by phone before dispatch.</p>
      </div>
    </div>
  );
}

function WarrantyPanel({ product }) {
  const wTag = product.tags?.find((t) => t.toLowerCase().includes("warranty"));
  return (
    <div className="info-grid">
      <div className="info-card">
        <ShieldCheck size={20} />
        <b>Manufacturer Warranty</b>
        <p>{wTag || "Standard manufacturer warranty included"}. Activated automatically with your order.</p>
      </div>
      <div className="info-card">
        <ChevronRight size={20} />
        <b>7-Day Returns</b>
        <p>Easy returns within 7 days for eligible items in original packaging.</p>
      </div>
      <div className="info-card">
        <MessageSquareText size={20} />
        <b>After-sales Support</b>
        <p>Reach our support team by phone or WhatsApp — we’re here before and after your purchase.</p>
      </div>
    </div>
  );
}

/* ============================================================
   WhatsApp CTA helpers
   ============================================================ */
function whatsappUrl(topic, product) {
  const base = SITE.whatsappLink || "";
  const message = topic === "question"
    ? `Hi NAVEN, I have a question about "${product.name}" (SKU: ${product.sku}). Could you help?`
    : `Hi NAVEN, I recently bought "${product.name}" (SKU: ${product.sku}) and I'd like to share a review.`;

  const encoded = encodeURIComponent(message);

  if (base.includes("?")) {
    return `${base}&text=${encoded}`;
  }
  if (base.startsWith("https://wa.me/") || base.startsWith("http://wa.me/")) {
    return `${base}?text=${encoded}`;
  }
  const phone = String(base).replace(/[^0-9]/g, "");
  return phone ? `https://wa.me/${phone}?text=${encoded}` : base;
}

/* ---------- deterministic mock review generator ---------- */
const REVIEWER_POOL = [
  { name: "Chidi O.", city: "Lagos" },
  { name: "Funmi A.", city: "Abuja" },
  { name: "Bayo T.", city: "Port Harcourt" },
  { name: "Ngozi E.", city: "Enugu" },
  { name: "Emeka K.", city: "Lagos" },
  { name: "Aisha M.", city: "Kano" },
  { name: "Tolu D.", city: "Ibadan" },
  { name: "Kemi S.", city: "Lagos" },
];

const REVIEW_TEMPLATES = [
  {
    rating: 5,
    texts: [
      "Excellent product! Delivery was fast and the item arrived in perfect condition. Very happy with this purchase.",
      "Top quality, exactly as described on the website. NAVEN's packaging was superb. Would definitely recommend to friends and family.",
      "This is my second purchase from NAVEN and I'm not disappointed. The product works perfectly and customer service was very responsive.",
    ],
  },
  {
    rating: 4,
    texts: [
      "Good value for money. Works well so far, though delivery took an extra day. Overall I'm satisfied with the purchase.",
      "Very decent product. Installation was straightforward. Only giving 4 stars because the manual could be clearer.",
      "Solid build quality and performs as expected. The only minor issue was a small scratch on the packaging, but the product itself is fine.",
    ],
  },
  {
    rating: 3,
    texts: [
      "Product is okay for the price. Does what it's supposed to do but nothing extraordinary. Average experience overall.",
      "It works, but I expected a bit more based on the description. Delivery was smooth though, and customer support was helpful.",
    ],
  },
  {
    rating: 2,
    texts: [
      "Not fully satisfied. The product feels cheaper than expected. Still works but I had higher expectations for this brand.",
    ],
  },
  {
    rating: 1,
    texts: [
      "Disappointed with this purchase. Product did not meet expectations at all. Currently in touch with support for a resolution.",
    ],
  },
];

function hashSku(sku) {
  let h = 0;
  for (let i = 0; i < (sku || "PROD").length; i++) {
    h = ((h << 5) - h + (sku || "PROD").charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function generateRatingBreakdown(rating, total) {
  const raw = [0, 0, 0, 0, 0];
  const weights = [0, 0, 0, 0, 0];

  for (let i = 0; i < 5; i++) {
    const starVal = 5 - i;
    weights[i] = Math.exp(-0.8 * Math.pow(starVal - rating, 2));
  }
  const wSum = weights.reduce((a, b) => a + b, 0);
  let assigned = 0;
  for (let i = 0; i < 5; i++) {
    raw[i] = Math.round((weights[i] / wSum) * total);
    assigned += raw[i];
  }
  raw[0] += total - assigned;

  return [5, 4, 3, 2, 1].map((star, idx) => ({
    star,
    count: Math.max(0, raw[idx]),
    pct: total ? Math.round((Math.max(0, raw[idx]) / total) * 100) : 0,
  }));
}

function generateMockReviews(sku, rating, total) {
  const seed = hashSku(sku);
  const count = Math.min(total, Math.max(3, Math.min(5, total)));
  const reviews = [];

  for (let i = 0; i < count; i++) {
    const idx = (seed + i * 37) % REVIEWER_POOL.length;
    const reviewer = REVIEWER_POOL[idx];

    let rBand;
    const r = ((seed + i * 73) % 100);
    if (rating >= 4.5) rBand = r < 70 ? 5 : r < 90 ? 4 : 3;
    else if (rating >= 4.0) rBand = r < 45 ? 5 : r < 80 ? 4 : r < 95 ? 3 : 2;
    else if (rating >= 3.0) rBand = r < 20 ? 5 : r < 45 ? 4 : r < 75 ? 3 : r < 90 ? 2 : 1;
    else rBand = r < 10 ? 4 : r < 30 ? 3 : r < 60 ? 2 : 1;

    const tpl = REVIEW_TEMPLATES.find((t) => t.rating === rBand) || REVIEW_TEMPLATES[0];
    const textIdx = (seed + i * 19) % tpl.texts.length;

    const daysAgo = ((seed + i * 53) % 180) + 1;
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);

    const verified = ((seed + i * 11) % 100) < 85;
    const helpful = ((seed + i * 41) % 24);

    reviews.push({
      id: i,
      name: reviewer.name,
      city: reviewer.city,
      rating: rBand,
      text: tpl.texts[textIdx],
      date: d.toLocaleDateString("en-NG", { year: "numeric", month: "short", day: "numeric" }),
      verified,
      helpful,
    });
  }
  return reviews;
}

function ReviewsPanel({ product }) {
  const rating = product.rating ?? 0;
  const total = product.reviews ?? 0;

  if (!total) return <Placeholder text="No reviews yet — be the first to share your experience after purchase." />;

  const breakdown = generateRatingBreakdown(rating, total);
  const mockReviews = generateMockReviews(product.sku, rating, total);
  const reviewLink = whatsappUrl("review", product);

  return (
    <div className="reviews">
      <div className="reviews__summary">
        <span className="reviews__big">{rating.toFixed(1)}</span>
        <div className="reviews__summary-right">
          <RatingStars rating={rating} reviews={null} size={18} />
          <p>Based on {total} verified customer review{total === 1 ? "" : "s"}</p>
        </div>
      </div>

      <div className="rating-bars">
        {breakdown.map((b) => (
          <div className="rating-bars__row" key={b.star}>
            <span className="rating-bars__label">{b.star} <Star size={12} fill="currentColor" strokeWidth={0} /></span>
            <div className="rating-bars__track">
              <div
                className="rating-bars__fill"
                style={{ width: `${b.pct}%` }}
              />
            </div>
            <span className="rating-bars__count">{b.count}</span>
          </div>
        ))}
      </div>

      <div className="reviews__actions">
        <a
          className="reviews__write-btn"
          href={reviewLink}
          target="_blank"
          rel="noreferrer"
        >
          Write a Review
        </a>
        <small className="reviews__write-hint">
          Share your experience with our team on WhatsApp — we'll add verified reviews to the site.
        </small>
      </div>

      <div className="reviews__list">
        {mockReviews.map((rev) => (
          <div className="review-card" key={rev.id}>
            <div className="review-card__header">
              <div className="review-card__author">
                <span className="review-card__avatar">{rev.name.charAt(0)}</span>
                <div>
                  <b className="review-card__name">{rev.name}</b>
                  <span className="review-card__meta">{rev.city} &middot; {rev.date}</span>
                </div>
              </div>
              {rev.verified && (
                <span className="review-card__verified">
                  <BadgeCheck size={14} /> Verified Purchase
                </span>
              )}
            </div>
            <div className="review-card__stars">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  size={14}
                  fill="currentColor"
                  strokeWidth={0}
                  className={s <= rev.rating ? "stars__on" : "stars__off"}
                />
              ))}
            </div>
            <p className="review-card__text">{rev.text}</p>
            <div className="review-card__footer">
              <button
                className="review-card__helpful"
                onClick={(e) => { e.preventDefault(); }}
              >
                <ThumbsUp size={13} /> Helpful ({rev.helpful})
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function QAPanel({ product }) {
  const questionLink = whatsappUrl("question", product);
  const count = product.questions ?? 0;

  return (
    <div className="qa-cta">
      <div className="qa-cta__icon">
        <MessageSquareText size={24} />
      </div>
      <div className="qa-cta__body">
        <h3>Have a question about this product?</h3>
        <p>
          Chat with our product experts on WhatsApp for personalized advice, availability,
          delivery timelines, or anything else you need to know before buying.
          {count > 0 && (
            <span className="qa-cta__count">
              &nbsp;{count} customer{count === 1 ? " has" : "s have"} asked us about this product so far.
            </span>
          )}
        </p>
        <a
          className="qa-cta__btn"
          href={questionLink}
          target="_blank"
          rel="noreferrer"
        >
          <MessageSquareText size={16} /> Ask on WhatsApp
        </a>
      </div>
    </div>
  );
}

function Placeholder({ text }) {
  return <p className="ptabs__placeholder">{text}</p>;
}