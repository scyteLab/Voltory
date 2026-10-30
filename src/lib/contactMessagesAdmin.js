import { supabase } from "./supabaseClient.js";

/**
 * contactMessagesAdmin — admin inbox for Contact-page messages.
 * Reads need a Supabase Auth session (RLS: authenticated only).
 *
 *   · fetchMessagesForAdmin    — list, filtered by status
 *   · fetchMessageStatusCounts — tab counters
 *   · updateMessage            — status and/or admin note
 */

export const MESSAGE_STATUSES = ["new", "replied", "closed"];

export async function fetchMessagesForAdmin({ status = "new", limit = 200 } = {}) {
  try {
    let query = supabase
      .from("contact_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status && status !== "all") query = query.eq("status", status);

    const { data, error } = await query;
    if (error) {
      // eslint-disable-next-line no-console
      console.error("[contactAdmin] fetch failed:", error);
      return { ok: false, error: error.message, messages: [] };
    }
    return { ok: true, messages: data || [] };
  } catch (err) {
    return { ok: false, error: err?.message || String(err), messages: [] };
  }
}

export async function fetchMessageStatusCounts() {
  try {
    const results = await Promise.all(
      MESSAGE_STATUSES.map((s) =>
        supabase
          .from("contact_messages")
          .select("id", { count: "exact", head: true })
          .eq("status", s)
      )
    );
    const counts = {};
    MESSAGE_STATUSES.forEach((s, i) => { counts[s] = results[i].count || 0; });
    return { ok: true, counts };
  } catch (err) {
    return { ok: false, error: err?.message || String(err), counts: {} };
  }
}

/** patch: { status?, admin_note? } */
export async function updateMessage(id, patch) {
  if (!id) return { ok: false, error: "Missing message id" };
  try {
    const { data, error } = await supabase
      .from("contact_messages")
      .update(patch)
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: "Message not found or not allowed" };
    return { ok: true, message: data };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}
