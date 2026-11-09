import { ShieldCheck, Zap } from "lucide-react";
import { WARRANTY_LABEL, withoutWarrantySpecs } from "../../utils/warrantyDisplay.js";

/**
 * ProductSpecsSection
 *
 * Renders a product's structured specs on the customer-facing
 * product page. Two visual layers:
 *
 *   1. Highlight badges: the warranty badge (same wording on every
 *      product) and energy class, shown as pills at the top.
 *
 *   2. Spec table: the specs jsonb array, rendered as a clean
 *      two-column label/value list, in the order the admin
 *      entered it.
 *
 * Warranty: terms are set by each manufacturer, so no period is
 * ever shown. products.warranty_months is kept in the database but
 * not displayed, and imported "Warranty" spec rows are hidden here
 * (see utils/warrantyDisplay.js).
 *
 * Usage:
 *   <ProductSpecsSection product={product} />
 */
export default function ProductSpecsSection({ product }) {
  if (!product) return null;

  const energyClass = product.energy_class;
  const specs = withoutWarrantySpecs(Array.isArray(product.specs) ? product.specs : [])
    .filter((s) => (s?.label || "").trim() || (s?.value || "").trim());
  const hasEnergy = energyClass && String(energyClass).trim();

  return (
    <section className="pspecs">
      <h2 className="pspecs__title">Specifications</h2>

      <div className="pspecs__badges">
        <span className="pspecs__badge pspecs__badge--warranty">
          <ShieldCheck size={14} />
          {WARRANTY_LABEL}
        </span>
        {hasEnergy && (
          <span className="pspecs__badge pspecs__badge--energy">
            <Zap size={14} />
            Energy Class {energyClass}
          </span>
        )}
      </div>

      {specs.length > 0 && (
        <table className="pspecs__table">
          <tbody>
            {specs.map((s, i) => (
              <tr key={i}>
                <th scope="row">{s.label || "—"}</th>
                <td>{s.value || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
