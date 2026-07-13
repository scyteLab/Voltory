/**
 * Installation requests \u2014 saved to localStorage from the booking
 * form so the customer gets a real confirmation ID and the admin
 * can later surface them in the back office. Same pattern as
 * supportTickets. Backend swap-out is one function.
 *
 * Request shape:
 *   { id, createdAt, status, name, phone, email, address, applianceId,
 *     applianceName, brand, model, preferredDate, notes }
 */
const KEY = "voltory_install_requests";

/** VLT-I-YYYYMMDDHHmm-XXXX */
export function generateInstallId() {
  const d = new Date();
  const ts =
    d.getFullYear() +
    String(d.getMonth() + 1).padStart(2, "0") +
    String(d.getDate()).padStart(2, "0") +
    String(d.getHours()).padStart(2, "0") +
    String(d.getMinutes()).padStart(2, "0");
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `VLT-I-${ts}-${suffix}`;
}

export function listInstallRequests() {
  try {
    const raw = localStorage.getItem(KEY);
    const items = raw ? JSON.parse(raw) : [];
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

export function saveInstallRequest(req) {
  try {
    const all = listInstallRequests();
    localStorage.setItem(KEY, JSON.stringify([req, ...all]));
  } catch {
    /* noop */
  }
}

export const INSTALL_STATUS = {
  REQUESTED: "requested",
  CONFIRMED: "confirmed",
  SCHEDULED: "scheduled",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
};