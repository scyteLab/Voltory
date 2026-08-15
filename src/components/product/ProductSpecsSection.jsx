import { ShieldCheck, Zap } from "lucide-react";

/**
 * ProductSpecsSection
 *
 * Renders a product's structured specs on the customer-facing
 * product page. Two visual layers:
 *
 *   1. Highlight badges  \u2014 warranty (months \u2192 human phrasing)
 *                          and energy class, shown as pills at
 *                          the top. Nigerian buyers care about
 *                          both, so we surface them prominently.
 *
 *   2. Spec table       \u2014 the specs jsonb array, rendered as
 *                          a clean two-column label/value list.
 *                          Ordered exactly as the admin entered
 *                          it. Duplicates preserved (rare, but
 *                          the schema allows it).
 *
 * Empty-state discipline: if the product has NEITHER warranty
 * nor energy class nor any specs, this component renders
 * nothing at all. That way a legacy product with no specs data
 * doesn't get a sad "no specs" placeholder \u2014 the section just
 * quietly doesn't exist. Add data \u2192 it appears.
 *
 * Usage:
 *   import ProductSpecsSection from "../components/product/ProductSpecsSection.jsx";
 *   \u2026
 *   <ProductSpecsSection product={product} />
 */
export default function ProductSpecsSection({ product }) {
  if (!product) return null;

  const warrantyMonths = product.warranty_months;
  const energyClass    = product.energy_class;
  const specs          = Array.isArray(product.specs) ? product.specs : [];

  const hasWarranty = warrantyMonths != null && warrantyMonths > 0;
  const hasEnergy   = energyClass && String(energyClass).trim();
  const hasSpecs    = specs.some((s) => (s?.label || "").trim() || (s?.value || "").trim());

  if (!hasWarranty && !hasEnergy && !hasSpecs) return null;

  return (
    <section className="pspecs">
      <h2 className="pspecs__title">Specifications</h2>

      {(hasWarranty || hasEnergy) && (
        <div className="pspecs__badges">
          {hasWarranty && (
            <span className="pspecs__badge pspecs__badge--warranty">
              <ShieldCheck size={14} />
              {formatWarranty(warrantyMonths)} warranty
            </span>
          )}
          {hasEnergy && (
            <span className="pspecs__badge pspecs__badge--energy">
              <Zap size={14} />
              Energy Class {energyClass}
            </span>
          )}
        </div>
      )}

      {hasSpecs && (
        <table className="pspecs__table">
          <tbody>
            {specs
              .filter((s) => (s?.label || "").trim() || (s?.value || "").trim())
              .map((s, i) => (
                <tr key={i}>
                  <th scope="row">{s.label || "\u2014"}</th>
                  <td>{s.value || "\u2014"}</td>
                </tr>
              ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

/**
 * Format warranty months as a human-readable phrase. Months
 * that are exact multiples of 12 render as years; anything else
 * as "N months". Zero returns null (shouldn't happen because
 * caller checks hasWarranty first, but defensive).
 */
function formatWarranty(months) {
  if (!months || months <= 0) return null;
  if (months % 12 === 0) {
    const years = months / 12;
    return years === 1 ? "1 year" : `${years} years`;
  }
  return months === 1 ? "1 month" : `${months} months`;
}