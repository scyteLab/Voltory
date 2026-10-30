import { supabase } from "./supabaseClient.js";

/**
 * contactMessagesClient — storefront side of contact_messages.
 *
 * Anon may INSERT only (see supabase/contact_messages.sql), so we
 * never .select() the row back — that would need a SELECT policy.
 */
export async function submitContactMessage({ name, email, phone, subject, message }) {
  try {
    const { error } = await supabase.from("contact_messages").insert({
      name,
      email: email || null,
      phone: phone || null,
      subject: subject || null,
      message,
    });
    if (error) {
      // eslint-disable-next-line no-console
      console.error("[contact] insert failed:", error);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}
