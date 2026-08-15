/**
 * BrandLogo — renders the brand's logo image if we have one,
 * otherwise falls back to a styled initial-letter tile.
 * Reusable across the brand directory, brand storefront, search
 * suggestions, and anywhere else a brand needs a face.
 *
 * Props:
 *   brand    — the brand record { id, name, logo }
 *   size     — visual variant: "sm" | "md" | "lg"
 *   grayscale— if true, applies the same greyscale-to-color hover
 *              treatment as on the home brand strip
 */
export default function BrandLogo({ brand, size = "md", grayscale = false }) {
  if (!brand) return null;
  const cls = `blogo blogo--${size}` + (grayscale ? " blogo--gray" : "");

  if (brand.logo) {
    return (
      <span className={cls} aria-label={brand.name}>
        <img src={brand.logo} alt={brand.name} loading="lazy" />
      </span>
    );
  }

  // Fallback: initial letter on a soft tile. Uses the brand id to
  // pick a stable hue so the same brand always gets the same colour.
  const initial = brand.name.charAt(0).toUpperCase();
  const hue = hashHue(brand.id || brand.name);
  return (
    <span
      className={cls + " blogo--initial"}
      aria-label={brand.name}
      style={{
        backgroundColor: `hsl(${hue}, 60%, 92%)`,
        color: `hsl(${hue}, 50%, 28%)`,
      }}
    >
      {initial}
    </span>
  );
}

/** Stable hue [0,360) derived from a string. */
function hashHue(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
}