import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Check, ChevronRight, Copy, Loader2, MessageCircle,
  Minus, Phone, Plus, Save, Trash2, X,
} from "lucide-react";
import {
  fetchQuoteDetail, updateQuoteItem, removeQuoteItem, updateQuoteNotes,
  setQuoteStatus, convertQuoteToOrder,
} from "../../lib/whatsappQuotesAdmin.js";
import { naira } from "../../utils/format.js";

/**
 * AdminWhatsappQuoteDetail — /admin/whatsapp-quotes/:id
 *
 * The rep's working surface. Here they:
 *   · See who sent the quote and when
 *   · Open WhatsApp or call the customer
 *   · Adjust qty and price per line as they negotiate
 *   · Remove lines the customer changed their mind on
 *   · Add internal notes
 *   · Change status through the pipeline
 *   · Convert to a real order once the deal closes
 *
 * We DON'T add-new-item from here right now — rep can do that from
 * the order page after conversion. Keeps the surface focused.
 */
export default function AdminWhatsappQuoteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [quote, setQuote]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [busy, setBusy]       = useState(false);
  const [notes, setNotes]     = useState("");
  const [notesDirty, setNotesDirty] = useState(false);
  const [copied, setCopied]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetchQuoteDetail(id);
    setLoading(false);
    if (res.ok) {
      setQuote(res.quote);
      setNotes(res.quote.repNotes || "");
      setNotesDirty(false);
      setError(null);
    } else {
      setError(res.error);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function withBusy(fn) {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (!res?.ok) {
      setError(res?.error || "Something went wrong");
    } else {
      setError(null);
      load(); // refresh state after every mutation
    }
    return res;
  }

  async function handleQtyChange(itemId, delta, current) {
    const next = current + delta;
    if (next < 1) return;
    await withBusy(() => updateQuoteItem(id, itemId, { qty: next }));
  }

  async function handlePriceChange(itemId, newPrice) {
    const p = Number(newPrice);
    if (isNaN(p) || p < 0) return;
    await withBusy(() => updateQuoteItem(id, itemId, { unitPrice: p }));
  }

  async function handleRemove(itemId, name) {
    if (!window.confirm(`Remove "${name}" from this quote?`)) return;
    await withBusy(() => removeQuoteItem(id, itemId));
  }

  async function handleSaveNotes() {
    await withBusy(() => updateQuoteNotes(id, notes));
  }

  async function handleStatus(next) {
    await withBusy(() => setQuoteStatus(id, next));
  }

  async function handleConvert() {
    if (!window.confirm("Convert this quote to a real order? The customer's cart contents at their current prices become an order.")) return;
    setBusy(true);
    const res = await convertQuoteToOrder(id);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    if (res.warning) {
      alert(res.warning);
    }
    navigate(`/admin/orders/${res.orderId}`);
  }

  function copyRef() {
    if (!quote) return;
    navigator.clipboard?.writeText(quote.id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  if (loading && !quote) {
    return <div className="adm-page"><div className="hb__loading">Loading quote…</div></div>;
  }
  if (error && !quote) {
    return (
      <div className="adm-page">
        <div className="hb__err">Couldn't load quote: {error}</div>
        <Link to="/admin/whatsapp-quotes" className="adm-btn adm-btn--secondary">
          <ArrowLeft size={14} /> Back to queue
        </Link>
      </div>
    );
  }
  if (!quote) return null;

  const phoneDigits = (quote.customerPhone || "").replace(/\D+/g, "");
  const waUrl = phoneDigits
    ? `https://wa.me/${phoneDigits.startsWith("234") ? phoneDigits : "234" + phoneDigits.replace(/^0/, "")}`
    : null;

  const alreadyConverted = !!quote.linkedOrderId;

  return (
    <div className="adm-page waq-detail">
      <div className="waq-detail__crumbs">
        <Link to="/admin/whatsapp-quotes"><ArrowLeft size={14} /> Back to queue</Link>
      </div>

      <header className="waq-detail__head">
        <div>
          <div className="waq-detail__idbar">
            <span className="mono waq-detail__id">{quote.id}</span>
            <button type="button" className="waq-btn" onClick={copyRef} title="Copy quote reference">
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? " Copied" : " Copy ref"}
            </button>
            <span className={`revs__status revs__status--${statusClass(quote.status)}`}>
              {statusLabel(quote.status)}
            </span>
            {alreadyConverted && (
              <Link to={`/admin/orders/${quote.linkedOrderId}`} className="waq-detail__linked">
                Linked order: {quote.linkedOrderId} <ChevronRight size={12} />
              </Link>
            )}
          </div>
          <h1>{quote.customerName || "Unknown customer"}</h1>
          <p className="waq-detail__sub">
            Sent {new Date(quote.createdAt).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}
            {" · "}
            Subtotal: <b>{naira(quote.subtotal)}</b>
          </p>
        </div>

        <div className="waq-detail__contacts">
          {waUrl && (
            <a href={waUrl} target="_blank" rel="noreferrer" className="adm-btn adm-btn--secondary">
              <MessageCircle size={14} /> WhatsApp
            </a>
          )}
          {quote.customerPhone && (
            <a href={`tel:${quote.customerPhone}`} className="adm-btn adm-btn--secondary">
              <Phone size={14} /> {quote.customerPhone}
            </a>
          )}
        </div>
      </header>

      {error && <div className="hb__err">{error}</div>}

      {/* Items */}
      <section className="waq-detail__section">
        <h2>Items ({quote.items.length})</h2>
        {quote.items.length === 0 ? (
          <div className="cat-empty" style={{ padding: 24 }}>
            <p>All items were removed from this quote.</p>
          </div>
        ) : (
          <ul className="waq-items">
            {quote.items.map((it) => (
              <li key={it.id} className="waq-item">
                {it.image && <img src={it.image} alt="" className="waq-item__img" />}
                <div className="waq-item__body">
                  <b>{it.productName}</b>
                  <small className="mono">{it.sku}</small>
                </div>

                <div className="waq-item__qty">
                  <button
                    type="button"
                    onClick={() => handleQtyChange(it.id, -1, it.qty)}
                    disabled={busy || alreadyConverted || it.qty <= 1}
                    className="waq-qty-btn"
                    aria-label="Decrease quantity"
                  >
                    <Minus size={12} />
                  </button>
                  <span className="waq-item__qtynum">{it.qty}</span>
                  <button
                    type="button"
                    onClick={() => handleQtyChange(it.id, +1, it.qty)}
                    disabled={busy || alreadyConverted}
                    className="waq-qty-btn"
                    aria-label="Increase quantity"
                  >
                    <Plus size={12} />
                  </button>
                </div>

                <div className="waq-item__price">
                  <label>Unit price</label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    defaultValue={it.unitPrice}
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (v !== it.unitPrice) handlePriceChange(it.id, v);
                    }}
                    disabled={busy || alreadyConverted}
                    className="hb-input waq-item__priceinput"
                  />
                </div>

                <div className="waq-item__line">
                  <label>Line total</label>
                  <b>{naira(it.lineTotal)}</b>
                </div>

                {!alreadyConverted && (
                  <button
                    type="button"
                    className="waq-btn waq-btn--danger"
                    onClick={() => handleRemove(it.id, it.productName)}
                    disabled={busy}
                    title="Remove item"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="waq-detail__totals">
          <span>Subtotal</span>
          <b>{naira(quote.subtotal)}</b>
        </div>
      </section>

      {/* Notes */}
      <section className="waq-detail__section">
        <h2>Internal notes</h2>
        <textarea
          className="hb-input"
          rows={4}
          value={notes}
          onChange={(e) => { setNotes(e.target.value); setNotesDirty(true); }}
          disabled={busy}
          placeholder="Anything worth remembering — discount offered, delivery preference, timing, etc."
        />
        {notesDirty && (
          <div style={{ marginTop: 8 }}>
            <button
              type="button"
              className="adm-btn adm-btn--secondary"
              onClick={handleSaveNotes}
              disabled={busy}
            >
              <Save size={14} /> Save notes
            </button>
          </div>
        )}
      </section>

      {/* Status + convert */}
      <section className="waq-detail__section waq-detail__actions">
        <h2>Status</h2>
        <div className="waq-status-grid">
          {[
            { s: "new",       label: "Move to New" },
            { s: "contacted", label: "Mark as Contacted" },
            { s: "lost",      label: "Mark as Lost" },
            { s: "expired",   label: "Mark as Expired" },
          ].map(({ s, label }) => (
            <button
              key={s}
              type="button"
              className={"adm-btn adm-btn--secondary" + (quote.status === s ? " adm-btn--on" : "")}
              onClick={() => handleStatus(s)}
              disabled={busy || quote.status === s || alreadyConverted}
            >
              {quote.status === s && <Check size={14} />} {label}
            </button>
          ))}
        </div>

        <div className="waq-convert">
          {alreadyConverted ? (
            <p className="waq-convert__done">
              <Check size={16} /> Already converted to order{" "}
              <Link to={`/admin/orders/${quote.linkedOrderId}`}>{quote.linkedOrderId}</Link>
            </p>
          ) : (
            <>
              <button
                type="button"
                className="adm-btn adm-btn--primary waq-convert__btn"
                onClick={handleConvert}
                disabled={busy || quote.items.length === 0}
              >
                {busy ? <Loader2 size={14} className="waq-spin" /> : <ChevronRight size={14} />}
                Convert to Order
              </button>
              <p className="waq-convert__note">
                Copies items and prices to a new order. The customer's delivery
                address is added later on the orders page.
              </p>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function statusClass(s) {
  if (s === "new" || s === "contacted") return "pending";
  if (s === "confirmed") return "approved";
  return "rejected";
}
function statusLabel(s) {
  return ({
    new: "New",
    contacted: "Contacted",
    confirmed: "Confirmed",
    lost: "Lost",
    expired: "Expired",
  })[s] || s;
}