/**
 * scheduled-rebuild — Netlify Scheduled Function
 *
 * Triggers a fresh production build once a day so the prerendered
 * product pages, sitemap.xml and the Google Merchant feed pick up
 * catalogue changes (prices, stock, new products) made in admin.
 *
 * Needs the env var NETLIFY_BUILD_HOOK_URL (Site configuration → Build
 * & deploy → Build hooks → "Daily SEO rebuild"). Without it, it logs
 * and does nothing.
 *
 * 03:00 UTC = 04:00 in Lagos.
 */
export default async () => {
  const hook = process.env.NETLIFY_BUILD_HOOK_URL;
  if (!hook || !/^https:\/\/api\.netlify\.com\/build_hooks\//.test(hook)) {
    console.warn("[scheduled-rebuild] NETLIFY_BUILD_HOOK_URL is not set (or not a Netlify build hook); skipping");
    return new Response("not configured", { status: 200 });
  }
  const res = await fetch(`${hook}?trigger_title=${encodeURIComponent("Daily SEO rebuild")}`, { method: "POST" });
  console.log(`[scheduled-rebuild] build hook → HTTP ${res.status}`);
  return new Response(res.ok ? "triggered" : `hook failed: ${res.status}`, { status: 200 });
};

export const config = { schedule: "0 3 * * *" };
