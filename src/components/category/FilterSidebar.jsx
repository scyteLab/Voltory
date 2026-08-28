import { useMemo } from "react";
import { X } from "lucide-react";
import { naira } from "../../utils/format.js";

/**
 * Filter sidebar. Reads the category's filterConfig and renders
 * only the filter groups that apply. State lives in the parent
 * Category page; this component is pure UI.
 *
 * Adding a new HARDCODED filter type = add a renderer in RENDERERS
 * below and reference its key in a category's filterConfig.
 *
 * Session 3: also renders DYNAMIC attribute filters below the
 * hardcoded ones. Attributes come from the parent via the new
 * `attributes` prop (fetched with values already assigned) and
 * their filter state comes via `attrFilters` / `setAttrFilter`.
 * See Category.jsx for how these are wired.
 */
export default function FilterSidebar({
  category,
  products,
  filters,
  setFilters,
  onClear,
  onClose,
  /* Session 3 additions — all optional so this component still
     works without attribute wiring */
  attributes = [],           // [{ id, slug, name, type, unit, allowed_values }]
  attrFilters = {},          // { [slug]: value | [values] | { min, max } }
  setAttrFilter,             // (slug, value) => void
  attributeCounts = {},      // { [slug]: { [value]: count } | { min, max } }
}) {
  const config = category?.filterConfig ?? ["brand", "rating", "price", "availability"];
  const counts = useFacetCounts(products);

  const toggleArray = (key, value) =>
    setFilters((f) => {
      const set = new Set(f[key] || []);
      set.has(value) ? set.delete(value) : set.add(value);
      return { ...f, [key]: Array.from(set) };
    });

  const setValue = (key, value) =>
    setFilters((f) => ({ ...f, [key]: value }));

  const hardcodedActive =
    (filters.brand?.length || 0) +
    (filters.hp?.length || 0) +
    (filters.inverter?.length || 0) +
    (filters.litres?.length || 0) +
    (filters.doors?.length || 0) +
    (filters.availability?.length || 0) +
    (filters.rating ? 1 : 0) +
    (filters.priceMin || filters.priceMax ? 1 : 0);

  const attrActive = Object.values(attrFilters).filter((v) => {
    if (v == null) return false;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === "object") return v.min != null || v.max != null;
    return String(v).length > 0;
  }).length;

  const hasActive = hardcodedActive + attrActive > 0;

  /* Only render attribute filters that have at least one product
     with a value — otherwise the filter is dead weight. */
  const usefulAttributes = attributes.filter((attr) => {
    const c = attributeCounts[attr.slug];
    if (!c) return false;
    if (attr.type === "number") {
      return c.min != null && c.max != null;
    }
    if (attr.type === "boolean") {
      return (c.true || 0) + (c.false || 0) > 0;
    }
    /* select, multi_select, color, text: at least one non-empty bucket */
    return Object.values(c).some((n) => (typeof n === "number" ? n > 0 : false));
  });

  return (
    <aside className="cfilter" aria-label="Filters">
      <div className="cfilter__head">
        <b>Filters</b>
        {hasActive && (
          <button className="cfilter__clear" onClick={onClear}>Clear all</button>
        )}
        {onClose && (
          <button className="cfilter__close" onClick={onClose} aria-label="Close filters">
            <X size={18} />
          </button>
        )}
      </div>

      {/* Hardcoded filters (config-driven) */}
      {config.map((key) => {
        const R = RENDERERS[key];
        if (!R) return null;
        return <R key={key} counts={counts} filters={filters} toggleArray={toggleArray} setValue={setValue} />;
      })}

      {/* Dynamic attribute filters (Session 3) */}
      {usefulAttributes.map((attr) => (
        <AttributeFilter
          key={attr.id}
          attribute={attr}
          value={attrFilters[attr.slug]}
          counts={attributeCounts[attr.slug] || {}}
          onChange={(v) => setAttrFilter && setAttrFilter(attr.slug, v)}
        />
      ))}
    </aside>
  );
}

