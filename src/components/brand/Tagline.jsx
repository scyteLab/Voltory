import { BUSINESS_INFO } from "../../config/businessInfo.js";

/**
 * Tagline — renders the official NAVEN brand tagline per the brand guide
 * (Chapter 04 Typography, page 27): "THE PREMIUM ELECTRONICS"
 * Montserrat Light · uppercase · tracking 0.3em.
 *
 * Props:
 *   size:    "sm" | "md" | "lg" — defaults to "sm"
 *   align:   "left" | "center" — defaults to "left"
 *   as:      HTML tag name — defaults to "p"
 *   className: extra classes
 *
 * Typography is enforced by CSS (.brand-tagline class) per brand spec:
 * Montserrat Light, uppercase, 0.3em letter-spacing, no bold.
 *
 * NOTE: A "secondary" variant that rendered "THE ONE PLACE FOR ALL ELECTRONICS"
 * was removed on 2026-10-21. That phrase was never in the brand guide — the
 * guide specifies ONLY "THE PREMIUM ELECTRONICS" as the tagline.
 */
export default function Tagline({
  size = "sm",
  align = "left",
  as: Tag = "p",
  className = "",
}) {
  const classes = [
    "brand-tagline",
    `brand-tagline--${size}`,
    `brand-tagline--${align}`,
    className,
  ].filter(Boolean).join(" ");

  return <Tag className={classes}>{BUSINESS_INFO.taglinePrimary}</Tag>;
}
