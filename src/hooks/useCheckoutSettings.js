import { useCallback, useEffect, useState } from "react";
import { fetchCheckoutSettings, getSetting, FALLBACKS } from "../lib/checkoutSettingsClient.js";

/**
 * useCheckoutSettings  —  loads checkout settings once, exposes them
 *
 * Returns:
 *   { settings, get(key), loading, error, refresh() }
 *
 * `get(key)` always returns a value — falls back to hardcoded
 * constants if the setting hasn't loaded yet or the fetch failed.
 *
 * First render returns fallback values immediately, then updates
 * to DB values when the fetch resolves. Checkout math works from
 * tick 0 with conservative defaults.
 */
export function useCheckoutSettings() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const res = await fetchCheckoutSettings();
    setLoading(false);
    if (res.ok) {
      setSettings(res.settings);
      setError(null);
    } else {
      setError("Couldn't refresh checkout settings; using cached values.");
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const get = useCallback(
    (key) => getSetting(settings, key),
    [settings]
  );

  return { settings, get, loading, error, refresh, FALLBACKS };
}