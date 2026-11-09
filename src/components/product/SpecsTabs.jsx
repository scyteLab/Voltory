import { useEffect, useState } from "react";
import {
  ChevronRight, MessageSquareText, ShieldCheck, Truck, Wrench,
} from "lucide-react";
import { naira } from "../../utils/format.js";
import { SITE } from "../../config/site.js";
import { fetchProductAttributes, attributesToSpecRows } from "../../lib/productAttributesClient.js";
import { productHelpMessage, whatsappUrl } from "../../utils/whatsappMessage.js";
import { WARRANTY_LABEL, withoutWarrantySpecs, withoutWarrantyHighlights } from "../../utils/warrantyDisplay.js";

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
 * Reviews live in ReviewsSection (real, approved reviews only);
 * this component no longer has a reviews tab.
 */
export default function SpecsTabs({ product: p }) {
  const tabs = [
    { id: "specs", label: "Specifications" },
    { id: "desc", label: "Description" },
    { id: "delivery", label: "Delivery & Installation" },
    { id: "warranty", label: "Warranty & Returns" },
    { id: "qa", label: "Q&A" },
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
        {active === "warranty" && <WarrantyPanel />}
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
        setAttrRows(withoutWarrantySpecs(attributesToSpecRows(res.data)));
      } else {
        /* Fail silently on the customer page — spec table just
           renders JSONB specs alone, which is what it did before. */
        setAttrRows([]);
      }
    })();
    return () => { cancelled = true; };
  }, [product.sku]);

  /* Warranty rows are hidden: no specific periods on the storefront. */
  const jsonSpecs = withoutWarrantySpecs(normalizeSpecs(product.specs));

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
  const highlights = withoutWarrantyHighlights(product.highlights);
  return (
    <div className="rich">
      <p>{product.description || `The ${product.name} is part of NAVEN's curated catalogue of original electronics, backed by official warranty and after-sales support across Nigeria.`}</p>
      {highlights.length > 0 && (
        <>
          <h4>Key Highlights</h4>
          <ul>{highlights.map((h) => <li key={h}>{h}</li>)}</ul>
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

function WarrantyPanel() {
  return (
    <div className="info-grid">
      <div className="info-card">
        <ShieldCheck size={20} />
        <b>Manufacturer Warranty</b>
        <p>{WARRANTY_LABEL}. Terms are set by each manufacturer. Activated automatically with your order.</p>
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
   WhatsApp CTA helper (message text: utils/whatsappMessage.js)
   ============================================================ */
function productQuestionUrl(product) {
  return whatsappUrl(productHelpMessage(product));
}

function QAPanel({ product }) {
  const questionLink = productQuestionUrl(product);

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