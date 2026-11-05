/**
 * Team notification emails, built server-side by notify-event.js.
 *
 * Inline styles + table layout (Gmail / Outlook strip <style>).
 * EVERY value that came from the database goes through esc(): rows
 * are written by visitors, so nothing is trusted.
 */

const NAVY = "#120F4C";
const INK  = "#0f172a";
const MUT  = "#64748b";
const LINE = "#e2e8f0";
const BG   = "#f8fafc";

export function esc(value) {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const nairaFmt = new Intl.NumberFormat("en-NG", { maximumFractionDigits: 0 });
export const naira = (n) => `₦${nairaFmt.format(Math.round(Number(n) || 0))}`;

export const lagosTime = (iso) =>
  `${new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos", dateStyle: "medium", timeStyle: "short",
  }).format(iso ? new Date(iso) : new Date())} (Lagos)`;

/** One line, no control characters, bounded — safe for a Subject header. */
export const subjectLine = (s) => String(s).replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 200);

function shell({ title, preheader, body }) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
</head>
<body style="margin:0;padding:0;background:${BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:${INK};">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;">${esc(preheader)}</div>` : ""}
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:${BG};">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="640" style="max-width:640px;width:100%;background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid ${LINE};">
          <tr>
            <td style="background:${NAVY};padding:18px 24px;">
              <span style="font-size:20px;font-weight:800;color:#ffffff;letter-spacing:0.04em;">NAVEN</span>
              <span style="font-size:12px;color:#c7c5ea;padding-left:8px;">Team notification</span>
            </td>
          </tr>
          <tr>
            <td style="padding:24px;">
              ${body}
            </td>
          </tr>
          <tr>
            <td style="background:${BG};padding:14px 24px;border-top:1px solid ${LINE};font-size:11px;color:${MUT};">
              Sent automatically when a new record was saved in the NAVEN database.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function fieldsTable(rows) {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border:1px solid ${LINE};border-radius:8px;border-collapse:separate;">
      ${rows.map(([label, value]) => `
      <tr>
        <td style="padding:7px 10px;font-size:13px;color:${MUT};width:150px;vertical-align:top;">${esc(label)}</td>
        <td style="padding:7px 10px;font-size:13px;white-space:pre-wrap;word-break:break-word;">${value == null || value === "" ? "—" : esc(value)}</td>
      </tr>`).join("")}
    </table>`;
}

function itemsTable(items) {
  const th = (label, align) =>
    `<th align="${align}" style="padding:8px;background:${BG};font-size:11px;color:${MUT};text-transform:uppercase;letter-spacing:0.03em;border-bottom:1px solid ${LINE};">${label}</th>`;
  const td = (html, align = "left") =>
    `<td align="${align}" style="padding:8px;border-bottom:1px solid ${LINE};font-size:13px;vertical-align:top;">${html}</td>`;
  const body = items.length
    ? items.map((i) => `
      <tr>
        ${td(`<b>${esc(i.name || i.sku)}</b>`)}
        ${td(`<span style="font-family:ui-monospace,monospace;font-size:12px;">${esc(i.sku)}</span>`)}
        ${td(esc(i.qty), "center")}
        ${td(esc(naira(i.unitPrice)), "right")}
        ${td(esc(naira(i.lineTotal)), "right")}
      </tr>`).join("")
    : `<tr>${td(`<i style="color:${MUT};">No items were found for this record yet — open it in admin.</i>`)}<td colspan="4" style="border-bottom:1px solid ${LINE};"></td></tr>`;
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:18px 0 0;border-collapse:collapse;">
      <thead><tr>${th("Item", "left")}${th("SKU", "left")}${th("Qty", "center")}${th("Unit", "right")}${th("Total", "right")}</tr></thead>
      <tbody>${body}</tbody>
    </table>`;
}

function totalsTable(rows) {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top:8px;">
      ${rows.map(([label, value, strong]) => `
      <tr>
        <td style="padding:5px 8px;font-size:${strong ? 15 : 13}px;${strong ? `font-weight:800;border-top:2px solid ${LINE};` : `color:${MUT};`}">${esc(label)}</td>
        <td align="right" style="padding:5px 8px;font-size:${strong ? 15 : 13}px;${strong ? `font-weight:800;border-top:2px solid ${LINE};color:${NAVY};` : ""}">${esc(value)}</td>
      </tr>`).join("")}
    </table>`;
}

function button(url) {
  return `
    <div style="margin:24px 0 4px;text-align:center;">
      <a href="${esc(url)}" style="display:inline-block;padding:12px 26px;background:${NAVY};color:#ffffff;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px;">Open in admin</a>
    </div>`;
}

/**
 * Generic notification.
 *   heading   — "New order VLT-…"
 *   intro     — optional one-line summary under the heading
 *   rows      — [[label, value]]
 *   items     — optional [{ name, sku, qty, unitPrice, lineTotal }]
 *   totals    — optional [[label, value, strong?]]
 *   longText  — optional [label, value] (message body)
 *   adminUrl  — "Open in admin" target
 */
export function notificationEmail({ heading, intro = "", rows, items = null, totals = null, longText = null, adminUrl }) {
  const body = `
    <h1 style="margin:0 0 6px;font-size:20px;color:${INK};">${esc(heading)}</h1>
    ${intro ? `<p style="margin:0 0 16px;font-size:14px;color:${MUT};">${esc(intro)}</p>` : `<div style="height:10px;"></div>`}
    ${fieldsTable(rows)}
    ${items ? itemsTable(items) : ""}
    ${totals ? totalsTable(totals) : ""}
    ${longText ? `
    <p style="margin:18px 0 6px;font-size:11px;color:${MUT};text-transform:uppercase;letter-spacing:0.04em;">${esc(longText[0])}</p>
    <div style="padding:14px;background:${BG};border-radius:8px;font-size:14px;line-height:1.5;white-space:pre-wrap;word-break:break-word;">${esc(longText[1])}</div>` : ""}
    ${button(adminUrl)}`;

  const text = [
    heading,
    ...(intro ? [intro] : []),
    "",
    ...rows.map(([label, value]) => `${label}: ${value == null || value === "" ? "-" : value}`),
    ...(items ? ["", "Items:", ...items.map((i) => `- ${i.name || i.sku} (${i.sku}) x${i.qty} @ ${naira(i.unitPrice)} = ${naira(i.lineTotal)}`)] : []),
    ...(totals ? ["", ...totals.map(([label, value]) => `${label}: ${value}`)] : []),
    ...(longText ? ["", `${longText[0]}:`, longText[1]] : []),
    "",
    `Open in admin: ${adminUrl}`,
  ].join("\n");

  return { html: shell({ title: heading, preheader: intro || heading, body }), text };
}
