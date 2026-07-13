/**
 * Newsletter subscribers \u2014 saved to localStorage from the Footer
 * input and the Blog Coming Soon page. Backend swap-out is one
 * function. Same shape as supportTickets and installationRequests.
 *
 * Subscriber shape:
 *   { email, topics, source, subscribedAt }
 *   source: "footer" | "blog"
 */
const KEY = "voltory_newsletter_subscribers";

export function listSubscribers() {
  try {
    const raw = localStorage.getItem(KEY);
    const items = raw ? JSON.parse(raw) : [];
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

/**
 * Add a subscriber. De-dupes by email (case-insensitive). Returns
 * { added: true } on success, { added: false, reason } when the
 * email is already subscribed or invalid.
 */
export function addSubscriber({ email, topics = [], source = "footer" }) {
  const clean = (email || "").trim().toLowerCase();
  if (!clean) return { added: false, reason: "empty" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return { added: false, reason: "invalid" };

  try {
    const all = listSubscribers();
    if (all.some((s) => s.email === clean)) {
      return { added: false, reason: "duplicate" };
    }
    const next = [
      { email: clean, topics, source, subscribedAt: new Date().toISOString() },
      ...all,
    ];
    localStorage.setItem(KEY, JSON.stringify(next));
    return { added: true };
  } catch {
    return { added: false, reason: "storage" };
  }
}