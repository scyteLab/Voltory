/**
 * adminToast — minimal pub/sub for admin-side toast notifications.
 *
 * Call adminToast.success(message) / adminToast.error(message) from
 * anywhere (event handlers, async callbacks) — no context/provider
 * needed at the call site. AdminToastHost (mounted once in
 * AdminShell) subscribes and renders whatever comes through.
 */
const listeners = new Set();
let idCounter = 0;

function emit(type, message) {
  const toast = { id: ++idCounter, type, message };
  listeners.forEach((fn) => fn(toast));
}

export const adminToast = {
  success: (message) => emit("success", message),
  error: (message) => emit("error", message),
};

export function subscribeAdminToast(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
