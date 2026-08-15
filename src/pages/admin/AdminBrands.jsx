import { useState } from "react";
import { Award, Pencil, Plus, Trash2 } from "lucide-react";
import { useAdminBrands } from "../../hooks/useAdminBrands.js";
import BrandFormModal from "../../components/admin/catalog/BrandFormModal.jsx";

/**
 * AdminBrands — /admin/catalog/brands
 *
 * Lists every brand with logo, name, slug, product count, and
 * Edit/Delete actions. Product count uses brand.name as the key
 * (since products link by name).
 */
export default function AdminBrands() {
  const { brands, counts, loading, error, create, update, remove } = useAdminBrands();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]     = useState(null);
  const [busy, setBusy]           = useState(null);
  const [deleteErr, setDeleteErr] = useState(null);

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }
  function openEdit(b) {
    setEditing(b);
    setModalOpen(true);
  }
  function closeModal() {
    setModalOpen(false);
    setEditing(null);
  }

  async function handleSubmit(input) {
    setDeleteErr(null);
    if (editing) return update(editing.id, input);
    return create(input);
  }

  async function handleDelete(brand) {
    const count = counts[brand.name] || 0;
    const msg = count > 0
      ? `"${brand.name}" has ${count} product${count === 1 ? "" : "s"} linked to it.\n\nDelete anyway? (Blocked — you'll get an error explaining why.)`
      : `Delete "${brand.name}"? This can't be undone.`;
    if (!window.confirm(msg)) return;

    setBusy(brand.id);
    setDeleteErr(null);
    const res = await remove(brand);
    setBusy(null);
    if (!res.ok) setDeleteErr(res.error || "Delete failed");
  }

  return (
    <div className="adm-page">
      <header className="adm-page__head">
        <div>
          <h1>Brands</h1>
          <p>Manage the brands available on NAVEN. Products link to brands by name, so brand names can't be renamed after creation.</p>
        </div>
        <button type="button" className="adm-btn adm-btn--primary" onClick={openCreate}>
          <Plus size={14} /> New brand
        </button>
      </header>

      {error && (
        <div className="hb__err">Couldn't load brands: {error}</div>
      )}
      {deleteErr && (
        <div className="hb__err">{deleteErr}</div>
      )}

      {loading && brands.length === 0 ? (
        <div className="hb__loading">Loading brands…</div>
      ) : brands.length === 0 ? (
        <div className="cat-empty">
          <Award size={40} strokeWidth={1.2} />
          <h2>No brands yet</h2>
          <p>Add the brands you distribute so products can be grouped by manufacturer.</p>
          <button type="button" className="adm-btn adm-btn--primary" onClick={openCreate}>
            <Plus size={14} /> New brand
          </button>
        </div>
      ) : (
        <ul className="cat-list">
          {brands.map((b) => (
            <li key={b.id} className="cat-row">
              <span className="brand-row__logo">
                {b.logo ? (
                  <img src={b.logo} alt={b.name} onError={(e) => { e.currentTarget.style.display = "none"; }} />
                ) : (
                  <Award size={20} />
                )}
              </span>
              <div className="cat-row__main">
                <div className="cat-row__title">
                  <b>{b.name}</b>
                </div>
                <div className="cat-row__meta">
                  <code>{b.id}</code>
                  <span className="cat-row__dot">·</span>
                  <span>{counts[b.name] || 0} product{(counts[b.name] || 0) === 1 ? "" : "s"}</span>
                </div>
              </div>
              <div className="cat-row__actions">
                <button
                  type="button"
                  className="hb-icbtn"
                  onClick={() => openEdit(b)}
                  title="Edit logo"
                >
                  <Pencil size={15} />
                </button>
                <button
                  type="button"
                  className="hb-icbtn hb-icbtn--danger"
                  onClick={() => handleDelete(b)}
                  disabled={busy === b.id}
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
        <BrandFormModal
          brand={editing}
          onClose={closeModal}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}