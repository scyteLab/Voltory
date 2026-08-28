import { BUSINESS_INFO, formatBusinessAddress } from "../../config/businessInfo.js";
import { computeReceiptTotals, formatVatRate, receiptStatus } from "../../lib/receiptCalculator.js";
import { naira } from "../../utils/format.js";
import { Gift } from "lucide-react";

/**
 * ReceiptTemplate
 *
 * Renders a single order as an official-looking receipt.
 * Used by:
 *   · /receipt/:id (customer-facing, printable)
 *   · /admin/receipts/:id (admin viewing)
 *   · email templates (Phase 2 — same HTML embedded)
 *
 * Session 3 (2026-08-28) added:
 *   · Gift rows detected by item.isGift flag
 *   · Gift SKU replaced with "FREE GIFT" badge (the actual
 *     internal SKU is ugly — "gift:<uuid>" — and never useful
 *     to a customer)
 *   · Gift prices display as "FREE" instead of "₦0"
 *   · VAT calculations unchanged — gifts contribute ₦0
 *     via computeReceiptTotals, so they naturally exclude from VAT
 *
 * Layout has three regions styled for both screen AND print:
 *   1. Header — business identity + receipt number/date
 *   2. Body   — customer + items + totals
 *   3. Footer — legal notice, contact, thank-you
 *
 * The component is intentionally presentational only. Data
 * fetching happens in parent pages. That keeps this reusable
 * across every context.
 */
