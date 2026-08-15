import { Link } from "react-router-dom";
import Logo from "../layout/Logo.jsx";

/**
 * AuthShowcase — the animated left panel shared by all auth pages.
 *
 * Motion architecture (Termii-inspired):
 *   · Rich navy gradient slowly drifting (background-position)
 *   · Warm gold glow blob (radial gradient, translate animation)
 *   · Thin bright streaks TRAVELING left-to-right across the
 *     panel like slow-motion laser beams. Each streak is a plain
 *     div with its own random-feeling top position, width,
 *     duration, and delay so the field feels organic.
 *
 * The streaks are the visual signature. They point toward the
 * form on the right, subtly drawing the eye toward the CTA.
 *
 * All motion respects prefers-reduced-motion via CSS.
 */
export default function AuthShowcase() {
  return (
    <aside className="ashell-showcase">
      <div className="ashell-showcase__gradient" aria-hidden="true" />
      <div className="ashell-showcase__glow" aria-hidden="true" />

      {/* Traveling streaks. Each one is a thin horizontal div
          positioned by top/width, animated left-to-right by CSS.
          Handcrafted values (not algorithmic) so the field feels
          composed rather than random. */}
      <div className="ashell-showcase__lines" aria-hidden="true">
        {STREAKS.map((s, i) => (
          <div
            key={i}
            className="ashell-showcase__line"
            style={{
              top:               s.top,
              width:             s.width,
              animationDuration: s.duration,
              animationDelay:    s.delay,
            }}
          />
        ))}
      </div>

      <Link to="/" className="ashell-showcase__logo">
        <Logo tagline={false} />
      </Link>

      <div className="ashell-showcase__center">
        <h1 className="ashell-showcase__title">
          Every appliance genuine.
          <br />
          <span className="ashell-showcase__title--accent">
            Every warranty honored.
          </span>
        </h1>
        <p className="ashell-showcase__lede">
          NAVEN is Nigeria's authorized distributor for the world's leading
          appliance brands — direct from manufacturers, delivered nationwide.
        </p>

        <div className="ashell-showcase__stats">
          <div>
            <b>100%</b>
            <span>Original Products</span>
          </div>
          <div>
            <b>36+</b>
            <span>States Delivered</span>
          </div>
        </div>
      </div>

      <Link to="/" className="ashell-showcase__back">
        &larr; Back to store
      </Link>
    </aside>
  );
}

/*
  Streak configuration.

  Each streak has:
    top       — vertical position as % of panel height
    width     — how much of the panel horizontal span the streak
                 travels through (translation range is width-based)
    duration  — how long a single left-to-right pass takes
    delay     — stagger so streaks don't all start together

  The set of values is HAND-CHOSEN to feel organic. Two streaks
  are close together vertically (18%/32%), some are far apart
  (50% → 66% is bigger gap), widths and durations vary within a
  narrow band so no single streak dominates.
*/
const STREAKS = [
  { top: "18%", width: "65%", duration: "5.4s", delay: "0s"   },
  { top: "32%", width: "80%", duration: "6.1s", delay: "1.1s" },
  { top: "50%", width: "55%", duration: "5.7s", delay: "0.6s" },
  { top: "66%", width: "70%", duration: "6.5s", delay: "2.0s" },
  { top: "80%", width: "58%", duration: "5.9s", delay: "1.6s" },
];