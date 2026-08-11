import { SITE } from "../config/site.js";
import { naira } from "../utils/format.js";

/**
 * Email HTML templates.
 *
 * Emails must use INLINE styles \u2014 many email clients (Gmail, Outlook,
 * Apple Mail) strip <style> blocks or handle them inconsistently.
 * Layout uses tables because that's what actually works in Outlook.
 *
 * Keep templates small and safe. If a value is missing, show a
 * sensible fallback rather than "undefined".
 */

const BRAND_COLOR    = "#2563eb"; // matches --p in the app
const BRAND_INK      = "#0f172a";
const BRAND_MUT      = "#64748b";
const BRAND_LINE     = "#e2e8f0";
const BRAND_BG       = "#f8fafc";

/* ============================================================
   Shared shell \u2014 header + footer
   ============================================================ */

function shell({ title, body, preheader = "" }) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND_BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${BRAND_INK};">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(preheader)}</div>` : ""}
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:${BRAND_BG};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,0.08);">
          <tr>
            <td style="background:${BRAND_COLOR};padding:24px;text-align:center;">
              <span style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">${escapeHtml(SITE.name || "Voltory")}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 28px;">
              ${body}
            </td>
          </tr>
          <tr>
            <td style="background:${BRAND_BG};padding:20px 28px;text-align:center;border-top:1px solid ${BRAND_LINE};font-size:12px;color:${BRAND_MUT};">
              <p style="margin:0 0 6px;">${escapeHtml(SITE.name || "Voltory")} \u2014 Nigerian appliance ecommerce</p>
              <p style="margin:0;">Questions? WhatsApp us at <a href="${SITE.whatsappLink || "#"}" style="color:${BRAND_COLOR};text-decoration:none;">${escapeHtml(SITE.whatsapp || "")}</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/* ============================================================
   Items table \u2014 shared between customer + admin emails
   ============================================================ */

