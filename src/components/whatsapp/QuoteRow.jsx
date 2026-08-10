import { Link } from "react-router-dom";
import { Clock, ExternalLink, MessageCircle, Phone } from "lucide-react";
import { naira } from "../../utils/format.js";

/**
 * QuoteRow \u2014 one card in the WhatsApp quotes queue.
 * Compact list format, click through to detail for edits.
 */
export default function QuoteRow({ quote }) {
  const dateStr = new Date(quote.createdAt).toLocaleString("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  // Build a wa.me URL for the rep to open a chat with this customer
  const phoneDigits = (quote.customerPhone || "").replace(/\D+/g, "");
  const waUrl = phoneDigits
    ? `https://wa.me/${phoneDigits.startsWith("234") ? phoneDigits : "234" + phoneDigits.replace(/^0/, "")}`
    : null;

  return (
    <li className={"waq-row waq-row--" + quote.status}>
      <Link to={`/admin/whatsapp-quotes/${quote.id}`} className="waq-row__main">
        <div className="waq-row__lead">
          <span className="mono waq-row__id">{quote.id}</span>
          <span className={`revs__status revs__status--${statusClass(quote.status)}`}>
            {statusLabel(quote.status)}
          </span>
        </div>

        <div className="waq-row__body">
          <b>{quote.customerName || "Unknown customer"}</b>
          <span className="mono waq-row__phone">{quote.customerPhone || "\u2014"}</span>
        </div>

        <div className="waq-row__meta">
          <span className="waq-row__amt"><b>{naira(quote.subtotal)}</b></span>
          <span className="waq-row__date"><Clock size={11} /> {dateStr}</span>
          {quote.linkedOrderId && (
            <span className="waq-row__linked">\u2192 {quote.linkedOrderId}</span>
          )}
        </div>
      </Link>

      <div className="waq-row__actions">
        {waUrl && (
          <a
            href={waUrl}
            target="_blank"
            rel="noreferrer"
            className="waq-btn waq-btn--wa"
            title="Open WhatsApp with customer"
            onClick={(e) => e.stopPropagation()}
          >
            <MessageCircle size={13} />
          </a>
        )}
        {quote.customerPhone && (
          <a
            href={`tel:${quote.customerPhone}`}
            className="waq-btn"
            title="Call customer"
            onClick={(e) => e.stopPropagation()}
          >
            <Phone size={13} />
          </a>
        )}
        <Link
          to={`/admin/whatsapp-quotes/${quote.id}`}
          className="waq-btn"
          title="Open quote"
        >
          <ExternalLink size={13} />
        </Link>
      </div>
    </li>
  );
}

// Reuse the revs__status--pending/approved/rejected pill palette
// by mapping our statuses onto its 3-slot color scheme.
function statusClass(s) {
  if (s === "new")         return "pending";
  if (s === "contacted")   return "pending";
  if (s === "confirmed")   return "approved";
  if (s === "lost")        return "rejected";
  if (s === "expired")     return "rejected";
  return "pending";
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