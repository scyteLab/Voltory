import { useEffect, useState } from "react";

/** Friendly Hh : Mm : Ss countdown ending at next midnight. */
function pad(n) { return String(n).padStart(2, "0"); }

export default function CountdownTimer() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const end = new Date(); end.setHours(23, 59, 59, 999);
  const diff = Math.max(0, end.getTime() - now);
  const h = Math.floor(diff / 3.6e6);
  const m = Math.floor((diff / 6e4) % 60);
  const s = Math.floor((diff / 1000) % 60);
  return (
    <span className="cdown">
      <span className="cdown__label">Ends in:</span>
      <span className="cdown__cell">{pad(h)}h</span>
      <span className="cdown__sep">:</span>
      <span className="cdown__cell">{pad(m)}m</span>
      <span className="cdown__sep">:</span>
      <span className="cdown__cell">{pad(s)}s</span>
    </span>
  );
}