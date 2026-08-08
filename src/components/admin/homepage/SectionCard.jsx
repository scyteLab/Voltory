import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronDown, Eye, EyeOff, GripVertical, Trash2,
} from "lucide-react";
import SectionEditor from "./SectionEditor.jsx";

/**
 * SectionCard
 *
 * One row in the homepage builder. Shows kind + title, plus:
 *   \u2022 drag handle (works for keyboard reorder too via dnd-kit)
 *   \u2022 visibility toggle
 *   \u2022 expand button to open the editor body
 *   \u2022 delete button
 *
 * Uses @dnd-kit/sortable for sort behavior. Wraps in a fragment
 * of setNodeRef + style so drag/reorder animations are smooth.
 */

/** Nice friendly labels for each section kind */
const KIND_LABELS = {
  category_sidebar:  "Category Sidebar",
  hero:              "Hero Slider",
  hero_promo_tiles:  "Hero Promo Tiles",
  brand_tiles:       "Brand Tiles",
  scanfrost_store:   "Scanfrost Official Store",
  deals_row:         "Deals Row",
  anniversary_deals: "Anniversary Deals Carousel",
  category_strip:    "Category Strip",
  featured_row:      "Featured Products Row",
  last_viewed:       "Recently Viewed",
  service_cards:     "Service Cards",
  app_promo:         "App Promo Banner",
  bottom_benefits:   "Bottom Benefits Strip",
  promo_banner:      "Custom Promo Banner",
};

export default function SectionCard({ section, onToggleVisibility, onPatchConfig, onDelete }) {
  const [open, setOpen] = useState(false);
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const kindLabel = KIND_LABELS[section.kind] || section.kind;
  const title = section.config?.title;

  function handleDelete() {
    if (window.confirm(`Delete the "${kindLabel}" section? This cannot be undone.`)) {
      onDelete(section.id);
    }
  }

  return (
    <li ref={setNodeRef} style={style} className={"hb-card" + (isDragging ? " hb-card--dragging" : "") + (!section.is_visible ? " hb-card--hidden" : "")}>
      <div className="hb-card__row">
        <button
          type="button"
          className="hb-card__handle"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
          title="Drag to reorder"
        >
          <GripVertical size={18} />
        </button>

        <div className="hb-card__main">
          <div className="hb-card__kind">{kindLabel}</div>
          {title && <div className="hb-card__title">{title}</div>}
        </div>

        <div className="hb-card__actions">
          <button
            type="button"
            className={"hb-icbtn" + (section.is_visible ? "" : " hb-icbtn--off")}
            onClick={() => onToggleVisibility(section.id)}
            title={section.is_visible ? "Hide this section" : "Show this section"}
          >
            {section.is_visible ? <Eye size={16} /> : <EyeOff size={16} />}
          </button>
          <button
            type="button"
            className={"hb-icbtn hb-card__expand" + (open ? " hb-card__expand--open" : "")}
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label="Edit section"
            title="Edit"
          >
            <ChevronDown size={16} />
          </button>
          <button
            type="button"
            className="hb-icbtn hb-icbtn--danger"
            onClick={handleDelete}
            title="Delete section"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {open && (
        <div className="hb-card__body">
          <SectionEditor
            section={section}
            onPatch={(patch) => onPatchConfig(section.id, patch)}
          />
        </div>
      )}
    </li>
  );
}