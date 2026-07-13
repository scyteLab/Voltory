import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Maximize2, X } from "lucide-react";

export default function Gallery({ images, name }) {
  const list = images && images.length ? [...new Set(images)].filter(Boolean) : [];
  const [active, setActive] = useState(0);
  const [zooming, setZooming] = useState(false);
  const [pos, setPos] = useState({ x: 50, y: 50 });
  const [lightbox, setLightbox] = useState(false);

  useEffect(() => { setActive(0); }, [images]);

  const prev = useCallback(() => setActive((i) => (i - 1 + list.length) % list.length), [list.length]);
  const next = useCallback(() => setActive((i) => (i + 1) % list.length), [list.length]);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e) => {
      if (e.key === "Escape") setLightbox(false);
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [lightbox, prev, next]);

  if (!list.length) return null;

  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    setPos({
      x: ((e.clientX - r.left) / r.width) * 100,
      y: ((e.clientY - r.top) / r.height) * 100,
    });
  };

  return (
    <>
      <div className="pgallery">
        <div className="pgallery__thumbs" role="tablist" aria-label="Product images">
          {list.map((src, i) => (
            <button
              key={i}
              className={"pgallery__thumb" + (i === active ? " pgallery__thumb--on" : "")}
              onClick={() => setActive(i)}
              aria-label={`View image ${i + 1}`}
              aria-selected={i === active}
              role="tab"
            >
              <img src={src} alt="" loading="lazy" />
            </button>
          ))}
        </div>
        <div
          className="pgallery__stage"
          onMouseEnter={() => setZooming(true)}
          onMouseLeave={() => setZooming(false)}
          onMouseMove={onMove}
        >
          <img
            src={list[active]}
            alt={name}
            className="pgallery__main"
            style={
              zooming
                ? { transform: "scale(1.8)", transformOrigin: `${pos.x}% ${pos.y}%` }
                : undefined
            }
          />
          {list.length > 1 && (
            <>
              <button className="pgallery__arrow pgallery__arrow--prev" onClick={prev} aria-label="Previous image">
                <ChevronLeft size={18} />
              </button>
              <button className="pgallery__arrow pgallery__arrow--next" onClick={next} aria-label="Next image">
                <ChevronRight size={18} />
              </button>
            </>
          )}
          <button className="pgallery__expand" onClick={() => setLightbox(true)} aria-label="View larger">
            <Maximize2 size={16} />
          </button>
          <span className="pgallery__counter">{active + 1} / {list.length}</span>
        </div>
      </div>

      {lightbox && (
        <div className="lightbox" role="dialog" aria-label="Image viewer" onClick={() => setLightbox(false)}>
          <div className="lightbox__inner" onClick={(e) => e.stopPropagation()}>
            <button className="lightbox__close" onClick={() => setLightbox(false)} aria-label="Close">
              <X size={22} />
            </button>
            <div className="lightbox__stage">
              <img src={list[active]} alt={name} />
            </div>
            {list.length > 1 && (
              <>
                <button className="lightbox__arrow lightbox__arrow--prev" onClick={prev} aria-label="Previous">
                  <ChevronLeft size={24} />
                </button>
                <button className="lightbox__arrow lightbox__arrow--next" onClick={next} aria-label="Next">
                  <ChevronRight size={24} />
                </button>
              </>
            )}
            <div className="lightbox__thumbs">
              {list.map((src, i) => (
                <button
                  key={i}
                  className={"lightbox__thumb" + (i === active ? " lightbox__thumb--on" : "")}
                  onClick={() => setActive(i)}
                >
                  <img src={src} alt="" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
