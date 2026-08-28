import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  AlertCircle, ArrowLeft, Copy, Download, Mail, Printer,
  RefreshCw,
} from "lucide-react";
import { supabase, supabaseConfigured } from "../../lib/supabaseClient.js";
import ReceiptTemplate from "../../components/receipt/ReceiptTemplate.jsx";
import { downloadReceiptAsPdf } from "../../lib/receiptPdf.js";

/**
 * AdminReceiptDetail \u2014 /admin/receipts/:id
 *
 * Admin view of a single receipt. Uses the same ReceiptTemplate
 * that the customer sees, so what you print here is exactly what
 * the customer gets.
 *
 * Actions:
 *   \u00B7 Print (browser print dialog)
 *   \u00B7 Download PDF (one-click via html2canvas + jsPDF)
 *   \u00B7 Copy customer share link (URL customer can use to view
 *     their own receipt \u2014 auto-includes their phone)
 *   \u00B7 Email receipt (Phase 2 \u2014 currently disabled)
 *
 * URL query params:
 *   ?print=1  \u2014 open print dialog immediately on load
 */
export default function AdminReceiptDetail() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const autoPrint = searchParams.get("print") === "1";

  const [order, setOrder]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [copied, setCopied]   = useState(false);
  const [downloading, setDownloading] = useState(false);

  async function loadOrder() {
    if (!supabaseConfigured) {
      setError("Supabase not configured.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const { data, error: err } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("id", id)
        .maybeSingle();

      if (err) throw err;
      if (!data) {
        setError("Receipt not found.");
        return;
      }
      setOrder(toStorefrontShape(data));
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!autoPrint || !order) return;
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, [autoPrint, order]);

  function handlePrint() { window.print(); }

  function handleCopyShareLink() {
    if (!order) return;
    const url = `${window.location.origin}/receipt/${order.id}?phone=${encodeURIComponent(order.contact.phone)}`;
    navigator.clipboard.writeText(url).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => {}
    );
  }

  async function handleDownloadPdf() {
    const receiptEl = document.querySelector(".receipt");
    if (!receiptEl) return;

    setDownloading(true);
    const res = await downloadReceiptAsPdf(receiptEl, `receipt-${id}`);
    setDownloading(false);

    if (!res.ok) {
      alert(res.error || "Couldn't generate PDF. Try Print \u2192 Save as PDF instead.");
    }
  }

  if (loading) {
    return (
      <div className="adm-page">
        <div className="adm-empty">Loading receipt\u2026</div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="adm-page">
        <div className="adm-empty adm-empty--err">
          <AlertCircle size={22} />
          <b>Couldn't load receipt.</b>
          <p>{error || "Receipt not found."}</p>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="adm-btn adm-btn--secondary" onClick={loadOrder}>
              <RefreshCw size={13} /> Retry
            </button>
            <Link to="/admin/receipts" className="adm-btn adm-btn--secondary">
              <ArrowLeft size={13} /> Back to list
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="adm-page adm-receipt-detail">
      <div className="adm-receipt-detail__toolbar no-print">
        <Link to="/admin/receipts" className="adm-receipt-detail__back">
          <ArrowLeft size={14} /> Back to receipts
        </Link>
        <div className="adm-receipt-detail__actions">
          <button
            className="adm-btn adm-btn--secondary"
            onClick={handleCopyShareLink}
            title="Copy a link the customer can use to view this receipt"
          >
            <Copy size={13} /> {copied ? "Copied!" : "Copy customer link"}
          </button>
          <button
            className="adm-btn adm-btn--secondary"
            disabled
            title="Email delivery coming in Phase 2"
          >
            <Mail size={13} /> Email (soon)
          </button>
          <button
            className="adm-btn adm-btn--secondary"
            onClick={handleDownloadPdf}
            disabled={downloading}
          >
            <Download size={13} />
            {downloading ? "Generating\u2026" : "Download PDF"}
          </button>
          <button className="adm-btn adm-btn--primary" onClick={handlePrint}>
            <Printer size={13} /> Print
          </button>
        </div>
      </div>

      <ReceiptTemplate order={order} />
    </div>
  );
}

/**
 * Adapt Supabase orders row \u2192 storefront order shape.
 */
function toStorefrontShape(row) {
  if (!row) return null;
  const items = Array.isArray(row.order_items) ? row.order_items : [];
  return {
    id: row.id,
    createdAt: row.created_at,
    status: row.status,
    items: items.map((i) => ({
      sku: i.sku,
      qty: i.qty,
      price: i.unit_price,
      name: i.product_name,
      image: i.image || null,
    })),
    contact: {
      name:  row.customer_name  || "",
      phone: row.customer_phone || "",
      email: row.customer_email || "",
    },
    address: row.address || {},
    payment: { method: row.payment_method },
    totals: {
      subtotal:        row.subtotal || 0,
      discount:        row.discount || 0,
      deliveryFee:     row.delivery_fee || 0,
      installationFee: row.installation_fee || 0,
      grand:           row.total || 0,
    },
    vat_amount:      row.vat_amount,
    subtotal_ex_vat: row.subtotal_ex_vat,
    vat_rate:        row.vat_rate,
  };
}