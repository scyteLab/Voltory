import { QRCodeSVG } from "qrcode.react";
import Logo from "../layout/Logo.jsx";
import { BUSINESS_INFO, legalNameWithReg, registrationDisplay } from "../../config/businessInfo.js";
import {
  computeReceiptTotals, documentNumber, formatVatRate, isGiftLine, receiptStatus,
} from "../../lib/receiptCalculator.js";
import { amountInWords } from "../../utils/amountInWords.js";
import { naira } from "../../utils/format.js";

/**
 * ReceiptTemplate — the one receipt layout (A4).
 *
 * Used by /receipt/:id (customer), /admin/receipts/:id (admin), the
 * browser print view and the PDF download (lib/receiptPdf.js snapshots
 * this DOM). Presentational only; parents fetch the order.
 *
 * Title by receiptStatus():
 *   paid      → OFFICIAL RECEIPT
 *   pending   → PROFORMA INVOICE (+ "This is not a receipt" note)
 *   cancelled → CANCELLED diagonal watermark
 *
 * Business identity comes from config/businessInfo.js. TIN and VAT
 * lines appear only when tin is set / vatRegistered is true.
 *
 * PDF pagination: elements marked data-pdf-block (and every items-table
 * row) are places where the PDF may start a new page; the table header
 * is repeated on continuation pages.
 */

const PAYMENT_METHODS = {
  card:     "Card (Paystack)",
  transfer: "Bank transfer (Paystack)",
  ussd:     "USSD (Paystack)",
  pod:      "Pay on Delivery",
  paystack: "Paystack",
};

const lagosDateTime = new Intl.DateTimeFormat("en-NG", {
  timeZone: "Africa/Lagos", day: "numeric", month: "short", year: "numeric",
  hour: "2-digit", minute: "2-digit",
});

function paymentStatusLabel(order, status) {
  const s = String(order.status || "").toLowerCase();
  if (s === "refunded") return "Refunded";
  if (s === "cancelled") return "Cancelled";
  if (status === "paid") return "Paid";
  const method = order.payment?.method || order.payment;
  return method === "pod" ? "Due on delivery" : "Awaiting payment";
}

