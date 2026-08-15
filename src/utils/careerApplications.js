/**
 * Career applications — saved to localStorage from the Careers
 * form. Real persistence, real confirmation IDs, real follow-up
 * possibility. When the backend lands, this becomes a POST to
 * /api/applications and the admin gets an inbox view.
 *
 * Application shape:
 *   { id, createdAt, status, name, email, phone, roleId,
 *     roleTitle, linkedin, portfolio, coverNote, source }
 */
const KEY = "voltory_career_applications";

/** VLT-A-YYYYMMDDHHmm-XXXX */
export function generateApplicationId() {
  const d = new Date();
  const ts =
    d.getFullYear() +
    String(d.getMonth() + 1).padStart(2, "0") +
    String(d.getDate()).padStart(2, "0") +
    String(d.getHours()).padStart(2, "0") +
    String(d.getMinutes()).padStart(2, "0");
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `VLT-A-${ts}-${suffix}`;
}

export function listApplications() {
  try {
    const raw = localStorage.getItem(KEY);
    const items = raw ? JSON.parse(raw) : [];
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

export function saveApplication(application) {
  try {
    const all = listApplications();
    localStorage.setItem(KEY, JSON.stringify([application, ...all]));
  } catch {
    /* noop */
  }
}

export const APPLICATION_STATUS = {
  RECEIVED: "received",
  REVIEWING: "reviewing",
  INTERVIEW: "interview",
  OFFER: "offer",
  CLOSED: "closed",
};