function itemsTable(items) {
  const rows = (items || []).map((i) => `
    <tr>
      <td style="padding:10px 8px;border-bottom:1px solid ${BRAND_LINE};font-size:14px;">
        <b>${escapeHtml(i.name || i.sku)}</b>
        <br><span style="color:${BRAND_MUT};font-size:12px;">${escapeHtml(i.sku)}</span>
      </td>
      <td style="padding:10px 8px;border-bottom:1px solid ${BRAND_LINE};font-size:14px;text-align:center;">
        ${i.qty}
      </td>
      <td style="padding:10px 8px;border-bottom:1px solid ${BRAND_LINE};font-size:14px;text-align:right;">
        ${escapeHtml(naira((i.price || 0) * (i.qty || 1)))}
      </td>
    </tr>
  `).join("");

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:16px 0;border-collapse:collapse;">
      <thead>
        <tr>
          <th align="left"   style="padding:10px 8px;background:${BRAND_BG};font-size:12px;color:${BRAND_MUT};text-transform:uppercase;letter-spacing:0.03em;border-bottom:1px solid ${BRAND_LINE};">Product</th>
          <th align="center" style="padding:10px 8px;background:${BRAND_BG};font-size:12px;color:${BRAND_MUT};text-transform:uppercase;letter-spacing:0.03em;border-bottom:1px solid ${BRAND_LINE};">Qty</th>
          <th align="right"  style="padding:10px 8px;background:${BRAND_BG};font-size:12px;color:${BRAND_MUT};text-transform:uppercase;letter-spacing:0.03em;border-bottom:1px solid ${BRAND_LINE};">Amount</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function totalsBlock(totals) {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top:16px;">
      <tr>
        <td style="padding:6px 8px;font-size:13px;color:${BRAND_MUT};">Subtotal</td>
        <td style="padding:6px 8px;font-size:13px;text-align:right;">${escapeHtml(naira(totals?.subtotal || 0))}</td>
      </tr>
      ${totals?.discount ? `
      <tr>
        <td style="padding:6px 8px;font-size:13px;color:${BRAND_MUT};">Discount</td>
        <td style="padding:6px 8px;font-size:13px;text-align:right;color:#dc2626;">\u2212${escapeHtml(naira(totals.discount))}</td>
      </tr>
      ` : ""}
      <tr>
        <td style="padding:6px 8px;font-size:13px;color:${BRAND_MUT};">Delivery</td>
        <td style="padding:6px 8px;font-size:13px;text-align:right;">${totals?.deliveryFee ? escapeHtml(naira(totals.deliveryFee)) : "FREE"}</td>
      </tr>
      ${totals?.installationFee ? `
      <tr>
        <td style="padding:6px 8px;font-size:13px;color:${BRAND_MUT};">Installation</td>
        <td style="padding:6px 8px;font-size:13px;text-align:right;">${escapeHtml(naira(totals.installationFee))}</td>
      </tr>
      ` : ""}
      <tr>
        <td style="padding:12px 8px 6px;font-size:16px;font-weight:800;border-top:2px solid ${BRAND_LINE};">Total</td>
        <td style="padding:12px 8px 6px;font-size:16px;font-weight:800;text-align:right;border-top:2px solid ${BRAND_LINE};color:${BRAND_COLOR};">${escapeHtml(naira(totals?.grand || 0))}</td>
      </tr>
    </table>
  `;
}

/* ============================================================
   TEMPLATE 1 \u2014 order confirmation (to customer)
   ============================================================ */

export function orderConfirmationEmail(order) {
  const name = order.contact?.name || order.account?.name || "there";
  const orderId = order.id;
  const orderUrl = `${(SITE.appUrl || "https://voltory.ng")}/order/${orderId}`;
  const address = order.address || {};
  const addressLine = [address.street, address.lga, address.state].filter(Boolean).join(", ") || "\u2014";

  const paymentLabel = ({
    card: "Card payment",
    transfer: "Bank transfer",
    ussd: "USSD",
    pod: "Pay on Delivery",
  })[order.payment] || "Payment received";

  const paidStatus = order.paymentStatus === "paid"
    ? `<span style="color:#047857;font-weight:700;">Paid</span>`
    : `<span style="color:#b45309;font-weight:700;">Awaiting payment</span>`;

  const body = `
    <h1 style="margin:0 0 8px;font-size:24px;color:${BRAND_INK};">Thank you, ${escapeHtml(name)}!</h1>
    <p style="margin:0 0 16px;font-size:15px;color:${BRAND_MUT};line-height:1.5;">
      Your order has been received. We'll be in touch shortly to confirm delivery details.
    </p>

    <div style="margin:20px 0;padding:16px;background:${BRAND_BG};border-radius:8px;border-left:4px solid ${BRAND_COLOR};">
      <p style="margin:0 0 4px;font-size:12px;color:${BRAND_MUT};text-transform:uppercase;letter-spacing:0.03em;">Order reference</p>
      <p style="margin:0;font-size:16px;font-weight:800;font-family:ui-monospace,monospace;">${escapeHtml(orderId)}</p>
    </div>

    ${itemsTable(order.items)}
    ${totalsBlock(order.totals)}

    <h3 style="margin:24px 0 8px;font-size:15px;color:${BRAND_INK};">Delivery to</h3>
    <p style="margin:0 0 4px;font-size:14px;color:${BRAND_INK};">${escapeHtml(order.contact?.name || "")}</p>
    <p style="margin:0 0 4px;font-size:13px;color:${BRAND_MUT};">${escapeHtml(order.contact?.phone || "")}</p>
    <p style="margin:0 0 4px;font-size:13px;color:${BRAND_MUT};">${escapeHtml(addressLine)}</p>
    ${address.landmark ? `<p style="margin:0;font-size:12px;color:${BRAND_MUT};font-style:italic;">Landmark: ${escapeHtml(address.landmark)}</p>` : ""}

    <h3 style="margin:24px 0 8px;font-size:15px;color:${BRAND_INK};">Payment</h3>
    <p style="margin:0 0 4px;font-size:14px;color:${BRAND_INK};">${escapeHtml(paymentLabel)} \u00B7 ${paidStatus}</p>
    ${order.paystackRef ? `<p style="margin:0;font-size:12px;color:${BRAND_MUT};font-family:ui-monospace,monospace;">Ref: ${escapeHtml(order.paystackRef)}</p>` : ""}

    <div style="margin:32px 0 8px;text-align:center;">
      <a href="${orderUrl}" style="display:inline-block;padding:12px 28px;background:${BRAND_COLOR};color:#ffffff;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px;">Track your order</a>
    </div>

    <p style="margin:24px 0 0;font-size:13px;color:${BRAND_MUT};line-height:1.5;text-align:center;">
      Need help? Reply to this email or WhatsApp us anytime.
    </p>
  `;

  return {
    subject: `Order ${orderId} confirmed \u2014 ${SITE.name || "Voltory"}`,
    html: shell({
      title: `Order ${orderId} confirmed`,
      preheader: `Thank you ${name}, we've received your order.`,
      body,
    }),
  };
}

