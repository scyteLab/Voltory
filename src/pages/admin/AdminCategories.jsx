import { useState } from "react";
import { Flame, Package, Pencil, Plus, Trash2 } from "lucide-react";
import { useAdminCategories } from "../../hooks/useAdminCategories.js";
import Icon from "../../components/ui/Icon.jsx";
import CategoryFormModal from "../../components/admin/catalog/CategoryFormModal.jsx";

/**
 * AdminCategories — /admin/catalog/categories
 *
 * List every category, plus Add, Edit and Delete buttons. Each row
 * shows the icon, label, slug, blurb, "Hot" badge if set, and the
 * count of products currently in that category.
 *
 * Delete is guarded twice — native confirm on the button, plus the
 * DB-level FK constraint so we can never orphan products.
 */
export default function AdminCategories() {
  const { categories, counts, loading, error, create, update, remove } = useAdminCategories();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(null); // id currently being deleted
  const [deleteErr, setDeleteErr] = useState(null);

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }
  function openEdit(cat) {
    setEditing(cat);
    setModalOpen(true);
  }
  function closeModal() {
    setModalOpen(false);
    setEditing(null);
  }

  async function handleSubmit(input) {
    setDeleteErr(null);
    if (editing) {
      return update(editing.id, input);
    }
    return create(input);
  }

  async function handleDelete(cat) {
    const count = counts[cat.id] || 0;
    const msg = count > 0
      ? `"${cat.label}" has ${count} product${count === 1 ? "" : "s"} linked to it.\n\nDelete anyway? (It won't actually delete if products remain — that's blocked by the database.)`
      : `Delete "${cat.label}"? This can't be undone.`;
    if (!window.confirm(msg)) return;

    setBusy(cat.id);
    setDeleteErr(null);
    const res = await remove(cat.id);
    setBusy(null);
    if (!res.ok) setDeleteErr(res.error || "Delete failed");
  }

  return (
    <div className="adm-page">
      <header className="adm-page__head">
        <div>
          <h1>Categories</h1>
          <p>Manage the categories shown in the sidebar and on category pages. Slugs become URLs like <code>/category/refrigerators-freezers</code>.</p>
        </div>
        <button type="button" className="adm-btn adm-btn--primary" onClick={openCreate}>
          <Plus size={14} /> New category
        </button>
      </header>

      {error && (
        <div className="hb__err">
          Couldn't load categories: {error}
        </div>
      )}
      {deleteErr && (
        <div className="hb__err">{deleteErr}</div>
      )}

      {loading && categories.length === 0 ? (
        <div className="hb__loading">Loading categories…</div>
      ) : categories.length === 0 ? (
        <div className="cat-empty">
          <Package size={40} strokeWidth={1.2} />
          <h2>No categories yet</h2>
          <p>Create your first category to organise the catalog.</p>
          <button type="button" className="adm-btn adm-btn--primary" onClick={openCreate}>
            <Plus size={14} /> New category
          </button>
        </div>
      ) : (
        <ul className="cat-list">
          {categories.map((c) => (
            <li key={c.id} className="cat-row">
              <span className="cat-row__icon"><Icon name={c.icon || "Package"} size={20} /></span>
              <div className="cat-row__main">
                <div className="cat-row__title">
                  <b>{c.label}</b>
                  {c.hot && <span className="cat-row__hot"><Flame size={11} /> Hot</span>}
                </div>
                <div className="cat-row__meta">
                  <code>{c.id}</code>
                  <span className="cat-row__dot">·</span>
                  <span>{counts[c.id] || 0} product{(counts[c.id] || 0) === 1 ? "" : "s"}</span>
                  {c.blurb && <>
                    <span className="cat-row__dot">·</span>
                    <span className="cat-row__blurb">{c.blurb}</span>
                  </>}
                </div>
              </div>
              <div className="cat-row__actions">
                <button
                  type="button"
                  className="hb-icbtn"
                  onClick={() => openEdit(c)}
                  title="Edit"
                >
                  <Pencil size={15} />
                </button>
                <button
                  type="button"
                  className="hb-icbtn hb-icbtn--danger"
                  onClick={() => handleDelete(c)}
                  disabled={busy === c.id}
                  title="Delete"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {modalOpen && (
        <CategoryFormModal
          category={editing}
          onClose={closeModal}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}