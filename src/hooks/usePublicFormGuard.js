import { useEffect, useState } from "react";

/**
 * Spam guard shared by every public form: a honeypot field plus a
 * 30-second resubmit cooldown (remembered in localStorage per form,
 * so a reload doesn't reset it).
 *
 *   const guard = usePublicFormGuard("contact");
 *   <HoneypotField value={guard.honeypot} onChange={guard.setHoneypot} />
 *   if (guard.isBot()) { guard.markSent(); showSuccess(); return; }
 *   ... on a successful save: guard.markSent();
 *   disabled={guard.cooldownLeft > 0}
 */
const COOLDOWN_MS = 30_000;

function readLastSent(key) {
  try { return Number(localStorage.getItem(key)) || 0; } catch { return 0; }
}
function writeLastSent(key, ts) {
  try { localStorage.setItem(key, String(ts)); } catch { /* noop */ }
}

export function usePublicFormGuard(formKey) {
  const storageKey = `naven_${formKey}_last_sent`;
  const [honeypot, setHoneypot] = useState("");
  const [lastSent, setLastSent] = useState(() => readLastSent(storageKey));
  const [now, setNow] = useState(() => Date.now());

  const cooldownLeft = Math.max(0, Math.ceil((lastSent + COOLDOWN_MS - now) / 1000));

  // Tick once a second, only while a cooldown is running.
  useEffect(() => {
    if (cooldownLeft <= 0) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [cooldownLeft]);

  function markSent() {
    const ts = Date.now();
    writeLastSent(storageKey, ts);
    setLastSent(ts);
    setNow(ts);
  }

  /** True when the hidden field was filled. Logged so a real visitor
   *  silently caught by it (e.g. by an over-eager autofill) shows up
   *  in the console instead of vanishing. */
  function isBot() {
    if (!honeypot) return false;
    // eslint-disable-next-line no-console
    console.warn(`[${formKey}] honeypot field was filled; submission dropped as spam.`);
    return true;
  }

  return { honeypot, setHoneypot, cooldownLeft, markSent, isBot };
}
