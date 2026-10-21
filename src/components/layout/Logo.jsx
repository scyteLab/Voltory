import { Link } from "react-router-dom";

/**
 * NAVEN Logo — authentic vector marks extracted from the Naven Brand Guidelines
 * 2026 Edition (Designclick Technologies / iA Artelier).
 *
 * THREE VARIANTS:
 *   variant="wordmark"  (default) — the primary N-A/V-E-N mark
 *   variant="lockup"              — wordmark + "THE PREMIUM ELECTRONICS" tagline
 *   variant="icon"                — the A/V center glyph only, for small formats
 *
 * COLOURING via CSS variables (parent controls appearance):
 *   --naven-ink    letter colour      (default: Deep Navy #120F4C)
 *   --naven-green  V facet colour     (default: Naven Green #2DEA87)
 *
 *   On dark backgrounds: wrap with style={{ "--naven-ink": "#fff" }}
 *   On light backgrounds: default colours work.
 *   On green promo cards: style={{ "--naven-ink": "#120F4C", "--naven-green": "#120F4C" }}
 *
 * SIZE:
 *   Pass `height` (number, px) or let it inherit from parent CSS
 *   (the `.logo` class reads --naven-logo-h; see brand.css).
 *   Brand minimum: 80px for wordmark, 20px for icon.
 *
 * COMPATIBILITY with the old text wordmark:
 *   - `to` defaults to null: every existing call site already wraps the
 *     logo in its own <Link to="/">, and a link inside a link is invalid.
 *     Pass to="/" explicitly where the logo should link by itself.
 *   - `tagline` (old prop) is still accepted: tagline={true} renders the
 *     lockup variant; tagline={false} or omitted renders the wordmark.
 *   - Keeps the old `logo` class so existing layout rules still apply.
 */

export default function Logo({
  variant,
  tagline = false,
  height,
  to = null,
  className = "logo",
  style,
  ariaLabel = "NAVEN",
}) {
  const resolved = variant || (tagline ? "lockup" : "wordmark");
  const inner =
    resolved === "icon" ? <IconMark /> :
    resolved === "lockup" ? <WordmarkLockup /> :
    <WordmarkOnly />;

  const wrapperStyle = {
    display: "inline-flex",
    alignItems: "center",
    textDecoration: "none",
    lineHeight: 0,
    ...(height ? { height: `${height}px` } : {}),
    ...style,
  };

  if (to) {
    return (
      <Link to={to} aria-label={ariaLabel} className={className} style={wrapperStyle}>
        {inner}
      </Link>
    );
  }
  return (
    <span className={className} style={wrapperStyle} role="img" aria-label={ariaLabel}>
      {inner}
    </span>
  );
}

function WordmarkOnly() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 568.5 171.5"
      fill="none"
      role="img"
      aria-labelledby="naven-wm-title"
      style={{ height: "100%", width: "auto", display: "block" }}
    >
      <title id="naven-wm-title">NAVEN</title>
      <style>{`
        .n-ink { fill: var(--naven-ink, #120F4C); }
        .n-grn { fill: var(--naven-green, #2DEA87); }
      `}</style>
      <path className="n-ink" d="M67.525 171.823 34.369 32.352 V171.823 H-0.443 V0.626 H61.364 L94.520 140.334 V0.626 H129.095 V171.823 H67.525 Z" />
      <path className="n-ink" d="M283.590 172.645 H228.067 L190.654 135.221 V172.645 H143.578 V0.041 L283.590 172.645 Z" />
      <path className="n-grn" d="M299.278 0.041 V172.645 L162.893 0.041 H224.159 L257.935 33.839 V0.041 H299.278 Z" />
      <path className="n-ink" d="M315.158 171.823 V0.626 H415.561 V29.041 H357.785 V70.711 H409.175 V97.707 H357.785 V143.409 H416.270 V171.823 H315.158 Z" />
      <path className="n-ink" d="M507.674 171.823 474.530 32.352 V171.823 H439.718 V0.626 H501.514 L534.670 140.334 V0.626 H569.245 V171.823 H507.674 Z" />
    </svg>
  );
}

