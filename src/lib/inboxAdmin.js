import Papa from "papaparse";
import { supabase } from "./supabaseClient.js";
import { SUBMISSION_STATUSES } from "../config/formTypes.js";

/**
 * inboxAdmin — admin side of form_submissions and
 * newsletter_subscribers (supabase/forms_backend.sql).
 * Contact messages stay in contactMessagesAdmin.js.
 * Reads need a Supabase Auth session (RLS: authenticated only).
 */

/* ---------------- form_submissions ---------------- */

export async function fetchSubmissionsForAdmin({ formType, status = "new", limit = 200 } = {}) {
  try {
    let query = supabase
      .from("form_submissions")
      .select("*")
      .eq("form_type", formType)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (status && status !== "all") query = query.eq("status", status);

    const { data, error } = await query;
    if (error) {
      // eslint-disable-next-line no-console
      console.error("[inboxAdmin] submissions fetch failed:", error);
      return { ok: false, error: error.message, rows: [] };
    }
    return { ok: true, rows: data || [] };
  } catch (err) {
    return { ok: false, error: err?.message || String(err), rows: [] };
  }
}

export async function fetchSubmissionStatusCounts(formType) {
  try {
    const results = await Promise.all(
      SUBMISSION_STATUSES.map((s) =>
        supabase
          .from("form_submissions")
          .select("id", { count: "exact", head: true })
          .eq("form_type", formType)
          .eq("status", s)
      )
    );
    const counts = {};
    SUBMISSION_STATUSES.forEach((s, i) => { counts[s] = results[i].count || 0; });
    return { ok: true, counts };
  } catch (err) {
    return { ok: false, error: err?.message || String(err), counts: {} };
  }
}

/** { installation: 3, careers: 1, ... } — status 'new' only, for tab badges. */
export async function fetchNewSubmissionCountsByType() {
  try {
    const { data, error } = await supabase
      .from("form_submissions")
      .select("form_type")
      .eq("status", "new")
      .limit(1000);
    if (error) return { ok: false, error: error.message, counts: {} };
    const counts = {};
    for (const r of data || []) counts[r.form_type] = (counts[r.form_type] || 0) + 1;
    return { ok: true, counts };
  } catch (err) {
    return { ok: false, error: err?.message || String(err), counts: {} };
  }
}

/** patch: { status?, admin_note? } */
export async function updateSubmission(id, patch) {
  if (!id) return { ok: false, error: "Missing submission id" };
  try {
    const { data, error } = await supabase
      .from("form_submissions")
      .update(patch)
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: "Submission not found or not allowed" };
    return { ok: true, row: data };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/* ---------------- newsletter_subscribers ---------------- */

// The newsletter has no 'new' status, so "new" means signed up since
// this admin last opened the Newsletter tab (per browser).
const NEWSLETTER_SEEN_KEY = "naven_admin_newsletter_seen_at";

export function readNewsletterSeenAt() {
  try { return localStorage.getItem(NEWSLETTER_SEEN_KEY) || null; } catch { return null; }
}
export function markNewsletterSeen() {
  try { localStorage.setItem(NEWSLETTER_SEEN_KEY, new Date().toISOString()); } catch { /* noop */ }
}

export async function countNewSubscribers() {
  try {
    let query = supabase.from("newsletter_subscribers").select("id", { count: "exact", head: true });
    const seenAt = readNewsletterSeenAt();
    if (seenAt) query = query.gt("created_at", seenAt);
    const { count, error } = await query;
    return error ? 0 : count || 0;
  } catch {
    return 0;
  }
}

export async function fetchSubscribersForAdmin({ status = "subscribed", limit = 5000 } = {}) {
  try {
    let query = supabase
      .from("newsletter_subscribers")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (status && status !== "all") query = query.eq("status", status);
    const { data, error } = await query;
    if (error) {
      // eslint-disable-next-line no-console
      console.error("[inboxAdmin] subscribers fetch failed:", error);
      return { ok: false, error: error.message, rows: [] };
    }
    return { ok: true, rows: data || [] };
  } catch (err) {
    return { ok: false, error: err?.message || String(err), rows: [] };
  }
}

export async function setSubscriberStatus(id, status) {
  try {
    const { data, error } = await supabase
      .from("newsletter_subscribers")
      .update({ status })
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: "Subscriber not found or not allowed" };
    return { ok: true, row: data };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

export function downloadSubscribersCsv(rows) {
  const csv = Papa.unparse(rows.map((r) => ({
    email: r.email,
    status: r.status,
    source: r.source,
    topics: (r.topics || []).join("; "),
    subscribed_at: r.created_at,
  })));
  // BOM so Excel opens UTF-8 correctly (same as dataExports.js).
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `naven-newsletter-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