export default function ReceiptTemplate({ order }) {
  if (!order) return null;

  const totals = computeReceiptTotals(order);
  const status = receiptStatus(order);
  const created = new Date(order.createdAt);

  return (
    <article className={`receipt receipt--${status}`}>
      {/* ---- Status stamp (only for cancelled/refunded) ---- */}
      {status === "cancelled" && (
        <div className="receipt__stamp receipt__stamp--cancelled">
          CANCELLED
        </div>
      )}

      {/* ============================================
           HEADER
           ============================================ */}
      <header className="receipt__head">
        <div className="receipt__brand">
          <h1 className="receipt__brandname">{BUSINESS_INFO.brandName}</h1>
          <p className="receipt__legalname">{BUSINESS_INFO.legalName}</p>
          <address className="receipt__address">
            {formatBusinessAddress().split("\n").map((line, i) => (
              <span key={i}>{line}</span>
            ))}
          </address>
          <p className="receipt__contact">
            {BUSINESS_INFO.phone} · {BUSINESS_INFO.supportEmail}
          </p>
          <p className="receipt__legalids">
            <span>RC: <b>{BUSINESS_INFO.rcNumber}</b></span>
            {BUSINESS_INFO.vatRegistered && (
              <span>TIN: <b>{BUSINESS_INFO.tin}</b></span>
            )}
          </p>
        </div>

        <div className="receipt__meta">
          <span className="receipt__type">
            {status === "paid" ? "OFFICIAL RECEIPT" : status === "cancelled" ? "RECEIPT (CANCELLED)" : "PROFORMA"}
          </span>
          <dl>
            <div>
              <dt>Receipt No.</dt>
              <dd className="mono">{order.id}</dd>
            </div>
            <div>
              <dt>Issued</dt>
              <dd>{created.toLocaleDateString("en-NG", {
                day: "numeric", month: "short", year: "numeric",
              })}</dd>
            </div>
            <div>
              <dt>Time</dt>
              <dd>{created.toLocaleTimeString("en-NG", {
                hour: "2-digit", minute: "2-digit",
              })}</dd>
            </div>
          </dl>
        </div>
      </header>

      {/* ============================================
           CUSTOMER
           ============================================ */}
      <section className="receipt__section receipt__customer">
        <h2>Bill To</h2>
        <div className="receipt__customer-grid">
          <div>
            <b>{order.contact.name}</b>
            <span>{order.contact.phone}</span>
            {order.contact.email && <span>{order.contact.email}</span>}
          </div>
          <div>
            <b>Delivery Address</b>
            {order.address.street && <span>{order.address.street}</span>}
            {order.address.lga && (
              <span>{order.address.lga}, {order.address.state}</span>
            )}
            {order.address.landmark && (
              <span className="receipt__muted">Landmark: {order.address.landmark}</span>
            )}
          </div>
        </div>
      </section>

      {/* ============================================
           ITEMS
           ============================================ */}
      <section className="receipt__section receipt__items">
        <table>
          <thead>
            <tr>
              <th className="receipt__col-desc">Description</th>
              <th className="receipt__col-sku">SKU</th>
              <th className="receipt__col-qty">Qty</th>
              <th className="receipt__col-price">Unit Price</th>
              <th className="receipt__col-line">Line Total</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((it) => {
              /* Gift row — hide ugly SKU, show FREE badge instead */
              if (it.isGift) {
                return (
                  <tr key={it.sku} className="receipt__row--gift">
                    <td>
                      <span className="receipt__gift-badge">
                        <Gift size={11} /> FREE GIFT
                      </span>
                      {" "}
                      {it.giftDescription || it.name}
                    </td>
                    <td className="receipt__gift-sku">—</td>
                    <td className="receipt__col-qty">{it.qty}</td>
                    <td className="receipt__col-price">FREE</td>
                    <td className="receipt__col-line">FREE</td>
                  </tr>
                );
              }
              /* Paid row — unchanged from before */
              return (
                <tr key={it.sku}>
                  <td>{it.name}</td>
                  <td className="mono">{it.sku}</td>
                  <td className="receipt__col-qty">{it.qty}</td>
                  <td className="receipt__col-price">{naira(it.price)}</td>
                  <td className="receipt__col-line">{naira(it.price * it.qty)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* ============================================
           TOTALS  —  with VAT breakdown
           ============================================ */}
      <section className="receipt__section receipt__totals">
        <dl>
          <div>
            <dt>Subtotal (excl. VAT)</dt>
            <dd>{naira(totals.subtotalExVat)}</dd>
          </div>
          <div>
            <dt>VAT ({formatVatRate(totals.vatRate)})</dt>
            <dd>{naira(totals.vatAmount)}</dd>
          </div>
          <div className="receipt__totals-sub">
            <dt>Subtotal (incl. VAT)</dt>
            <dd>{naira(totals.subtotalIncVat)}</dd>
          </div>
          {totals.discount > 0 && (
            <div className="receipt__totals-discount">
              <dt>Discount</dt>
              <dd>− {naira(totals.discount)}</dd>
            </div>
          )}
          <div>
            <dt>Delivery</dt>
            <dd>{totals.deliveryFee === 0 ? "FREE" : naira(totals.deliveryFee)}</dd>
          </div>
          {totals.installationFee > 0 && (
            <div>
              <dt>Installation</dt>
              <dd>{naira(totals.installationFee)}</dd>
            </div>
          )}
          <div className="receipt__totals-grand">
            <dt>Total {status === "paid" ? "Paid" : "Due"}</dt>
            <dd>{naira(totals.grandTotal)}</dd>
          </div>
        </dl>
      </section>

      {/* ============================================
           PAYMENT
           ============================================ */}
      <section className="receipt__section receipt__payment">
        <div className="receipt__payment-info">
          <b>Payment Method</b>
          <span>{formatPaymentMethod(order.payment?.method || order.payment)}</span>
        </div>
        {status === "paid" && (
          <div className="receipt__paid-stamp">PAID</div>
        )}
      </section>

      {/* ============================================
           FOOTER
           ============================================ */}
      <footer className="receipt__foot">
        <p className="receipt__thanks">
          Thank you for shopping with {BUSINESS_INFO.brandName}.
        </p>
        <p className="receipt__legal">
          This is a computer-generated receipt. No signature required.
          {BUSINESS_INFO.vatRegistered && (
            <> VAT reflected at {formatVatRate(totals.vatRate)} in accordance with Nigerian VAT regulations.</>
          )}
        </p>
        <p className="receipt__support">
          Questions about this receipt? Contact us on {BUSINESS_INFO.whatsapp} or{" "}
          {BUSINESS_INFO.supportEmail}.
        </p>
      </footer>
    </article>
  );
}

function formatPaymentMethod(method) {
  const m = String(method || "").toLowerCase();
  return ({
    card:     "Card Payment",
    transfer: "Bank Transfer",
    pod:      "Pay on Delivery",
    ussd:     "USSD Transfer",
    paystack: "Paystack",
  })[m] || (method || "—");
}