/**
 * Warranty claim status metadata.
 * Flow:
 *   submitted \u2192 under_review \u2192 approved \u2192 resolved
 *                              \u2198 rejected  (terminal)
 */
export const WARRANTY_STATUSES = {
  submitted:    { label: "New",        chip: "adm-chip--warn", tone: "warn" },
  under_review: { label: "In Review",  chip: "adm-chip--info", tone: "info" },
  approved:     { label: "Approved",   chip: "adm-chip--ok",   tone: "ok" },
  rejected:     { label: "Rejected",   chip: "adm-chip--err",  tone: "err" },
  resolved:     { label: "Resolved",   chip: "adm-chip--ok",   tone: "ok" },
};

export const WARRANTY_TRANSITIONS = {
  submitted:    ["under_review", "rejected"],
  under_review: ["approved", "rejected"],
  approved:     ["resolved"],
  rejected:     [],
  resolved:     [],
};