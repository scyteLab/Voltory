/**
 * form_submissions.form_type → how the admin Inbox and the
 * notification email label it. `fields` lists the keys of the row's
 * `data` jsonb in display order; unknown keys are still shown after
 * these, so adding a field to a form never hides it.
 *
 * Plain data (no browser APIs): also imported by
 * netlify/functions/notify-new-submission.js.
 *
 * Adding a form: add it here, to the form_type check in
 * supabase/forms_backend.sql, and it gets an Inbox tab automatically.
 */
export const FORM_TYPES = {
  installation: {
    label: "Installation",
    title: "Installation request",
    summary: (d) => [d.appliance, d.state].filter(Boolean).join(" · "),
    fields: [
      ["reference", "Reference"],
      ["appliance", "Appliance"],
      ["fee", "Service fee (₦)"],
      ["brand", "Brand"],
      ["model", "Model"],
      ["state", "State"],
      ["lga", "LGA / Area"],
      ["street", "Street address"],
      ["preferred_date", "Preferred date"],
      ["notes", "Notes"],
    ],
  },
  affiliate: {
    label: "Affiliate",
    title: "Affiliate application",
    summary: (d) => [d.affiliate_type, d.channel].filter(Boolean).join(" · "),
    fields: [
      ["affiliate_type", "Affiliate type"],
      ["channel", "Primary channel"],
      ["audience", "Audience size"],
      ["category", "Preferred category"],
      ["message", "Why partner with us"],
    ],
  },
  careers: {
    label: "Careers",
    title: "Job application",
    summary: (d) => d.role || "",
    fields: [
      ["reference", "Reference"],
      ["role", "Role"],
      ["linkedin", "LinkedIn"],
      ["portfolio", "Portfolio / CV"],
      ["cover_note", "Cover note"],
    ],
  },
};

export const SUBMISSION_STATUSES = ["new", "in_progress", "done"];
export const SUBMISSION_STATUS_LABEL = { new: "New", in_progress: "In progress", done: "Done" };

/** [[label, value], ...] for a submission's data, known fields first. */
export function submissionDataRows(formType, data) {
  const d = data && typeof data === "object" ? data : {};
  const known = FORM_TYPES[formType]?.fields || [];
  const seen = new Set();
  const rows = [];
  for (const [key, label] of known) {
    seen.add(key);
    if (d[key] != null && d[key] !== "") rows.push([label, String(d[key])]);
  }
  for (const [key, value] of Object.entries(d)) {
    if (seen.has(key) || value == null || value === "") continue;
    rows.push([key.replace(/_/g, " "), typeof value === "object" ? JSON.stringify(value) : String(value)]);
  }
  return rows;
}
