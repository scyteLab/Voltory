import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { MEGA_MENU_MEDIA } from "../../config/megaMenuMedia.js";

/**
 * MegaMenuFeature — image card on the right of the category flyout.
 *
 * Every configured image is stacked in the same frame and only the
 * active one is opaque, so moving between categories crossfades instead
 * of flashing. Paths come straight from the config (any extension).
 *
 * `failed` is owned by CategorySidebar (which also preloads the images
 * when the menu first opens) so a broken image stays hidden across
 * menu open/close. A category with no config entry, or whose image
 * failed, renders nothing.
 */
const ENTRIES = Object.entries(MEGA_MENU_MEDIA);

export default function MegaMenuFeature({ categoryId, failed, onImageError, onNavigate }) {
  const media = MEGA_MENU_MEDIA[categoryId];
  if (!media || failed.has(media.image)) return null;

  return (
    <aside className="mmfeature" aria-label={media.title}>
      <Link to={media.href} className="mmfeature__media" onClick={onNavigate} tabIndex={-1}>
        {ENTRIES.map(([id, m]) =>
          failed.has(m.image) ? null : (
            <img
              key={id}
              src={m.image}
              alt={id === categoryId ? m.alt : ""}
              aria-hidden={id !== categoryId}
              className={"mmfeature__img" + (id === categoryId ? " mmfeature__img--on" : "")}
              decoding="async"
              onError={() => onImageError(m.image)}
            />
          )
        )}
      </Link>
      <div className="mmfeature__body">
        <span className="mmfeature__eyebrow">{media.eyebrow}</span>
        <p className="mmfeature__title">{media.title}</p>
        <Link to={media.href} className="mmfeature__cta" onClick={onNavigate}>
          {media.ctaLabel} <ArrowRight size={13} />
        </Link>
      </div>
    </aside>
  );
}
