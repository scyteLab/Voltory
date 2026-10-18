import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";

const DWELL_MS = 6000;

/**
 * SLIDES — pure-image hero per Naven Brand Guidelines Edition 2026.
 *
 * Each slide = one full flyer image designed in Photoshop. The entire
 * image is a clickable Link. No code overlay (no kicker, headline, CTA
 * button — all baked into the image itself).
 *
 * To add/remove slides: add/remove entries in this array. The code
 * handles any number of slides automatically.
 */
const SLIDES = [
  {
    id: "grand-launch",
    image: "/banners/hero-grand-launch.jpeg",
    alt: "NAVEN grand launch — the premium electronics, now live",
    linkTo: "/",
  },
  {
    id: "sony-audio",
    image: "/banners/hero-sony-audio.jpeg",
    alt: "Sony audio systems — premium sound, in stock at NAVEN",
    linkTo: "/",
  },
  {
    id: "kenwood",
    image: "/banners/hero-kenwood.jpg",
    alt: "Kenwood kitchen appliances — trusted and delivered",
    linkTo: "/",
  },
];

export default function Hero() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef(null);
  const touchStartX = useRef(null);

  const startTimer = useCallback(() => {
    clearInterval(timerRef.current);
    if (paused) return;
    timerRef.current = setInterval(() => {
      setActive((p) => (p + 1) % SLIDES.length);
    }, DWELL_MS);
  }, [paused]);

  useEffect(() => {
    startTimer();
    return () => clearInterval(timerRef.current);
  }, [startTimer, active]);

  const goTo = (i) => setActive(i);
  const pause = () => setPaused(true);
  const resume = () => setPaused(false);

  const onTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    pause();
  };

  const onTouchEnd = (e) => {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 50) {
      if (dx < 0) setActive((p) => (p + 1) % SLIDES.length);
      else setActive((p) => (p - 1 + SLIDES.length) % SLIDES.length);
    }
    touchStartX.current = null;
    setTimeout(resume, 400);
  };

  return (
    <section
      className="jh-hero"
      onMouseEnter={pause}
      onMouseLeave={resume}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      aria-roledescription="carousel"
      aria-label="Featured promotions"
    >
      {SLIDES.map((slide, i) => (
        <article
          key={slide.id}
          className={
            "jh-slide jh-slide--image" +
            (i === active ? " jh-slide--on" : "")
          }
          aria-hidden={i !== active}
        >
          <Link
            to={slide.linkTo}
            className="jh-slide__image-link"
            style={{ "--jh-slide-bg": `url(${slide.image})` }}
          >
            <img
              className="jh-slide__full-image"
              src={slide.image}
              alt={slide.alt}
              loading={i === 0 ? "eager" : "lazy"}
            />
          </Link>
        </article>
      ))}

      <nav className="jh-hero__dots" aria-label="Slide selector">
        {SLIDES.map((slide, i) => (
          <button
            key={slide.id}
            type="button"
            className={"jh-dot" + (i === active ? " jh-dot--on" : "")}
            onClick={() => goTo(i)}
            aria-label={`Go to slide ${i + 1}`}
            aria-current={i === active}
          />
        ))}
      </nav>
    </section>
  );
}
