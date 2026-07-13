import { ChevronRight, MessageCircle } from "lucide-react";
import { SITE } from "../../config/site.js";

/**
 * Four service value-prop cards above the footer.
 * Each card pairs a short pitch with a supporting photo from /public/banners,
 * blended into the card background.
 */
const CARDS = [
  {
    image: "/banners/service.png",
    title: "Need Help Choosing?",
    text: "Talk to our product experts on WhatsApp.",
    cta: "Chat Now",
    layout: "bleed",
    href: SITE.whatsappLink,
    wa: true,
  },
  {
    image: "/banners/installa.png",
    title: "Installation Services",
    text: "Professional installation for ACs, TVs, Washing Machines & more.",
    cta: "Learn More",
    layout: "soft",
  },
  {
    image: "/banners/warranty.png",
    title: "Warranty & Support",
    text: "All products come with official brand warranty and support.",
    cta: "Learn More",
    layout: "soft",
    badge: true,
  },
  {
    image: "/banners/bulkbuy.png",
    title: "Bulk & Corporate Sales",
    text: "Special prices for offices, hotels, schools & NGOs.",
    cta: "Get a Quote",
    layout: "bleed",
  },
];

export default function ServiceCards() {
  return (
    <section className="svcards" aria-label="Help & services">
      {CARDS.map((c) => (
        <a
          className={`svcard svcard--${c.layout}${c.badge ? " svcard--badge" : ""}`}
          key={c.title}
          href={c.href}
        >
          <div className="svcard__body">
            <h3>{c.title}</h3>
            <p>{c.text}</p>
            {c.wa ? (
              <span className="svcard__btn svcard__btn--wa">
                <MessageCircle size={16} /> {c.cta}
              </span>
            ) : (
              <span className="svcard__cta">
                {c.cta} <ChevronRight size={14} />
              </span>
            )}
          </div>
          <img className="svcard__bleed" src={c.image} alt="" loading="lazy" />
        </a>
      ))}
    </section>
  );
}
