import { BUSINESS_INFO } from "../../config/businessInfo.js";

/**
 * Tagline — renders Naven brand taglines per the brand guide.
 *
 * Props:
 *   variant: "primary" | "secondary" — defaults to "primary"
 *   size:    "sm" | "md" | "lg" — defaults to "sm"
 *   align:   "left" | "center" — defaults to "left"
 *   as:      HTML tag name — defaults to "p"
 *   className: extra classes
 *
 * Typography is enforced by CSS (.brand-tagline class) per brand spec:
 * Montserrat Light, uppercase, 0.1em letter-spacing, no bold.
 */
export default function Tagline({
  variant = "primary",
  size = "sm",
  align = "left",
  as: Tag = "p",
  className = "",
}) {
  const text = variant === "secondary"
    ? BUSINESS_INFO.taglineSecondary
    : BUSINESS_INFO.taglinePrimary;

  const classes = [
    "brand-tagline",
    `brand-tagline--${size}`,
    `brand-tagline--${align}`,
    className,
  ].filter(Boolean).join(" ");

  return <Tag className={classes}>{text}</Tag>;
}
