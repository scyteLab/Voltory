/** Shared helpers for the admin Inbox tabs. */

export function formatDate(iso) {
  return new Date(iso).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" });
}

export function whatsappUrl(phone) {
  const digits = (phone || "").replace(/\D+/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits.startsWith("234") ? digits : "234" + digits.replace(/^0/, "")}`;
}

/** mailto: link with the original text quoted under the reply. */
export function mailtoReply({ to, subject, name, quoted, createdAt }) {
  const quote = (quoted || "").split("\n").map((l) => `> ${l}`).join("\n");
  const body = `Hi ${name},\n\n\n\n---\nYou wrote on ${formatDate(createdAt)}:\n${quote}`;
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
