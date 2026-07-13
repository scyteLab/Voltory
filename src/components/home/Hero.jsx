import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

const SLIDES = [
  {
    top: "Upgrade Your Home",
    big: "TOP BRANDS",
    sub: "Original products. Official warranty.",
    small: "Fast delivery & professional installation.",
    cta: { label: "Shop Now", to: "/category/air-conditioners" },
    image: "/banners/hero-1.png",
    bg: "#0c2461",
    accent: "#F5A623",
  },
  {
    top: "Deals Of The Day",
    big: "UP TO 40% OFF",
    sub: "Massive savings on fridges, ACs, TVs.",
    small: "Limited time offer. T&Cs apply.",
    cta: { label: "View Deals", to: "/deals" },
    image: "/banners/hero-2.png",
    bg: "#06251e",
    accent: "#22c55e",
  },
  {
    top: "Free Installation",
    big: "ELIGIBLE PRODUCTS",
    sub: "Professional setup by certified technicians.",
    small: "When you buy select appliances.",
    cta: { label: "Learn More", to: "/services/installation" },
    image: "/banners/hero-3.png",
    bg: "#1e1038",
    accent: "#a78bfa",
  },
  {
    top: "Cool Comfort",
    big: "INVERTER ACs",
    sub: "Save up to 60% on energy bills.",
    small: "Beat the heat smartly this season.",
    cta: { label: "Shop ACs", to: "/category/air-conditioners" },
    image: "/banners/hero-4.png",
    bg: "#082f49",
    accent: "#38bdf8",
  },
  {
    top: "Power Solutions",
    big: "STABILIZERS & UPS",
    sub: "Keep appliances safe and running.",
    small: "Through any power situation.",
    cta: { label: "Shop Now", to: "/category/power-solutions" },
    image: "/banners/hero-5.png",
    bg: "#451a03",
    accent: "#fb923c",
  },
  {
    top: "Scanfrost",
    big: "OFFICIAL STORE",
    sub: "Nigeria's No.1 Appliance Brand.",
    small: "Cooling, cooking & laundry with warranty.",
    cta: { label: "Visit Store", to: "/brand/scanfrost" },
    image: "/banners/hero-6.png",
    bg: "#7f1d1d",
    accent: "#fbbf24",
  },
];

export default function Hero() {
  const [active, setActive] = useState(0);
  const timer = useRef(null);

  function goTo(i) {
    setActive(i);
    resetTimer();
  }

  function resetTimer() {
    clearInterval(timer.current);
    timer.current = setInterval(() => {
      setActive((p) => (p + 1) % SLIDES.length);
    }, 5000);
  }

  useEffect(() => {
    resetTimer();
    return () => clearInterval(timer.current);
  }, []);

  const s = SLIDES[active];

  return (
    <div
      className="hero-banner"
      style={{ backgroundColor: s.bg }}
    >
      <img className="hero-banner__bg" src={s.image} alt="" />
      <div className="hero-banner__copy">
        <span className="hero-banner__top">{s.top}</span>
        <h1 className="hero-banner__big" style={{ backgroundColor: s.accent, color: s.bg }}>{s.big}</h1>
        <p className="hero-banner__sub">{s.sub}</p>
        <small className="hero-banner__small">{s.small}</small>
        <Link to={s.cta.to} className="btn-shop">{s.cta.label}</Link>
      </div>
      <div className="hero-banner__dots">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            className={"hero-dot" + (i === active ? " hero-dot--on" : "")}
            onClick={() => goTo(i)}
            aria-label={`Slide ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
