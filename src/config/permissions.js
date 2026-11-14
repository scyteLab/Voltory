/**
 * ============================================================
 *  ADMIN PERMISSIONS — single source of truth
 *
 *  role → permission keys. usePermission(key), the sidebar, the
 *  route gate (AdminShell) and the ⌘K palette all read this file.
 *
 *  The browser check is for the UI only. The database enforces the
 *  same split once supabase/rls_roles_phase2.sql is run (keep the
 *  two in step when you change a role here).
 * ============================================================
 */

export const ROLES = {
  gm:      { label: "GM",      description: "Everything, incl. team, settings, approvals, refunds and cancellations." },
  store:   { label: "Store",   description: "Orders fulfilment, catalog, inventory, receipts, quotes, homepage, product questions. Prices and offers need GM approval." },
  support: { label: "Support", description: "Inbox, warranty, reviews, product questions, quotes (no convert), orders view + notes." },
};

/** Roles staff can be given from the Team page, in display order. */
export const ASSIGNABLE_ROLES = ["gm", "store", "support"];

/** Old role names still in the database until admin_roles_update.sql runs. */
const ROLE_ALIASES = { staff: "store" };

export function normaliseRole(role) {
  if (!role) return null;
  const r = ROLE_ALIASES[role] || role;
  return ROLES[r] ? r : null;
}

export const roleLabel = (role) => ROLES[normaliseRole(role)]?.label || "No role";

/** Every permission, with what it unlocks. */
export const PERMISSIONS = {
  "dashboard.view":     "See the dashboard (counts, alerts)",
  "reports.full":       "Revenue figures, Reports page",
  "orders.view":        "See orders",
  "orders.updateStatus":"Move orders confirmed → processing → shipped → delivered",
  "orders.cancel":      "Cancel an order",
  "orders.refund":      "Mark an order refunded",
  "orders.requestCancel":"Ask the GM to cancel an order",
  "orders.notes":       "Add internal notes to an order",
  "receipts.view":      "See and print receipts",
  "customers.view":     "See customers",
  "catalog.edit":       "Products, categories, brands, specs, images, attributes, collections",
  "catalog.delete":     "Delete products, categories, brands",
  "prices.propose":     "Propose price changes (GM approves)",
  "prices.approve":     "Change prices directly / approve proposals",
  "offers.propose":     "Propose offer changes (GM approves)",
  "offers.manage":      "Change offers directly",
  "inventory.edit":     "Inventory and stock imports",
  "homepage.edit":      "Homepage builder",
  "quotes.view":        "See WhatsApp quotes",
  "quotes.update":      "Change a quote's status and notes",
  "quotes.editItems":   "Change a quote's items",
  "quotes.convert":     "Convert a quote to an order",
  "inbox.view":         "Inbox (all tabs)",
  "warranty.manage":    "Warranty claims",
  "reviews.manage":     "Moderate reviews",
  "questions.manage":   "Answer and moderate product questions",
  "marketing.manage":   "Checkout discounts and thresholds",
  "exports.run":        "Data exports",
  "team.manage":        "Team: add staff, change roles, deactivate",
  "settings.manage":    "Settings page",
  "approvals.decide":   "GM approvals portal",
};

const STORE = [
  "dashboard.view",
  "orders.view", "orders.updateStatus", "orders.requestCancel", "orders.notes",
  "receipts.view", "customers.view",
  "catalog.edit", "catalog.delete", "prices.propose", "offers.propose",
  "inventory.edit", "homepage.edit",
  "quotes.view", "quotes.update", "quotes.editItems", "quotes.convert",
  "questions.manage",
];

const SUPPORT = [
  "dashboard.view",
  "orders.view", "orders.notes",
  "receipts.view", "customers.view",
  "quotes.view", "quotes.update",
  "inbox.view", "warranty.manage", "reviews.manage", "questions.manage",
];

// The GM gets every key except the "propose" ones: their changes
// apply directly (two-person approval needs a second decider anyway).
const GM = Object.keys(PERMISSIONS).filter((k) => !["prices.propose", "offers.propose", "orders.requestCancel"].includes(k));

export const ROLE_PERMISSIONS = {
  gm:      new Set(GM),
  store:   new Set(STORE),
  support: new Set(SUPPORT),
};

/** keys: one key or an array (any of them is enough). */
export function can(role, keys) {
  const set = ROLE_PERMISSIONS[normaliseRole(role)];
  if (!set) return false;
  return (Array.isArray(keys) ? keys : [keys]).some((k) => set.has(k));
}

/**
 * Admin pages → the permission(s) needed to open them. Longest
 * matching prefix wins; anything not listed needs dashboard.view.
 */
const PAGE_PERMISSIONS = [
  ["/admin/products",        "catalog.edit"],
  ["/admin/catalog",         "catalog.edit"],
  ["/admin/attributes",      "catalog.edit"],
  ["/admin/collections",     "catalog.edit"],
  ["/admin/specs",           "catalog.edit"],
  ["/admin/offers",          ["offers.manage", "offers.propose"]],
  ["/admin/pricing",         ["prices.approve", "prices.propose"]],
  ["/admin/inventory",       "inventory.edit"],
  ["/admin/orders",          "orders.view"],
  ["/admin/receipts",        "receipts.view"],
  ["/admin/customers",       "customers.view"],
  ["/admin/whatsapp-quotes", "quotes.view"],
  ["/admin/inbox",           "inbox.view"],
  ["/admin/messages",        "inbox.view"],
  ["/admin/warranty",        "warranty.manage"],
  ["/admin/reviews",         "reviews.manage"],
  ["/admin/questions",       "questions.manage"],
  ["/admin/homepage",        "homepage.edit"],
  ["/admin/marketing",       "marketing.manage"],
  ["/admin/reports",         "reports.full"],
  ["/admin/exports",         "exports.run"],
  ["/admin/team",            "team.manage"],
  ["/admin/settings",        "settings.manage"],
  ["/admin/gm-portal",       "approvals.decide"],
  ["/admin/gm-setup",        "approvals.decide"],
];

export function pagePermission(pathname) {
  let best = null;
  for (const [prefix, perm] of PAGE_PERMISSIONS) {
    const hit = pathname === prefix || pathname.startsWith(prefix + "/");
    if (hit && (!best || prefix.length > best[0].length)) best = [prefix, perm];
  }
  return best ? best[1] : "dashboard.view";
}

export const canOpenPage = (role, pathname) => can(role, pagePermission(pathname));
