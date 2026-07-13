import { useMemo } from "react";
import { X } from "lucide-react";
import { naira } from "../../utils/format.js";

/**
 * Filter sidebar. Reads the category's filterConfig and renders
 * only the filter groups that apply. State lives in the parent
 * Category page; this component is pure UI.
 *
 * Adding a new filter type = add a renderer in RENDERERS below
 * and reference its key in a category's filterConfig.
 */
export default function FilterSidebar({
  category,
  products,
  filters,
  setFilters,
  onClear,
  onClose, // mobile drawer dismiss
}) {
  const config = category?.filterConfig ?? ["brand", "price", "availability"];
  const counts = useFacetCounts(products);

  // Set / unset individual filter values
  const toggleArray = (key, value) =>
    setFilters((f) => {
      const set = new Set(f[key] || []);
      set.has(value) ? set.delete(value) : set.add(value);
      return { ...f, [key]: Array.from(set) };
    });

  const setValue = (key, value) =>
    setFilters((f) => ({ ...f, [key]: value }));

  const hasActive =
    (filters.brand?.length || 0) +
    (filters.hp?.length || 0) +
    (filters.inverter?.length || 0) +
    (filters.litres?.length || 0) +
    (filters.doors?.length || 0) +
    (filters.availability?.length || 0) +
    (filters.priceMin || filters.priceMax ? 1 : 0) >
    0;

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

      {config.map((key) => {
        const R = RENDERERS[key];
        if (!R) return null;
        return <R key={key} counts={counts} filters={filters} toggleArray={toggleArray} setValue={setValue} />;
      })}
    </aside>
  );
}

/* ---------- count facets from the *unfiltered* category list ---------- */
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
        const bucket = p.litres < 250 ? "Under 250L" : p.litres < 450 ? "250 \u2013 450L" : "Over 450L";
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
        ["250 \u2013 450L", counts.litres["250 \u2013 450L"] || 0],
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
          placeholder={"\u20A6 Min"}
          value={filters.priceMin || ""}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "");
            setValue("priceMin", v ? Number(v) : "");
          }}
        />
        <span>{"\u2014"}</span>
        <input
          type="text"
          inputMode="numeric"
          placeholder={"\u20A6 Max"}
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
};

const PRICE_PRESETS = [
  { label: `Under ${naira(150000)}`, min: "", max: 150000 },
  { label: `${naira(150000)} \u2013 ${naira(500000)}`, min: 150000, max: 500000 },
  { label: `${naira(500000)} \u2013 ${naira(1000000)}`, min: 500000, max: 1000000 },
  { label: `Above ${naira(1000000)}`, min: 1000000, max: "" },
];