export default function ReceiptTemplate({ order }) {
  if (!order) return null;

  const totals = computeReceiptTotals(order);
  const status = receiptStatus(order);
  const method = order.payment?.method || order.payment;
  const address = order.address || {};
  const contact = order.contact || {};
  const receiptUrl = `${BUSINESS_INFO.websiteUrl}/receipt/${encodeURIComponent(order.id)}`;
  const title = status === "pending" ? "PROFORMA INVOICE" : status === "cancelled" ? "RECEIPT — CANCELLED" : "OFFICIAL RECEIPT";
  const addressLines = [
    address.street,
    address.area,
    [address.lga, address.state].filter(Boolean).join(", "),
  ].filter(Boolean);

  return (
    <article className={`receipt receipt--${status}`}>
      {status === "cancelled" && (
        <div className="receipt__watermark" aria-hidden="true">CANCELLED</div>
      )}

      <div className="receipt__bar" aria-hidden="true" />

      {/* ---- Header: logo | business identity ---- */}
      <div className="receipt__head" data-pdf-block>
        <Logo variant="lockup" className="receipt__logo" ariaLabel="NAVEN — The Premium Electronics" />
        <div className="receipt__biz">
          <b className="receipt__legalname">{BUSINESS_INFO.legalName}</b>
          <span>{registrationDisplay}</span>
          <span>{BUSINESS_INFO.address}</span>
          <span>{BUSINESS_INFO.phone} · {BUSINESS_INFO.email} · {BUSINESS_INFO.website}</span>
          {BUSINESS_INFO.tin && <span>TIN: {BUSINESS_INFO.tin}</span>}
        </div>
      </div>

      {/* ---- Title ---- */}
      <div className="receipt__titlebar" data-pdf-block>
        <h1 className="receipt__title">{title}</h1>
        {status === "pending" && (
          <p className="receipt__notice">
            This is not a receipt. A receipt is issued once payment is received.
          </p>
        )}
      </div>

      {/* ---- Details | Bill to | Deliver to ---- */}
      <div className="receipt__grid" data-pdf-block>
        <section className="receipt__box">
          <h2>{status === "pending" ? "Invoice details" : "Receipt details"}</h2>
          <dl className="receipt__kv">
            <dt>{status === "pending" ? "Invoice No." : "Receipt No."}</dt>
            <dd className="receipt__mono">{documentNumber(order, status)}</dd>
            <dt>Order ID</dt>
            <dd className="receipt__mono">{order.id}</dd>
            <dt>Date &amp; time</dt>
            <dd>{order.createdAt ? lagosDateTime.format(new Date(order.createdAt)) : "—"} (Lagos)</dd>
            <dt>Payment method</dt>
            <dd>{PAYMENT_METHODS[method] || method || "—"}</dd>
            <dt>Payment status</dt>
            <dd><b>{paymentStatusLabel(order, status)}</b></dd>
            {order.paystackRef && (
              <>
                <dt>Paystack ref.</dt>
                <dd className="receipt__mono receipt__wrap">{order.paystackRef}</dd>
              </>
            )}
          </dl>
        </section>

        <section className="receipt__box">
          <h2>Bill to</h2>
          <p className="receipt__lines">
            <b>{contact.name || "—"}</b>
            {contact.phone && <span>{contact.phone}</span>}
            {contact.email && <span className="receipt__wrap">{contact.email}</span>}
          </p>
        </section>

        <section className="receipt__box">
          <h2>Deliver to</h2>
          <p className="receipt__lines">
            {addressLines.length ? addressLines.map((l) => <span key={l}>{l}</span>) : <span>—</span>}
            {address.landmark && <span className="receipt__muted">Landmark: {address.landmark}</span>}
          </p>
        </section>
      </div>

      {/* ---- Items ---- */}
      <table className="receipt__items">
        <thead>
          <tr>
            <th className="receipt__c-num">#</th>
            <th className="receipt__c-prod">Product</th>
            <th className="receipt__c-qty">Qty</th>
            <th className="receipt__c-amt">Unit price</th>
            <th className="receipt__c-amt">Amount</th>
          </tr>
        </thead>
        <tbody>
          {(order.items || []).map((it, i) => {
            const gift = isGiftLine(it);
            return (
              <tr key={`${it.sku}-${i}`}>
                <td className="receipt__c-num">{i + 1}</td>
                <td className="receipt__c-prod">
                  {gift ? (
                    <span className="receipt__pname">Free gift: {it.giftDescription || it.name}</span>
                  ) : (
                    <>
                      <span className="receipt__pname">{it.name}</span>
                      <span className="receipt__sku">SKU {it.sku}</span>
                    </>
                  )}
                </td>
                <td className="receipt__c-qty">{it.qty}</td>
                <td className="receipt__c-amt">{naira(gift ? 0 : it.price)}</td>
                <td className="receipt__c-amt">{naira(gift ? 0 : it.price * it.qty)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* ---- Totals ---- */}
      <div className="receipt__summary" data-pdf-block>
        <dl className="receipt__totals">
          <dt>Subtotal</dt>
          <dd>{naira(totals.subtotalIncVat)}</dd>
          {totals.discount > 0 && (
            <>
              <dt>Discount</dt>
              <dd>− {naira(totals.discount)}</dd>
            </>
          )}
          <dt>Delivery</dt>
          <dd>{totals.deliveryFee > 0 ? naira(totals.deliveryFee) : "Free"}</dd>
          {totals.installationFee > 0 && (
            <>
              <dt>Installation</dt>
              <dd>{naira(totals.installationFee)}</dd>
            </>
          )}
          <dt className="receipt__grand">TOTAL</dt>
          <dd className="receipt__grand">{naira(totals.grandTotal)}</dd>
          {totals.vatRegistered && (
            <>
              <dt className="receipt__vat">VAT ({formatVatRate(totals.vatRate)}) included</dt>
              <dd className="receipt__vat">{naira(totals.vatAmount)}</dd>
              <dt className="receipt__vat">Amount excluding VAT</dt>
              <dd className="receipt__vat">{naira(totals.totalExVat)}</dd>
            </>
          )}
        </dl>
        <p className="receipt__words">
          <span>Amount in words</span>
          {amountInWords(totals.grandTotal)}
        </p>
      </div>

      {/* ---- Footer ---- */}
      <div className="receipt__foot" data-pdf-block>
        <div className="receipt__foot-text">
          <p className="receipt__thanks">Thank you for shopping with NAVEN.</p>
          <p>Products are covered by the manufacturer&apos;s warranty. Keep this receipt for warranty claims.</p>
          <p>Returns within 7 days, subject to our returns policy: mynaven.com/returns</p>
          <p>
            Support: {BUSINESS_INFO.phone} (call / WhatsApp) · {BUSINESS_INFO.email} · {BUSINESS_INFO.website}
          </p>
          <p className="receipt__muted">Computer-generated document; no signature required.</p>
        </div>
        <div className="receipt__qr">
          <QRCodeSVG value={receiptUrl} size={76} level="M" fgColor="#0F172A" bgColor="#FFFFFF" />
          <span>Scan to verify online</span>
        </div>
      </div>

      <p className="receipt__bottom">
        {legalNameWithReg} · {BUSINESS_INFO.taglinePrimary}
      </p>
    </article>
  );
}
