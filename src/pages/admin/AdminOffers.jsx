import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle, CheckCircle2, Clock, Gift, Pause, Play,
  Plus, Search, Trash2,
} from "lucide-react";
import { useCatalog } from "../../context/CatalogContext.jsx";
import { useAdmin } from "../../context/AdminContext.jsx";
import { usePermission } from "../../lib/permissions.js";
import { adminToast } from "../../lib/adminToast.js";

/**
 * AdminOffers — list all promotional offers.
 *
 * Matches the AdminCollections pattern exactly:
 *   · Header with New button
 *   · Filter bar with search + active/expired filter
 *   · Grid of cards (offer per card)
 *   · Delete confirmation modal
 *   · Toast notifications via adminToast
 *   · Permission-gated destructive actions
 *
 * Card shows:
 *   · Product image + name
 *   · Offer title + gift description
 *   · Multiply-by-qty badge if applicable
 *   · Days remaining (or "Expired" if past ends_at)
 *   · Active/paused toggle
 *   · Edit + Delete actions
 */
export default function AdminOffers() {
  const { productOffers, removeOffer, setOfferActive, loading } = useCatalog();
  const { session } = useAdmin();
  const canManage = usePermission("catalog.offers.manage");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all | active | paused | expired
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const now = Date.now();
    const q = search.trim().toLowerCase();

    return (productOffers || []).filter((offer) => {
      /* Status filter */
      const isExpired = new Date(offer.ends_at).getTime() < now;
      if (statusFilter === "active"  && (!offer.is_active || isExpired)) return false;
      if (statusFilter === "paused"  && offer.is_active) return false;
      if (statusFilter === "expired" && !isExpired) return false;

      /* Search filter */
      if (q) {
        const haystack = [
          offer.title,
          offer.gift_description,
          offer.product_sku,
          offer.product?.name,
          offer.product?.brand,
        ].filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [productOffers, search, statusFilter]);

  async function onToggleActive(offer) {
    if (!canManage) {
      adminToast.error("You don't have permission to modify offers.");
      return;
    }
    setBusy(true);
    try {
      await setOfferActive(offer.id, !offer.is_active);
      adminToast.success(offer.is_active ? "Offer paused" : "Offer resumed");
    } catch (err) {
      adminToast.error(err.message || "Failed to update offer.");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!deleteConfirm) return;
    if (!canManage) {
      adminToast.error("You don't have permission to delete offers.");
      return;
    }
    setBusy(true);
    try {
      await removeOffer(deleteConfirm.id);
      adminToast.success("Offer deleted.");
      setDeleteConfirm(null);
    } catch (err) {
      adminToast.error(err.message || "Failed to delete offer.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="adm-page">
      <header className="adm-page__head">
        <div>
          <h1><Gift size={22} /> Promotional Offers</h1>
          <p>Buy-X-get-Y-free offers attached to products. Auto-shown on product pages and the deals page.</p>
        </div>
        <div className="adm-page__head-actions">
          {canManage && (
            <Link to="/admin/offers/new" className="adm-btn adm-btn--primary">
              <Plus size={14} /> New Offer
            </Link>
          )}
        </div>
      </header>

      <div className="adm-filter-bar">
        <div className="adm-filter-bar__search">
          <Search size={14} />
          <input
            type="text"
            placeholder="Search by product, title, or gift…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="adm-filter-bar__filters">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All offers</option>
            <option value="active">Active only</option>
            <option value="paused">Paused</option>
            <option value="expired">Expired</option>
          </select>
        </div>
      </div>

      {loading && (
        <div className="adm-list-empty">Loading offers…</div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="adm-list-empty">
          <Gift size={40} strokeWidth={1.2} />
          <b>
            {productOffers.length === 0
              ? "No offers yet"
              : "No offers match your filters"}
          </b>
          <p>
            {productOffers.length === 0
              ? "Create your first promotional offer to start bundling gifts with products."
              : "Try a different search term or filter."}
          </p>
          {productOffers.length === 0 && canManage && (
            <Link to="/admin/offers/new" className="adm-btn adm-btn--primary">
              <Plus size={14} /> Create first offer
            </Link>
          )}
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="adm-offers-grid">
          {filtered.map((offer) => (
            <OfferCard
              key={offer.id}
              offer={offer}
              canManage={canManage}
              busy={busy}
              onToggleActive={onToggleActive}
              onDelete={() => setDeleteConfirm(offer)}
            />
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="adm-modal-backdrop" onClick={() => !busy && setDeleteConfirm(null)}>
          <div className="adm-modal" onClick={(e) => e.stopPropagation()}>
            <header className="adm-modal__head">
              <h3><AlertTriangle size={16} /> Delete this offer?</h3>
            </header>
            <div className="adm-modal__body">
              <p>
                You're about to delete the offer:
                {" "}<b>"{deleteConfirm.title}"</b>
                {" "}attached to <b>{deleteConfirm.product?.name || deleteConfirm.product_sku}</b>.
              </p>
              <p>This action can't be undone. The gift image (if uploaded) will also be removed.</p>
            </div>
            <footer className="adm-modal__foot">
              <button
                type="button"
                className="adm-btn adm-btn--secondary"
                onClick={() => setDeleteConfirm(null)}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="adm-btn adm-btn--danger"
                onClick={onDelete}
                disabled={busy}
              >
                <Trash2 size={13} /> {busy ? "Deleting…" : "Delete offer"}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Offer card
   ============================================================ */

function OfferCard({ offer, canManage, busy, onToggleActive, onDelete }) {
  const now = Date.now();
  const endsAt = new Date(offer.ends_at).getTime();
  const isExpired = endsAt < now;
  const daysRemaining = Math.max(0, Math.ceil((endsAt - now) / (1000 * 60 * 60 * 24)));

  const statusLabel = isExpired
    ? "Expired"
    : offer.is_active
      ? "Active"
      : "Paused";

  const statusClass = isExpired
    ? "adm-offers-card__status--expired"
    : offer.is_active
      ? "adm-offers-card__status--active"
      : "adm-offers-card__status--paused";

  return (
    <div className={"adm-offers-card" + (isExpired ? " adm-offers-card--dim" : "")}>
      {/* Header: product info */}
      <div className="adm-offers-card__product">
        {offer.product?.image ? (
          <img src={offer.product.image} alt={offer.product.name} loading="lazy" />
        ) : (
          <div className="adm-offers-card__product-noimg">No image</div>
        )}
        <div className="adm-offers-card__product-info">
          <b>{offer.product?.name || offer.product_sku}</b>
          <small>{offer.product?.brand} · {offer.product_sku}</small>
        </div>
      </div>

      {/* Body: offer details */}
      <div className="adm-offers-card__body">
        <h3 className="adm-offers-card__title">{offer.title}</h3>

        <div className="adm-offers-card__gift">
          <Gift size={14} />
          <span>{offer.gift_description}</span>
        </div>

        {offer.gift_image && (
          <img
            src={offer.gift_image}
            alt="Gift"
            className="adm-offers-card__gift-img"
            loading="lazy"
          />
        )}

        <div className="adm-offers-card__meta">
          {offer.multiply_by_qty && (
            <span className="adm-offers-card__badge">× Multiplies with qty</span>
          )}
          <span className={"adm-offers-card__status " + statusClass}>
            {statusLabel}
          </span>
        </div>

        <div className="adm-offers-card__timer">
          <Clock size={12} />
          {isExpired
            ? <span>Ended {formatDate(offer.ends_at)}</span>
            : <span>{daysRemaining} day{daysRemaining === 1 ? "" : "s"} remaining</span>
          }
        </div>
      </div>

      {/* Actions */}
      <div className="adm-offers-card__actions">
        <Link
          to={`/admin/offers/${offer.id}`}
          className="adm-btn adm-btn--secondary adm-btn--sm"
        >
          Edit
        </Link>
        {canManage && !isExpired && (
          <button
            type="button"
            className="adm-btn adm-btn--secondary adm-btn--sm"
            onClick={() => onToggleActive(offer)}
            disabled={busy}
            title={offer.is_active ? "Pause this offer" : "Resume this offer"}
          >
            {offer.is_active ? <><Pause size={12} /> Pause</> : <><Play size={12} /> Resume</>}
          </button>
        )}
        {canManage && (
          <button
            type="button"
            className="adm-btn adm-btn--ghost-danger adm-btn--sm"
            onClick={onDelete}
            disabled={busy}
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString("en-NG", {
      year: "numeric", month: "short", day: "numeric",
    });
  } catch {
    return iso;
  }
}