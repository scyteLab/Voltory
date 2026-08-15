import { MessageCircle } from "lucide-react";
import { useAdminWhatsappQuotes } from "../../hooks/useAdminWhatsappQuotes.js";
import QuoteRow from "../../components/whatsapp/QuoteRow.jsx";

/**
 * AdminWhatsappQuotes — /admin/whatsapp-quotes
 *
 * The rep's inbox. Status tabs, tap through to detail for edit.
 * Click count on each tab shows work outstanding.
 */
export default function AdminWhatsappQuotes() {
  const { status, setStatus, quotes, counts, loading, error } =
    useAdminWhatsappQuotes("new");

  const TABS = [
    { id: "new",       label: "New",        count: counts.new },
    { id: "contacted", label: "Contacted",  count: counts.contacted },
    { id: "confirmed", label: "Confirmed",  count: counts.confirmed },
    { id: "lost",      label: "Lost",       count: counts.lost },
    { id: "expired",   label: "Expired",    count: counts.expired },
    { id: "all",       label: "All",        count: counts.new + counts.contacted + counts.confirmed + counts.lost + counts.expired },
  ];

  return (
    <div className="adm-page">
      <header className="adm-page__head">
        <div>
          <h1>WhatsApp Quotes</h1>
          <p>
            Carts customers have sent to your sales line. Click a quote to
            edit items and prices before converting it to a real order.
          </p>
        </div>
      </header>

      <div className="revq-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={status === t.id}
            className={"revq-tab" + (status === t.id ? " revq-tab--on" : "")}
            onClick={() => setStatus(t.id)}
          >
            {t.label}
            {t.count > 0 && <span className="revq-tab__count">{t.count}</span>}
          </button>
        ))}
      </div>

      {error && <div className="hb__err">Couldn't load quotes: {error}</div>}

      {loading && quotes.length === 0 ? (
        <div className="hb__loading">Loading quotes…</div>
      ) : quotes.length === 0 ? (
        <div className="cat-empty">
          <MessageCircle size={40} strokeWidth={1.2} />
          <h2>
            {status === "new"       && "No new quotes"}
            {status === "contacted" && "No quotes in progress"}
            {status === "confirmed" && "No confirmed quotes yet"}
            {status === "lost"      && "No lost deals"}
            {status === "expired"   && "No expired quotes"}
            {status === "all"       && "No quotes yet"}
          </h2>
          <p>
            {status === "new"
              ? "When a customer sends their cart to WhatsApp, it appears here."
              : "Nothing to see in this bucket right now."}
          </p>
        </div>
      ) : (
        <ul className="waq-list">
          {quotes.map((q) => <QuoteRow key={q.id} quote={q} />)}
        </ul>
      )}
    </div>
  );
}