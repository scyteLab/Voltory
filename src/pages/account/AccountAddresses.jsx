import { useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, Pencil, Phone, Plus, Star, StarOff, Trash2 } from "lucide-react";
import { useCustomerAuth } from "../../context/AuthContext.jsx";
import { useCustomerOrders } from "../../hooks/useCustomerOrders.js";
import { useCustomerAddresses } from "../../hooks/useCustomerAddresses.js";
import AddressFormModal from "../../components/account/AddressFormModal.jsx";

/**
 * Saved Addresses \u2014 the customer's address book.
 *
 * Two sections:
 *   1. Saved addresses \u2014 rows from customer_addresses. Full CRUD.
 *   2. Recently used \u2014 addresses derived from order history that
 *      aren't in the saved set. Each has a "Save to my addresses"
 *      button that promotes it into customer_addresses.
 *
 * This is the pattern Jumia and Amazon both use \u2014 explicit saved
 * addresses that you manage, with recent order addresses shown as
 * one-tap "save this" shortcuts.
 */
export default function AccountAddresses() {
  const { customer } = useCustomerAuth();
  const { addresses, loading: loadingSaved, create, update, makeDefault, remove } = useCustomerAddresses();
  const { orders: myOrders, loading: loadingOrders } = useCustomerOrders();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]     = useState(null);
  const [prefill, setPrefill]     = useState(null); // shape from "save this" click
  const [actionErr, setActionErr] = useState(null);
  const [busyId, setBusyId]       = useState(null);

  if (!customer) return null;

  const displayPhone = (customer.phone || "").startsWith("+234")
    ? "0" + customer.phone.slice(4)
    : (customer.phone || "");

  // Recently-used addresses from orders that AREN'T already in the saved set.
  const savedKey = (a) => `${a.street}|${a.lga}|${a.state}`.toLowerCase();
  const savedKeys = new Set(addresses.map(savedKey));
  const recentlyUsed = [];
  const seenRecent = new Set();
  for (const o of myOrders) {
    if (!o.address) continue;
    const k = savedKey(o.address);
    if (savedKeys.has(k) || seenRecent.has(k)) continue;
    seenRecent.add(k);
    recentlyUsed.push({ ...o.address, lastUsed: o.createdAt });
  }

  function openCreate() {
    setEditing(null);
    setPrefill(null);
    setModalOpen(true);
  }
  function openEdit(a) {
    setEditing(a);
    setPrefill(null);
    setModalOpen(true);
  }
  function openSaveFromOrder(addr) {
    setEditing(null);
    setPrefill(addr);
    setModalOpen(true);
  }
  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    setPrefill(null);
  }

  async function handleSubmit(input) {
    setActionErr(null);
    if (editing) return update(editing.id, input);
    return create(input);
  }

  async function handleDelete(a) {
    if (!window.confirm(`Delete "${a.label || a.street}"?`)) return;
    setBusyId(a.id);
    setActionErr(null);
    const res = await remove(a.id);
    setBusyId(null);
    if (!res.ok) setActionErr(res.error || "Delete failed");
  }

  async function handleSetDefault(a) {
    if (a.is_default) return;
    setBusyId(a.id);
    setActionErr(null);
    const res = await makeDefault(a.id);
    setBusyId(null);
    if (!res.ok) setActionErr(res.error || "Couldn't set default");
  }

  // Shape passed to the modal when the user clicks "save from recent"
  const modalAddress = editing || (prefill ? {
    label: "",
    name: customer.name || "",
    phone: displayPhone,
    state: prefill.state,
    lga: prefill.lga,
    street: prefill.street,
    landmark: prefill.landmark || "",
    is_default: addresses.length === 0, // first address becomes default automatically
  } : null);

  const loading = loadingSaved && loadingOrders;

  return (
    <div className="addr-list">
      <header className="ord-list__head addr-list__head">
        <div>
          <h1>Saved Addresses</h1>
          <p>
            {addresses.length === 0
              ? "Add addresses here so you don't have to type them again at checkout."
              : `${addresses.length} saved address${addresses.length === 1 ? "" : "es"}.`}
          </p>
        </div>
        <button type="button" className="btn-shop addr-list__add" onClick={openCreate}>
          <Plus size={14} /> Add new address
        </button>
      </header>

      {actionErr && <div className="hb__err" style={{ marginBottom: 12 }}>{actionErr}</div>}

      {loading && addresses.length === 0 && recentlyUsed.length === 0 ? (
        <div className="hb__loading" style={{ padding: 40 }}>Loading\u2026</div>
      ) : addresses.length === 0 && recentlyUsed.length === 0 ? (
        <div className="ord-empty">
          <MapPin size={48} strokeWidth={1.1} />
          <h2>No addresses yet</h2>
          <p>Add a delivery address here, or place an order and we'll save it automatically for next time.</p>
          <button type="button" className="btn-shop" onClick={openCreate}>
            <Plus size={14} /> Add your first address
          </button>
        </div>
      ) : (
        <>
          {addresses.length > 0 && (
            <ul className="addr-cards">
              {addresses.map((a) => (
                <li
                  key={a.id}
                  className={"addr-card" + (a.is_default ? " addr-card--default" : "")}
                >
                  {a.is_default && <span className="addr-card__default">Default</span>}
                  <MapPin size={18} className="addr-card__icon" />
                  <div className="addr-card__body">
                    {a.label && <span className="addr-card__label">{a.label}</span>}
                    <b>{a.name || customer.name}</b>
                    <p>
                      {a.street}<br />
                      {a.lga}, {a.state}
                      {a.landmark && <><br /><small>Landmark: {a.landmark}</small></>}
                    </p>
                    <small className="addr-card__phone">
                      <Phone size={11} /> <span className="mono">{a.phone || displayPhone}</span>
                    </small>
                  </div>

                  <div className="addr-card__actions">
                    {!a.is_default && (
                      <button
                        type="button"
                        className="addr-card__btn"
                        onClick={() => handleSetDefault(a)}
                        disabled={busyId === a.id}
                        title="Set as default"
                      >
                        <Star size={14} /> Default
                      </button>
                    )}
                    {a.is_default && (
                      <span className="addr-card__btn addr-card__btn--muted">
                        <StarOff size={14} /> Default
                      </span>
                    )}
                    <button
                      type="button"
                      className="addr-card__btn"
                      onClick={() => openEdit(a)}
                      title="Edit"
                    >
                      <Pencil size={14} /> Edit
                    </button>
                    <button
                      type="button"
                      className="addr-card__btn addr-card__btn--danger"
                      onClick={() => handleDelete(a)}
                      disabled={busyId === a.id}
                      title="Delete"
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {recentlyUsed.length > 0 && (
            <>
              <div className="addr-sec-head">
                <h2>Recently used at checkout</h2>
                <p>Addresses from your orders. Tap "Save" to keep them here for next time.</p>
              </div>
              <ul className="addr-cards">
                {recentlyUsed.map((a, i) => (
                  <li key={`${a.street}-${i}`} className="addr-card addr-card--recent">
                    <MapPin size={18} className="addr-card__icon" />
                    <div className="addr-card__body">
                      <b>{customer.name || "You"}</b>
                      <p>
                        {a.street}<br />
                        {a.lga}, {a.state}
                        {a.landmark && <><br /><small>Landmark: {a.landmark}</small></>}
                      </p>
                    </div>
                    <div className="addr-card__actions">
                      <button
                        type="button"
                        className="addr-card__btn addr-card__btn--primary"
                        onClick={() => openSaveFromOrder(a)}
                        title="Save this address"
                      >
                        <Plus size={14} /> Save
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      {modalOpen && (
        <AddressFormModal
          address={modalAddress}
          defaultName={customer.name || ""}
          defaultPhone={displayPhone}
          onClose={closeModal}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}