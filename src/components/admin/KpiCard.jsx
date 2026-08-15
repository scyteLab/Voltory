import { ArrowDown, ArrowUp, Minus } from "lucide-react";

/**
 * A single KPI card. Matches the mockup:
 *   [icon]  Label
 *   Big number
 *   ↑ 12.4% vs last month     [sparkline path if provided]
 *
 * Props:
 *   label      — e.g. "Total Revenue"
 *   value      — the main number (already formatted)
 *   icon       — lucide component
 *   accent     — "brand" | "accent" | "ok" | "warn" | "err" | "info"
 *                 controls the icon tile background
 *   delta      — { pct: 12.4, direction: "up"|"down"|"flat" } | null
 *   deltaLabel — e.g. "vs last month"
 *   sparkline  — array of numbers to render as an SVG mini-chart
 */
const ACCENT_STYLES = {
  brand: { bg: "var(--adm-brand-soft)", fg: "var(--adm-brand)" },
  accent:{ bg: "rgba(245, 158, 11, 0.14)", fg: "var(--adm-accent)" },
  ok:    { bg: "var(--adm-ok-bg)",  fg: "var(--adm-ok)" },
  warn:  { bg: "var(--adm-warn-bg)",fg: "var(--adm-warn)" },
  err:   { bg: "var(--adm-err-bg)", fg: "var(--adm-err)" },
  info:  { bg: "var(--adm-info-bg)",fg: "var(--adm-info)" },
};

function DeltaBadge({ delta, label }) {
  if (!delta || delta.pct == null) {
    return <small className="adm-kpi__delta adm-kpi__delta--flat">— no prior data</small>;
  }
  const cls =
    delta.direction === "up"   ? "adm-kpi__delta--up" :
    delta.direction === "down" ? "adm-kpi__delta--down" :
                                 "adm-kpi__delta--flat";
  const Icon = delta.direction === "up" ? ArrowUp : delta.direction === "down" ? ArrowDown : Minus;
  const pctAbs = Math.abs(delta.pct).toFixed(1);
  return (
    <small className={"adm-kpi__delta " + cls}>
      <Icon size={11} /> {pctAbs}% <span>{label}</span>
    </small>
  );
}

function Sparkline({ points }) {
  if (!points || points.length < 2) return null;
  const w = 90, h = 28, pad = 2;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = max - min || 1;
  const step = (w - pad * 2) / (points.length - 1);
  const path = points
    .map((v, i) => {
      const x = pad + i * step;
      const y = pad + (h - pad * 2) * (1 - (v - min) / range);
      return (i === 0 ? "M" : "L") + x.toFixed(1) + "," + y.toFixed(1);
    })
    .join(" ");
  return (
    <svg width={w} height={h} className="adm-kpi__spark" aria-hidden="true">
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function KpiCard({
  label,
  value,
  icon: Icon,
  accent = "brand",
  delta,
  deltaLabel = "vs last month",
  sparkline,
}) {
  const s = ACCENT_STYLES[accent] || ACCENT_STYLES.brand;
  return (
    <article className="adm-kpi">
      <header className="adm-kpi__head">
        <span className="adm-kpi__icon" style={{ background: s.bg, color: s.fg }}>
          <Icon size={17} />
        </span>
        <span className="adm-kpi__label">{label}</span>
        {sparkline && (
          <span className="adm-kpi__spark-wrap" style={{ color: s.fg }}>
            <Sparkline points={sparkline} />
          </span>
        )}
      </header>
      <p className="adm-kpi__value">{value}</p>
      <DeltaBadge delta={delta} label={deltaLabel} />
    </article>
  );
}