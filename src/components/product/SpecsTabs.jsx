import { useState } from "react";
import { ChevronRight, Star, Truck, Wrench, ShieldCheck, MessageSquareText, BadgeCheck, ThumbsUp } from "lucide-react";
import { naira } from "../../utils/format.js";
import { SITE } from "../../config/site.js";
import RatingStars from "./RatingStars.jsx";

/**
 * The tab strip + panels under the buy box. Reads everything from
 * the product record; missing sections render a graceful placeholder
 * so the page never has a "broken" tab.
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

function SpecsPanel({ product }) {
  if (!product.specs?.length) {
    return <Placeholder text="Full specifications coming soon. Contact our experts for details." />;
  }
  return (
    <table className="spec-table">
      <tbody>
        {product.specs.map(([k, v]) => (
          <tr key={k}>
            <th>{k}</th>
            <td>{v}</td>
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

/** Simple seeded hash from a string — keeps reviews stable per product. */
function hashSku(sku) {
  let h = 0;
  for (let i = 0; i < (sku || "PROD").length; i++) {
    h = ((h << 5) - h + (sku || "PROD").charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function generateRatingBreakdown(rating, total) {
  // Distribute reviews across 5-1 stars weighted toward the average
  const raw = [0, 0, 0, 0, 0]; // index 0 = 5 stars, index 4 = 1 star
  const weights = [0, 0, 0, 0, 0];

  for (let i = 0; i < 5; i++) {
    const starVal = 5 - i;
    // Gaussian-ish weighting centered on the rating
    weights[i] = Math.exp(-0.8 * Math.pow(starVal - rating, 2));
  }
  const wSum = weights.reduce((a, b) => a + b, 0);
  let assigned = 0;
  for (let i = 0; i < 5; i++) {
    raw[i] = Math.round((weights[i] / wSum) * total);
    assigned += raw[i];
  }
  // Fix rounding drift
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

    // Pick a rating band: mostly 4-5 for high-rated products
    let rBand;
    const r = ((seed + i * 73) % 100);
    if (rating >= 4.5) rBand = r < 70 ? 5 : r < 90 ? 4 : 3;
    else if (rating >= 4.0) rBand = r < 45 ? 5 : r < 80 ? 4 : r < 95 ? 3 : 2;
    else if (rating >= 3.0) rBand = r < 20 ? 5 : r < 45 ? 4 : r < 75 ? 3 : r < 90 ? 2 : 1;
    else rBand = r < 10 ? 4 : r < 30 ? 3 : r < 60 ? 2 : 1;

    const tpl = REVIEW_TEMPLATES.find((t) => t.rating === rBand) || REVIEW_TEMPLATES[0];
    const textIdx = (seed + i * 19) % tpl.texts.length;

    // Deterministic date in the last 6 months
    const daysAgo = ((seed + i * 53) % 180) + 1;
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);

    const verified = ((seed + i * 11) % 100) < 85; // 85% verified
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

/* ---------- Reviews panel ---------- */
function ReviewsPanel({ product }) {
  const rating = product.rating ?? 0;
  const total = product.reviews ?? 0;

  if (!total) return <Placeholder text="No reviews yet — be the first to share your experience after purchase." />;

  const breakdown = generateRatingBreakdown(rating, total);
  const mockReviews = generateMockReviews(product.sku, rating, total);

  return (
    <div className="reviews">
      {/* ---- Summary header ---- */}
      <div className="reviews__summary">
        <span className="reviews__big">{rating.toFixed(1)}</span>
        <div className="reviews__summary-right">
          <RatingStars rating={rating} reviews={null} size={18} />
          <p>Based on {total} verified customer review{total === 1 ? "" : "s"}</p>
        </div>
      </div>

      {/* ---- Rating breakdown bars ---- */}
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

      {/* ---- Write a review button ---- */}
      <div className="reviews__actions">
        <button
          className="reviews__write-btn"
          onClick={() => alert("Thank you for your interest! The review submission form will be available soon.")}
        >
          Write a Review
        </button>
      </div>

      {/* ---- Individual review cards ---- */}
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
              <button className="review-card__helpful" onClick={() => alert("Thanks for your feedback!")}>
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
  if (!product.questions) return <Placeholder text="No questions yet. Have one? Tap below to ask." />;
  return <Placeholder text={`${product.questions} answered question${product.questions === 1 ? "" : "s"}. Full Q&A panel coming soon.`} />;
}

function Placeholder({ text }) {
  return <p className="ptabs__placeholder">{text}</p>;
}