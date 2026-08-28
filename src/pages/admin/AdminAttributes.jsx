import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle, Edit3, Eye, EyeOff, Filter, Plus, RefreshCw,
  Search, Sliders, Trash2,
} from "lucide-react";
import { fetchAllAttributes, deleteAttribute, ATTRIBUTE_TYPES } from "../../lib/attributesClient.js";

/**
 * AdminAttributes — /admin/attributes
 *
 * Lists all attribute definitions with search + type filter.
 * Each row shows name, slug, type, unit (if any), value count,
 * category count, and flags for filterable / visible.
 *
 * Delete requires confirm. Cascades to attribute_values and
 * category_attributes rows automatically (via FK ON DELETE
 * CASCADE) — but products keep any assigned values in Session 2
 * because that table doesn't exist yet.
 */
export default function AdminAttributes() {
  const [attributes, setAttributes] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [search, setSearch]         = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [deleting, setDeleting]     = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    const res = await fetchAllAttributes();
    setLoading(false);
    if (!res.ok) { setError(res.error); return; }
    setAttributes(res.data);
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return attributes.filter((a) => {
      if (typeFilter !== "all" && a.type !== typeFilter) return false;
      if (!q) return true;
      return (
        (a.name || "").toLowerCase().includes(q) ||
        (a.slug || "").toLowerCase().includes(q) ||
        (a.description || "").toLowerCase().includes(q)
      );
    });
  }, [attributes, search, typeFilter]);

  async function confirmDelete(id) {
    const res = await deleteAttribute(id);
    if (!res.ok) {
      alert(res.error);
      return;
    }
    setDeleting(null);
    load();
  }

  return (
    <div className="adm-page adm-attributes">
      <header className="adm-page__head">
        <div>
          <h1>
            <Sliders size={22} style={{ verticalAlign: "middle", marginRight: 8 }} />
            Attributes
          </h1>
          <p>
            Structured product properties like Color, Capacity, and Energy Rating.
            Define them once, apply to categories, use them for filters and product-page specs.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="adm-btn adm-btn--secondary" onClick={load} disabled={loading}>
            <RefreshCw size={13} /> Refresh
          </button>
          <Link to="/admin/attributes/new" className="adm-btn adm-btn--primary">
            <Plus size={13} /> New Attribute
          </Link>
        </div>
      </header>

      {/* Filters */}
      <div className="adm-attributes__filters">
        <div className="adm-attributes__search">
          <Search size={14} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, slug, or description…"
          />
        </div>
        <div className="adm-attributes__filter">
          <Filter size={13} />
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">All types</option>
            {ATTRIBUTE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="adm-empty adm-empty--err">
          <AlertCircle size={22} />
          <b>Failed to load attributes.</b>
          <p>{error}</p>
          <button className="adm-btn adm-btn--secondary" onClick={load}>
            <RefreshCw size={13} /> Retry
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && !error && (
        <div className="adm-empty"><p>Loading attributes…</p></div>
      )}

      {/* Empty — no attributes at all */}
      {!loading && !error && attributes.length === 0 && (
        <div className="adm-empty">
          <Sliders size={32} strokeWidth={1.4} />
          <b>No attributes yet.</b>
          <p>
            Start by creating attributes like <em>Color</em>, <em>Screen Size</em>,
            or <em>Capacity</em>. These become structured product properties and,
            in Session 3, filter options on category pages.
          </p>
          <Link to="/admin/attributes/new" className="adm-btn adm-btn--primary">
            <Plus size={13} /> Create your first attribute
          </Link>
        </div>
      )}

      {/* Empty — filters matched none */}
      {!loading && !error && attributes.length > 0 && filtered.length === 0 && (
        <div className="adm-empty">
          <Search size={32} strokeWidth={1.4} />
          <b>No attributes match your filters.</b>
          <p>Try clearing the search or changing the type filter.</p>
        </div>
      )}

      {/* Table */}
      {!loading && !error && filtered.length > 0 && (
        <div className="adm-attributes__tblwrap">
          <table className="adm-attributes__tbl">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Unit</th>
                <th className="right">Values</th>
                <th className="right">Categories</th>
                <th>Flags</th>
                <th className="adm-attributes__col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id}>
                  <td>
                    <div className="adm-attributes__nameblock">
                      <b>{a.name}</b>
                      <small className="mono">{a.slug}</small>
                    </div>
                  </td>
                  <td>
                    <span className={`adm-attributes__type adm-attributes__type--${a.type}`}>
                      {typeLabel(a.type)}
                    </span>
                  </td>
                  <td>{a.unit || <span className="adm-mut">—</span>}</td>
                  <td className="right">
                    {a.value_count > 0
                      ? <b>{a.value_count}</b>
                      : <span className="adm-mut">—</span>
                    }
                  </td>
                  <td className="right">
                    {a.category_count > 0
                      ? <b>{a.category_count}</b>
                      : <span className="adm-mut">All</span>
                    }
                  </td>
                  <td>
                    <div className="adm-attributes__flags">
                      <span className={"adm-attributes__flag " + (a.is_filterable ? "on" : "off")} title={a.is_filterable ? "Filterable on category pages" : "Not filterable"}>
                        <Filter size={11} />
                      </span>
                      <span className={"adm-attributes__flag " + (a.is_visible ? "on" : "off")} title={a.is_visible ? "Visible on product page" : "Hidden from product page"}>
                        {a.is_visible ? <Eye size={11} /> : <EyeOff size={11} />}
                      </span>
                    </div>
                  </td>
                  <td className="adm-attributes__col-actions">
                    <Link
                      to={`/admin/attributes/${a.id}`}
                      className="adm-btn adm-btn--secondary adm-btn--sm"
                    >
                      <Edit3 size={12} /> Edit
                    </Link>
                    {deleting === a.id ? (
                      <>
                        <button
                          className="adm-btn adm-btn--danger adm-btn--sm"
                          onClick={() => confirmDelete(a.id)}
                        >
                          Confirm
                        </button>
                        <button
                          className="adm-btn adm-btn--ghost adm-btn--sm"
                          onClick={() => setDeleting(null)}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        className="adm-btn adm-btn--ghost-danger adm-btn--sm"
                        onClick={() => setDeleting(a.id)}
                        title="Delete attribute (removes it from all products)"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function typeLabel(t) {
  return ATTRIBUTE_TYPES.find((x) => x.value === t)?.label || t;
}