/* ============================================================
   TEMPLATE 2 \u2014 admin notification (new order)
   ============================================================ */

export function adminOrderNotificationEmail(order) {
  const orderId = order.id;
  const orderAdminUrl = `${(SITE.appUrl || "https://voltory.ng")}/admin/orders/${orderId}`;
  const address = order.address || {};
  const addressLine = [address.street, address.lga, address.state].filter(Boolean).join(", ") || "\u2014";

  const paidLabel = order.paymentStatus === "paid"
    ? `<span style="color:#047857;font-weight:700;">\u2705 PAID</span>`
    : `<span style="color:#b45309;font-weight:700;">\u23F3 Awaiting payment</span>`;

  const body = `
    <h1 style="margin:0 0 8px;font-size:22px;color:${BRAND_INK};">New order \u2014 ${escapeHtml(naira(order.totals?.grand || 0))}</h1>
    <p style="margin:0 0 16px;font-size:14px;color:${BRAND_MUT};">
      ${paidLabel} \u00B7 ${escapeHtml(order.items?.length || 0)} item${(order.items?.length || 0) === 1 ? "" : "s"}
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:16px 0;">
      <tr>
        <td style="padding:6px 0;font-size:13px;color:${BRAND_MUT};width:120px;">Order ID</td>
        <td style="padding:6px 0;font-size:13px;font-family:ui-monospace,monospace;">${escapeHtml(orderId)}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;font-size:13px;color:${BRAND_MUT};">Customer</td>
        <td style="padding:6px 0;font-size:13px;"><b>${escapeHtml(order.contact?.name || "")}</b></td>
      </tr>
      <tr>
        <td style="padding:6px 0;font-size:13px;color:${BRAND_MUT};">Phone</td>
        <td style="padding:6px 0;font-size:13px;font-family:ui-monospace,monospace;">${escapeHtml(order.contact?.phone || "")}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;font-size:13px;color:${BRAND_MUT};">Email</td>
        <td style="padding:6px 0;font-size:13px;">${escapeHtml(order.contact?.email || "\u2014")}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;font-size:13px;color:${BRAND_MUT};vertical-align:top;">Address</td>
        <td style="padding:6px 0;font-size:13px;">${escapeHtml(addressLine)}${address.landmark ? `<br><span style="color:${BRAND_MUT};font-size:12px;">Landmark: ${escapeHtml(address.landmark)}</span>` : ""}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;font-size:13px;color:${BRAND_MUT};">Payment</td>
        <td style="padding:6px 0;font-size:13px;">${escapeHtml(order.payment || "\u2014")}${order.paystackRef ? `<br><span style="color:${BRAND_MUT};font-size:11px;font-family:ui-monospace,monospace;">Ref: ${escapeHtml(order.paystackRef)}</span>` : ""}</td>
      </tr>
    </table>

    ${itemsTable(order.items)}
    ${totalsBlock(order.totals)}

    <div style="margin:24px 0 8px;text-align:center;">
      <a href="${orderAdminUrl}" style="display:inline-block;padding:12px 24px;background:${BRAND_COLOR};color:#ffffff;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px;">Open in admin</a>
    </div>
  `;

  return {
    subject: `[Voltory] New order ${orderId} \u2014 ${naira(order.totals?.grand || 0)}`,
    html: shell({
      title: `New order ${orderId}`,
      preheader: `${order.contact?.name} \u00B7 ${naira(order.totals?.grand || 0)}`,
      body,
    }),
  };
}

/* ============================================================
   Helpers
   ============================================================ */

function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}