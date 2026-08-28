import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  AlertCircle, ArrowLeft, Download, Home as HomeIcon,
  Printer, Receipt as ReceiptIcon, Search,
} from "lucide-react";
import { fetchOrderByIdAndPhone } from "../lib/customerOrdersClient.js";
import { getOrder } from "../utils/orders.js";
import { SITE } from "../config/site.js";
import ReceiptTemplate from "../components/receipt/ReceiptTemplate.jsx";
import { downloadReceiptAsPdf } from "../lib/receiptPdf.js";

/**
 * Receipt \u2014 /receipt/:id
 *
 * Public page. Shows an official receipt for a given order.
 * Two access patterns:
 *   1. Customer who just placed the order \u2014 the order is in
 *      their localStorage from checkout, no verification needed
 *      on the same device
 *   2. Customer opening the receipt on a different device or
 *      later visit \u2014 must enter phone to prove ownership
 *
 * Deep-link support:
 *   /receipt/VLT-...?phone=0803...  \u2014 auto-loads
 *
 * Actions:
 *   \u00B7 Print (browser print dialog)
 *   \u00B7 Download PDF (one-click, html2canvas + jsPDF snapshot)
 */
export default function Receipt() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const queryPhone = searchParams.get("phone") || "";

  const [order, setOrder]         = useState(() => getOrder(id));
  const [phoneInput, setPhoneInput] = useState(queryPhone);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [attempted, setAttempted] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const prev = document.title;
    document.title = `Receipt ${id} \u2014 ${SITE.name}`;
    return () => { document.title = prev; };
  }, [id]);

  useEffect(() => {
    if (order || !queryPhone) return;
    doLookup(queryPhone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function doLookup(phone) {
    setLoading(true);
    setError(null);
    setAttempted(true);
    const res = await fetchOrderByIdAndPhone({ orderId: id, phone });
    setLoading(false);
    if (res.order) {
      setOrder(res.order);
    } else {
      setError(res.error || "We couldn't find that receipt.");
    }
  }

  function handlePhoneSubmit(e) {
    e.preventDefault();
    if (!phoneInput.trim()) {
      setError("Please enter the phone number used at checkout.");
      return;
    }
    doLookup(phoneInput.trim());
  }

  function handlePrint() {
    window.print();
  }

  async function handleDownloadPdf() {
    const receiptEl = document.querySelector(".receipt");
    if (!receiptEl) return;

    setDownloading(true);
    const res = await downloadReceiptAsPdf(receiptEl, `receipt-${id}`);
    setDownloading(false);

    if (!res.ok) {
      /* Surface the failure so the customer knows what happened */
      alert(res.error || "Couldn't generate PDF. Try Print \u2192 Save as PDF instead.");
    }
  }

  /* ---- Not found / phone challenge state ---- */
  if (!order) {
    return (
      <main className="wrap receipt-page">
        <nav className="crumb no-print" aria-label="Breadcrumb">
          <Link to="/"><HomeIcon size={13} /> Home</Link>
        </nav>

        <div className="receipt-challenge no-print">
          <span className="receipt-challenge__icon">
            <ReceiptIcon size={28} />
          </span>
          <h1>View receipt {id}</h1>
          <p>
            To protect your privacy, please confirm the phone number used
            when placing this order.
          </p>

          <form onSubmit={handlePhoneSubmit}>
            <label className="field">
              <span className="field__label">Phone Number</span>
              <span className="auth-input">
                <input
                  type="tel"
                  inputMode="numeric"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  placeholder="0803 123 4567"
                  autoComplete="tel"
                  disabled={loading}
                />
              </span>
            </label>

            {error && attempted && (
              <div className="receipt-challenge__error">
                <AlertCircle size={16} /> {error}
              </div>
            )}

            <button type="submit" className="auth-submit" disabled={loading || !phoneInput.trim()}>
              <Search size={16} />
              {loading ? "Looking up\u2026" : "View Receipt"}
            </button>
          </form>

          <p className="receipt-challenge__help">
            Can't find your order details?{" "}
            <a href={SITE.whatsappLink} target="_blank" rel="noreferrer">
              Message us on WhatsApp
            </a>
          </p>
        </div>
      </main>
    );
  }

  /* ---- Receipt loaded ---- */
  return (
    <main className="wrap receipt-page">
      <div className="receipt-actions no-print">
        <Link to={`/order/${id}`} className="receipt-actions__back">
          <ArrowLeft size={14} /> Back to order
        </Link>
        <div className="receipt-actions__group">
          <button
            className="receipt-actions__btn"
            onClick={handleDownloadPdf}
            disabled={downloading}
          >
            <Download size={14} />
            {downloading ? "Generating\u2026" : "Download PDF"}
          </button>
          <button className="receipt-actions__btn receipt-actions__btn--primary" onClick={handlePrint}>
            <Printer size={14} /> Print
          </button>
        </div>
      </div>

      <ReceiptTemplate order={order} />

      <p className="receipt-tip no-print">
        <b>Tip:</b> Save the PDF to your device or forward it to your accountant.
        The Print button also lets you save as PDF via your browser's print dialog.
      </p>
    </main>
  );
}