/* ============================================================
   ATTRIBUTE FILTER — dispatches on attribute type
   ============================================================ */

function AttributeFilter({ attribute, value, counts, onChange }) {
  const { type, name, unit, allowed_values = [] } = attribute;

  switch (type) {
    case "select":
    case "multi_select":
      return (
        <SelectAttrFilter
          title={name}
          allowedValues={allowed_values}
          counts={counts}
          value={value}
          onChange={onChange}
          multi={type === "multi_select"}
        />
      );
    case "color":
      return (
        <ColorAttrFilter
          title={name}
          allowedValues={allowed_values}
          counts={counts}
          value={value}
          onChange={onChange}
        />
      );
    case "number":
      return (
        <NumberAttrFilter
          title={name}
          unit={unit}
          counts={counts}
          value={value || {}}
          onChange={onChange}
        />
      );
    case "boolean":
      return (
        <BooleanAttrFilter
          title={name}
          counts={counts}
          value={value}
          onChange={onChange}
        />
      );
    case "text":
    default:
      return null; /* Text attributes aren't filterable in Session 3 */
  }
}

/* Select / multi_select — checkbox list */
function SelectAttrFilter({ title, allowedValues, counts, value, onChange, multi }) {
  const active = Array.isArray(value) ? value : (value ? [value] : []);

  const toggle = (v) => {
    if (multi) {
      const set = new Set(active);
      set.has(v) ? set.delete(v) : set.add(v);
      onChange(Array.from(set));
    } else {
      /* single select: clicking selected value clears it */
      onChange(active.includes(v) ? [] : [v]);
    }
  };

  const rows = allowedValues
    .map((av) => [av.value, av.label, counts[av.value] || 0])
    .filter(([, , c]) => c > 0);

  if (rows.length === 0) return null;

  return (
    <div className="cfilter__group">
      <h4>{title}</h4>
      <ul>
        {rows.map(([val, label, count]) => {
          const id = `attr-${title}-${val}`;
          return (
            <li key={val}>
              <input
                id={id}
                type="checkbox"
                checked={active.includes(val)}
                onChange={() => toggle(val)}
              />
              <label htmlFor={id}>
                {label}
                <em>({count})</em>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* Color — swatch chips (single select) */
function ColorAttrFilter({ title, allowedValues, counts, value, onChange }) {
  const active = Array.isArray(value) ? value : (value ? [value] : []);

  const toggle = (v) => {
    const set = new Set(active);
    set.has(v) ? set.delete(v) : set.add(v);
    onChange(Array.from(set));
  };

  const rows = allowedValues
    .map((av) => ({ ...av, count: counts[av.value] || 0 }))
    .filter((av) => av.count > 0);

  if (rows.length === 0) return null;

  return (
    <div className="cfilter__group">
      <h4>{title}</h4>
      <ul className="cfilter__swatches">
        {rows.map((av) => {
          const on = active.includes(av.value);
          return (
            <li key={av.value}>
              <button
                type="button"
                className={"cfilter__swatch" + (on ? " cfilter__swatch--on" : "")}
                onClick={() => toggle(av.value)}
                title={`${av.label} (${av.count})`}
                aria-pressed={on}
                aria-label={`${av.label}, ${av.count} product${av.count === 1 ? "" : "s"}`}
              >
                <span
                  className="cfilter__swatch-color"
                  style={{ background: av.hex_color || "#e5e7eb" }}
                />
                <span className="cfilter__swatch-lbl">{av.label}</span>
                <em>({av.count})</em>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* Number — min/max range with dynamic bounds */
function NumberAttrFilter({ title, unit, counts, value, onChange }) {
  const min = counts.min;
  const max = counts.max;
  if (min == null || max == null) return null;

  const hint = unit
    ? `Range: ${min}${unit} – ${max}${unit}`
    : `Range: ${min} – ${max}`;

  return (
    <div className="cfilter__group">
      <h4>{title}{unit ? ` (${unit})` : ""}</h4>
      <div className="cfilter__price">
        <input
          type="text"
          inputMode="numeric"
          placeholder="Min"
          value={value.min ?? ""}
          onChange={(e) => {
            const v = e.target.value.replace(/[^0-9.]/g, "");
            onChange({ ...value, min: v ? Number(v) : null });
          }}
        />
        <span>—</span>
        <input
          type="text"
          inputMode="numeric"
          placeholder="Max"
          value={value.max ?? ""}
          onChange={(e) => {
            const v = e.target.value.replace(/[^0-9.]/g, "");
            onChange({ ...value, max: v ? Number(v) : null });
          }}
        />
      </div>
      <small className="cfilter__hint">{hint}</small>
    </div>
  );
}

/* Boolean — Yes / No pills */
function BooleanAttrFilter({ title, counts, value, onChange }) {
  const trueCount = counts.true || 0;
  const falseCount = counts.false || 0;
  if (trueCount + falseCount === 0) return null;

  return (
    <div className="cfilter__group">
      <h4>{title}</h4>
      <ul>
        {trueCount > 0 && (
          <li>
            <input
              id={`attr-bool-${title}-yes`}
              type="checkbox"
              checked={value === true}
              onChange={() => onChange(value === true ? null : true)}
            />
            <label htmlFor={`attr-bool-${title}-yes`}>
              Yes <em>({trueCount})</em>
            </label>
          </li>
        )}
        {falseCount > 0 && (
          <li>
            <input
              id={`attr-bool-${title}-no`}
              type="checkbox"
              checked={value === false}
              onChange={() => onChange(value === false ? null : false)}
            />
            <label htmlFor={`attr-bool-${title}-no`}>
              No <em>({falseCount})</em>
            </label>
          </li>
        )}
      </ul>
    </div>
  );
}

/* ============================================================
   HARDCODED FILTER FACET COUNTS (existing, unchanged)
   ============================================================ */
function useFacetCounts(products) {
  return useMemo(() => {
    const brand = {}, hp = {}, inverter = {}, litres = {}, doors = {};
    let inStock = 0, outStock = 0;
    for (const p of products) {
      brand[p.brand] = (brand[p.brand] || 0) + 1;
      if (p.hp != null) hp[p.hp] = (hp[p.hp] || 0) + 1;
      if (p.inverter != null) {
        const k = p.inverter ? "Inverter" : "Non-Inverter";
        inverter[k] = (inverter[k] || 0) + 1;
      }
      if (p.litres != null) {
        const bucket = p.litres < 250 ? "Under 250L" : p.litres < 450 ? "250 – 450L" : "Over 450L";
        litres[bucket] = (litres[bucket] || 0) + 1;
      }
      if (p.doors != null) doors[p.doors] = (doors[p.doors] || 0) + 1;
      if (p.stock > 0) inStock++;
      else outStock++;
    }
    return { brand, hp, inverter, litres, doors, inStock, outStock };
  }, [products]);
}

/* ---------- filter group: re-usable checkbox column ---------- */
function CheckGroup({ title, entries, active, onToggle, formatter = (k) => k }) {
  if (!entries.length) return null;
  return (
    <div className="cfilter__group">
      <h4>{title}</h4>
      <ul>
        {entries.map(([key, count]) => {
          const id = `f-${title}-${key}`;
          return (
            <li key={key}>
              <input
                id={id}
                type="checkbox"
                checked={active.includes(key)}
                onChange={() => onToggle(key)}
              />
              <label htmlFor={id}>
                {formatter(key)}
                <em>({count})</em>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------- per-filter renderers ---------- */
const RENDERERS = {
  brand: ({ counts, filters, toggleArray }) => (
    <CheckGroup
      title="Brand"
      entries={Object.entries(counts.brand).sort()}
      active={filters.brand || []}
      onToggle={(v) => toggleArray("brand", v)}
    />
  ),
  hp: ({ counts, filters, toggleArray }) => (
    <CheckGroup
      title="HP (Cooling Capacity)"
      entries={Object.entries(counts.hp).sort((a, b) => Number(a[0]) - Number(b[0]))}
      active={filters.hp || []}
      onToggle={(v) => toggleArray("hp", v)}
      formatter={(k) => `${k} HP`}
    />
  ),
  inverter: ({ counts, filters, toggleArray }) => (
    <CheckGroup
      title="Inverter Type"
      entries={Object.entries(counts.inverter)}
      active={filters.inverter || []}
      onToggle={(v) => toggleArray("inverter", v)}
    />
  ),
  litres: ({ counts, filters, toggleArray }) => (
    <CheckGroup
      title="Capacity (Litres)"
      entries={[
        ["Under 250L", counts.litres["Under 250L"] || 0],
        ["250 – 450L", counts.litres["250 – 450L"] || 0],
        ["Over 450L", counts.litres["Over 450L"] || 0],
      ].filter(([, c]) => c > 0)}
      active={filters.litres || []}
      onToggle={(v) => toggleArray("litres", v)}
    />
  ),
  doors: ({ counts, filters, toggleArray }) => (
    <CheckGroup
      title="Doors"
      entries={Object.entries(counts.doors).sort()}
      active={(filters.doors || []).map(String)}
      onToggle={(v) => toggleArray("doors", v)}
      formatter={(k) => `${k} Door${k === "1" ? "" : "s"}`}
    />
  ),
  price: ({ filters, setValue }) => (
    <div className="cfilter__group">
      <h4>Price Range</h4>
      <div className="cfilter__price">
        <input
          type="text"
          inputMode="numeric"
          placeholder={"₦ Min"}
          value={filters.priceMin || ""}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "");
            setValue("priceMin", v ? Number(v) : "");
          }}
        />
        <span>{"—"}</span>
        <input
          type="text"
          inputMode="numeric"
          placeholder={"₦ Max"}
          value={filters.priceMax || ""}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "");
            setValue("priceMax", v ? Number(v) : "");
          }}
        />
      </div>
      <ul className="cfilter__pricechips">
        {PRICE_PRESETS.map((p) => {
          const on = filters.priceMin === p.min && filters.priceMax === p.max;
          return (
            <li key={p.label}>
              <button
                type="button"
                className={"cfilter__chip" + (on ? " cfilter__chip--on" : "")}
                onClick={() => {
                  setValue("priceMin", p.min);
                  setValue("priceMax", p.max);
                }}
              >
                <span className={"cfilter__radio" + (on ? " cfilter__radio--on" : "")} />
                {p.label}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  ),
  availability: ({ counts, filters, toggleArray }) => (
    <CheckGroup
      title="Availability"
      entries={[
        ["In Stock", counts.inStock],
        ["Out of Stock", counts.outStock],
      ].filter(([, c]) => c > 0)}
      active={filters.availability || []}
      onToggle={(v) => toggleArray("availability", v)}
    />
  ),
  rating: ({ filters, setValue }) => (
    <div className="cfilter__group">
      <h4>Customer Rating</h4>
      <ul className="cfilter__list cfilter__list--rating">
        {[4, 3, 2, 1].map((min) => {
          const active = filters.rating === min;
          return (
            <li key={min}>
              <button
                type="button"
                className={"cfilter__rating" + (active ? " cfilter__rating--on" : "")}
                onClick={() => setValue("rating", active ? "" : min)}
              >
                <span className="cfilter__rating-stars">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <span
                      key={n}
                      className={n <= min ? "cfilter__star cfilter__star--on" : "cfilter__star"}
                      aria-hidden="true"
                    >★</span>
                  ))}
                </span>
                <span className="cfilter__rating-lbl">& up</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  ),
};

const PRICE_PRESETS = [
  { label: `Under ${naira(150000)}`, min: "", max: 150000 },
  { label: `${naira(150000)} – ${naira(500000)}`, min: 150000, max: 500000 },
  { label: `${naira(500000)} – ${naira(1000000)}`, min: 500000, max: 1000000 },
  { label: `Above ${naira(1000000)}`, min: 1000000, max: "" },
];