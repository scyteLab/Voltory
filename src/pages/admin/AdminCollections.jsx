import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle, Edit3, Eye, EyeOff, LayoutGrid, Plus, RefreshCw,
  Search, Trash2,
} from "lucide-react";
import {
  fetchAllCollections, deleteCollection,
} from "../../lib/collectionsClient.js";

/**
 * AdminCollections — /admin/collections
 *
 * Lists all collections (active + inactive) with search, filter,
 * and quick actions. Each row shows the banner thumbnail (if
 * present), name, slug, product count, and active status.
 *
 * Delete requires confirmation — collections can't be recovered
 * (though their products aren't affected, just the grouping).
 */
export default function AdminCollections() {
  const [collections, setCollections] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [search, setSearch]           = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deleting, setDeleting]       = useState(null); // id being confirmed for delete

  async function load() {
    setLoading(true);
    setError(null);
    const res = await fetchAllCollections();
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setCollections(res.data);
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return collections.filter((c) => {
      if (statusFilter === "active" && !c.is_active) return false;
      if (statusFilter === "inactive" && c.is_active) return false;
      if (!q) return true;
      return (
        (c.name || "").toLowerCase().includes(q) ||
        (c.slug || "").toLowerCase().includes(q)
      );
    });
  }, [collections, search, statusFilter]);

  async function confirmDelete(id) {
    const res = await deleteCollection(id);
    if (!res.ok) {
      alert(res.error);
      return;
    }
    setDeleting(null);
    load();
  }

  return (
    <div className="adm-page adm-collections">
      <header className="adm-page__head">
        <div>
          <h1>
            <LayoutGrid size={22} style={{ verticalAlign: "middle", marginRight: 8 }} />
            Collections
          </h1>
          <p>
            Curated cross-category product groupings for marketing campaigns —
            Ramadan Deals, New Arrivals, Weekend Specials.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="adm-btn adm-btn--secondary" onClick={load} disabled={loading}>
            <RefreshCw size={13} /> Refresh
          </button>
          <Link to="/admin/collections/new" className="adm-btn adm-btn--primary">
            <Plus size={13} /> New Collection
          </Link>
        </div>
      </header>

      {/* Filters */}
      <div className="adm-collections__filters">
        <div className="adm-collections__search">
          <Search size={14} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or slug…"
          />
        </div>
        <div className="adm-collections__status">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All statuses</option>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
          </select>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="adm-empty adm-empty--err">
          <AlertCircle size={22} />
          <b>Failed to load collections.</b>
          <p>{error}</p>
          <button className="adm-btn adm-btn--secondary" onClick={load}>
            <RefreshCw size={13} /> Retry
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && !error && (
        <div className="adm-empty">
          <p>Loading collections…</p>
        </div>
      )}

      {/* Empty state — no collections at all yet */}
      {!loading && !error && collections.length === 0 && (
        <div className="adm-empty">
          <LayoutGrid size={32} strokeWidth={1.4} />
          <b>No collections yet.</b>
          <p>Create your first collection to group products for marketing campaigns.</p>
          <Link to="/admin/collections/new" className="adm-btn adm-btn--primary">
            <Plus size={13} /> Create your first collection
          </Link>
        </div>
      )}

      {/* Empty state — filters matched nothing */}
      {!loading && !error && collections.length > 0 && filtered.length === 0 && (
        <div className="adm-empty">
          <Search size={32} strokeWidth={1.4} />
          <b>No collections match your filters.</b>
          <p>Try clearing the search or changing the status filter.</p>
        </div>
      )}

      {/* Grid of collection cards */}
      {!loading && !error && filtered.length > 0 && (
        <div className="adm-collections__grid">
          {filtered.map((c) => (
            <article key={c.id} className={"adm-collection-card" + (c.is_active ? "" : " adm-collection-card--inactive")}>
              <div className="adm-collection-card__banner">
                {c.banner_image
                  ? <img src={c.banner_image} alt="" />
                  : <div className="adm-collection-card__banner-placeholder"><LayoutGrid size={28} /></div>
                }
                <span className={"adm-collection-card__status " + (c.is_active ? "on" : "off")}>
                  {c.is_active ? <Eye size={11} /> : <EyeOff size={11} />}
                  {c.is_active ? "Active" : "Inactive"}
                </span>
              </div>

              <div className="adm-collection-card__body">
                <h3>{c.name}</h3>
                <p className="adm-collection-card__slug mono">/collection/{c.slug}</p>
                {c.description && (
                  <p className="adm-collection-card__desc">{c.description}</p>
                )}
                <p className="adm-collection-card__count">
                  <b>{c.product_count}</b> product{c.product_count === 1 ? "" : "s"}
                </p>
              </div>

              <div className="adm-collection-card__actions">
                <Link
                  to={`/admin/collections/${c.id}`}
                  className="adm-btn adm-btn--secondary adm-btn--sm"
                >
                  <Edit3 size={12} /> Edit
                </Link>
                {c.is_active && (
                  <a
                    href={`/collection/${c.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="adm-btn adm-btn--ghost adm-btn--sm"
                    title="View live"
                  >
                    <Eye size={12} /> View
                  </a>
                )}
                {deleting === c.id ? (
                  <>
                    <button
                      className="adm-btn adm-btn--danger adm-btn--sm"
                      onClick={() => confirmDelete(c.id)}
                    >
                      Confirm delete
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
                    onClick={() => setDeleting(c.id)}
                    title="Delete collection (products are unaffected)"
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}