/*
 * Lockup geometry (SVG units; wordmark is 0–569 wide, 0–172.6 tall):
 *   - tagline cap height ≈ 14% of the wordmark height (font-size 35 →
 *     Montserrat caps ≈ 24.5 units)
 *   - gap between wordmark and tagline caps = 24 units (≈ 14%)
 *   - tagline is stretched with textLength to EXACTLY the wordmark width,
 *     adjusting only letter-spacing (glyphs keep their shape)
 * So the tagline always sits flush left and right under N…N at any size.
 * Weight 400 rather than Light: at the 8–10px it renders on site, Light
 * thins out on standard (non-retina) screens.
 */
const LOCKUP_TAG_SIZE = 35;
const LOCKUP_GAP = 24;
const LOCKUP_BASELINE = 172.6 + LOCKUP_GAP + LOCKUP_TAG_SIZE * 0.7; // ≈ 221.1
const LOCKUP_HEIGHT = 224;

function WordmarkLockup() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`-0.5 0 570 ${LOCKUP_HEIGHT}`}
      fill="none"
      role="img"
      aria-labelledby="naven-lockup-title"
      style={{ height: "100%", width: "auto", display: "block" }}
    >
      <title id="naven-lockup-title">NAVEN — The Premium Electronics</title>
      <style>{`
        .n-ink { fill: var(--naven-ink, #120F4C); }
        .n-grn { fill: var(--naven-green, #2DEA87); }
        .n-tag {
          fill: var(--naven-tagline, var(--naven-ink, #120F4C));
          font-family: Montserrat, system-ui, -apple-system, sans-serif;
          font-weight: 400;
        }
      `}</style>
      <g>
        <path className="n-ink" d="M67.525 171.823 34.369 32.352 V171.823 H-0.443 V0.626 H61.364 L94.520 140.334 V0.626 H129.095 V171.823 H67.525 Z" />
        <path className="n-ink" d="M283.590 172.645 H228.067 L190.654 135.221 V172.645 H143.578 V0.041 L283.590 172.645 Z" />
        <path className="n-grn" d="M299.278 0.041 V172.645 L162.893 0.041 H224.159 L257.935 33.839 V0.041 H299.278 Z" />
        <path className="n-ink" d="M315.158 171.823 V0.626 H415.561 V29.041 H357.785 V70.711 H409.175 V97.707 H357.785 V143.409 H416.270 V171.823 H315.158 Z" />
        <path className="n-ink" d="M507.674 171.823 474.530 32.352 V171.823 H439.718 V0.626 H501.514 L534.670 140.334 V0.626 H569.245 V171.823 H507.674 Z" />
      </g>
      <text
        className="n-tag"
        x="0"
        y={LOCKUP_BASELINE}
        fontSize={LOCKUP_TAG_SIZE}
        textLength="569.2"
        lengthAdjust="spacing"
      >
        THE PREMIUM ELECTRONICS
      </text>
    </svg>
  );
}

function IconMark() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 155.6 172.56"
      fill="none"
      role="img"
      aria-labelledby="naven-icon-title"
      style={{ height: "100%", width: "auto", display: "block" }}
    >
      <title id="naven-icon-title">NAVEN</title>
      <style>{`
        .n-ink { fill: var(--naven-ink, #120F4C); }
        .n-grn { fill: var(--naven-green, #2DEA87); }
      `}</style>
      <g transform="translate(-143.436, 0)">
        <path className="n-ink" d="M283.549 172.604 H228.026 L190.613 135.180 V172.604 H143.537 V0.000 L283.549 172.604 Z" />
        <path className="n-grn" d="M299.237 0.000 V172.604 L162.852 0.000 H224.118 L257.894 33.798 V0.000 H299.237 Z" />
      </g>
    </svg>
  );
}
