import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { BadgeCheck, ChevronLeft, ChevronRight, Gift, ShieldCheck, Star, Truck } from "lucide-react";
import { SITE } from "../config/site.js";
import { BRANDS, getDeals, PRODUCTS } from "../data/products.js";
import Icon from "../components/ui/Icon.jsx";
import ProductCard from "../components/product/ProductCard.jsx";
import CategorySidebar from "../components/home/CategorySidebar.jsx";
import Hero from "../components/home/Hero.jsx";
import CountdownTimer from "../components/home/CountdownTimer.jsx";
import CategoryStrip from "../components/home/CategoryStrip.jsx";
import ServiceCards from "../components/home/ServiceCards.jsx";
import BottomBenefits from "../components/home/BottomBenefits.jsx";
import AppPromo from "../components/home/AppPromo.jsx";
import ScanfrostStore from "../components/home/ScanfrostStore.jsx";
import AnniversaryDeals from "../components/home/AnniversaryDeals.jsx";
import LastViewed from "../components/home/LastViewed.jsx";

export default function Home() {
  const deals = getDeals().slice(0, 10);
  const featured = PRODUCTS.slice(0, 10);
  const trustRef = useRef(null);
  const brandsRef = useRef(null);

  function smoothScroll(el, distance, duration = 600) {
    const start = el.scrollLeft;
    const target = start + distance;
    const t0 = performance.now();
    function step(now) {
      const p = Math.min((now - t0) / duration, 1);
      const ease = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      el.scrollLeft = start + distance * ease;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function scrollSlider(ref, dir) {
    const el = ref.current;
    if (!el) return;
    smoothScroll(el, dir * el.offsetWidth * 0.55);
  }

  useEffect(() => {
    const timers = [trustRef, brandsRef].map((ref) => {
      const el = ref.current;
      if (!el) return null;
      let paused = false;
      const step = el.firstElementChild ? el.firstElementChild.offsetWidth : 180;
      const id = setInterval(() => {
        if (paused) return;
        const atEnd = el.scrollLeft + el.offsetWidth >= el.scrollWidth - 2;
        if (atEnd) {
          smoothScroll(el, -el.scrollLeft, 900);
        } else {
          smoothScroll(el, step);
        }
      }, 3500);
      const pause = () => { paused = true; };
      const resume = () => { paused = false; };
      el.addEventListener("pointerenter", pause);
      el.addEventListener("pointerleave", resume);
      return { id, el, pause, resume };
    });
    return () => {
      for (const t of timers) {
        if (!t) continue;
        clearInterval(t.id);
        t.el.removeEventListener("pointerenter", t.pause);
        t.el.removeEventListener("pointerleave", t.resume);
      }
    };
  }, []);

  return (
    <>
      <main className="wrap">
        {/* 1 — sidebar + hero + quick actions (3-col Jumia-style) */}
        <section className="hero-row reveal" aria-label="Featured">
          <CategorySidebar />
          <Hero />
          <aside className="hero-promos">
            <Link to="/deals" className="hero-promo hero-promo--warm">
              <div className="hero-promo__tag"><Gift size={10} /> Limited Offer</div>
              <h3 className="hero-promo__title">Freezer Promo</h3>
              <p className="hero-promo__sub">Buy any Freezer &amp; get a <b>FREE Umbrella!</b></p>
              <img className="hero-promo__img" src="/products/ref.png" alt="" />
              <span className="hero-promo__cta">Shop Now</span>
              <div className="hero-promo__badges">
                <span><Star size={9} /> Top Brands</span>
                <span><ShieldCheck size={9} /> Warranty</span>
                <span><Truck size={9} /> Fast Delivery</span>
              </div>
            </Link>
            <Link to="/category/air-conditioners" className="hero-promo hero-promo--cool">
              <div className="hero-promo__tag hero-promo__tag--alt"><Star size={10} /> Best Sellers</div>
              <h3 className="hero-promo__title">Inverter ACs</h3>
              <p className="hero-promo__sub">Save up to <b>60% on energy</b> bills this season</p>
              <img className="hero-promo__img" src="/products/ac.png" alt="" />
              <span className="hero-promo__cta">Shop ACs</span>
              <div className="hero-promo__badges">
                <span><Star size={9} /> Great Prices</span>
                <span><ShieldCheck size={9} /> Warranty</span>
                <span><Truck size={9} /> Free Install</span>
              </div>
            </Link>
          </aside>
        </section>

        {/* 2 — trust strip */}
        <div className="trust-wrap reveal reveal--2">
          <button className="trust-arrow trust-arrow--l" onClick={() => scrollSlider(trustRef, -1)} aria-label="Scroll left">
            <ChevronLeft size={18} />
          </button>
          <section className="trust" ref={trustRef} aria-label="Why shop with us">
            {SITE.trustPoints.map((t) => (
              <div className="trust__item" key={t.title}>
                <span className="trust__icon"><Icon name={t.icon} size={18} /></span>
                <span className="trust__text">
                  <b>{t.title}</b>
                  <p>{t.text}</p>
                </span>
              </div>
            ))}
          </section>
          <button className="trust-arrow trust-arrow--r" onClick={() => scrollSlider(trustRef, 1)} aria-label="Scroll right">
            <ChevronRight size={18} />
          </button>
        </div>

        {/* 3 — Shop By Top Brands */}
        <div className="section-head reveal reveal--3">
          <h2>Shop By Top Brands</h2>
          <Link to="/brands">View all brands <ChevronRight size={14} /></Link>
        </div>
        <div className="brands-wrap">
          <button className="brands-arrow brands-arrow--l" onClick={() => scrollSlider(brandsRef, -1)} aria-label="Scroll left">
            <ChevronLeft size={18} />
          </button>
          <section className="brands-strip" ref={brandsRef} aria-label="Brands">
            {BRANDS.map((b) => (
              <Link key={b.id} to={`/brand/${b.id}`} className="brand-tile" aria-label={b.name}>
                <img src={b.logo} alt={b.name} loading="lazy" />
              </Link>
            ))}
          </section>
          <button className="brands-arrow brands-arrow--r" onClick={() => scrollSlider(brandsRef, 1)} aria-label="Scroll right">
            <ChevronRight size={18} />
          </button>
        </div>

        {/* 3b — Scanfrost Official Store */}
        <div style={{ marginTop: 24 }} />
        <ScanfrostStore />

        {/* 4 — Deals Of The Day with live countdown */}
        <div className="deals-head" style={{ marginTop: 24 }}>
          <h2>Deals Of The Day</h2>
          <div className="deals-head__right">
            <CountdownTimer />
            <Link to="/deals" style={{ fontSize: 13, fontWeight: 600, color: "var(--p)" }}>
              View all deals <ChevronRight size={14} style={{ verticalAlign: "middle" }} />
            </Link>
          </div>
        </div>
        <ProductRow items={deals} label="Deals of the day" />

        {/* 4b — Anniversary Deals */}
        <div style={{ marginTop: 24 }} />
        <AnniversaryDeals />

        {/* 5 — Category icon strip */}
        <div style={{ marginTop: 24 }} />
        <CategoryStrip />

        {/* 6 — Featured / Recommended */}
        <div className="section-head">
          <h2>Recommended for You</h2>
          <Link to="/category/air-conditioners">
            View all <ChevronRight size={14} style={{ verticalAlign: "middle" }} />
          </Link>
        </div>
        <ProductRow items={featured} label="Recommended products" />

        {/* 6b — Last Viewed */}
        <div className="section-head">
          <h2>Recently Viewed</h2>
        </div>
        <LastViewed />

        {/* 7 — Service value-prop cards */}
        <div style={{ marginTop: 24 }} />
        <ServiceCards />

        {/* 8 — App promo with Pidgin popup */}
        <AppPromo />
      </main>

      {/* 9 — Bottom benefits strip (full width, sits above footer) */}
      <BottomBenefits />
    </>
  );
}

function ProductRow({ items, label, variant }) {
  const ref = useRef(null);
  function scroll(dir) {
    const el = ref.current;
    if (!el) return;
    const card = el.firstElementChild;
    const amount = card ? card.offsetWidth * 3 : el.offsetWidth * 0.7;
    const start = el.scrollLeft;
    const t0 = performance.now();
    function step(now) {
      const p = Math.min((now - t0) / 500, 1);
      const ease = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      el.scrollLeft = start + dir * amount * ease;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  return (
    <div className="pgrid-wrap">
      <button className="pgrid-arrow pgrid-arrow--l" onClick={() => scroll(-1)} aria-label="Scroll left"><ChevronLeft size={16} /></button>
      <section className={"pgrid" + (variant ? ` pgrid--${variant}` : "")} ref={ref} aria-label={label}>
        {items.map((p) => <ProductCard key={p.sku} product={p} />)}
      </section>
      <button className="pgrid-arrow pgrid-arrow--r" onClick={() => scroll(1)} aria-label="Scroll right"><ChevronRight size={16} /></button>
    </div>
  );
}