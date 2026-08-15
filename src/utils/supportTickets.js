/**
 * Support tickets — saved from the Contact form to localStorage
 * so the customer gets real confirmation and the admin can later
 * surface them in the back office. Replaced by an API endpoint
 * when the backend lands; the shape stays.
 *
 * Ticket shape:
 *   { id, createdAt, status, name, email, subject, message }
 */
const KEY = "voltory_support_tickets";

/** VLT-T-YYYYMMDDHHmm-XXXX */
export function generateTicketId() {
  const d = new Date();
  const ts =
    d.getFullYear() +
    String(d.getMonth() + 1).padStart(2, "0") +
    String(d.getDate()).padStart(2, "0") +
    String(d.getHours()).padStart(2, "0") +
    String(d.getMinutes()).padStart(2, "0");
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `VLT-T-${ts}-${suffix}`;
}

export function listTickets() {
  try {
    const raw = localStorage.getItem(KEY);
    const items = raw ? JSON.parse(raw) : [];
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

export function saveTicket(ticket) {
  try {
    const all = listTickets();
    localStorage.setItem(KEY, JSON.stringify([ticket, ...all]));
  } catch {
    /* noop */
  }
}

export const TICKET_STATUS = {
  OPEN: "open",
  RESOLVED: "resolved",
};