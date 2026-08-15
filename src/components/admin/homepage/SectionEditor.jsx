import { useState } from "react";
import ProductSourcePicker from "./ProductSourcePicker.jsx";

/**
 * SectionEditor
 *
 * The collapsible edit body shown when a section card is expanded.
 * What's editable depends on the section's `kind`:
 *
 *   • Product rows (deals_row, featured_row)
 *       – title
 *       – source (auto / tag / category / hand-picked)
 *       – limit
 *       – show_countdown (only deals_row)
 *
 *   • Brand tiles
 *       – title
 *
 *   • Hero promo tiles
 *       – title + subtitle + CTA + href per tile (up to 2)
 *
 *   • Other kinds (hero, category_sidebar, service_cards, etc.)
 *       – nothing to edit — they're pure layout components. We
 *         show a small note so operators know why.
 *
 * All edits debounce-save on blur (not per-keystroke) via
 * onPatch(patch).
 */

const NO_EDIT_KINDS = new Set([
  "category_sidebar",
  "hero",
  "scanfrost_store",
  "anniversary_deals",
  "category_strip",
  "last_viewed",
  "service_cards",
  "app_promo",
  "bottom_benefits",
]);

export default function SectionEditor({ section, onPatch }) {
  const { kind, config = {} } = section;

  if (NO_EDIT_KINDS.has(kind)) {
    return (
      <div className="hb-editor">
        <p className="hb-hint">
          This is a fixed layout section — it has no editable content in this
          release. You can still reorder or hide it above.
        </p>
      </div>
    );
  }

  if (kind === "deals_row" || kind === "featured_row") {
    return <ProductRowEditor section={section} onPatch={onPatch} />;
  }

  if (kind === "brand_tiles") {
    return <TitleOnlyEditor config={config} onPatch={onPatch} labelText="Section title" />;
  }

  if (kind === "hero_promo_tiles") {
    return <HeroPromoEditor config={config} onPatch={onPatch} />;
  }

  return (
    <div className="hb-editor">
      <p className="hb-hint">Editor for <code>{kind}</code> arrives in a later update.</p>
    </div>
  );
}

/* ==============================================================
   Editors
   ============================================================== */

function ProductRowEditor({ section, onPatch }) {
  const { kind, config = {} } = section;
  const [title, setTitle] = useState(config.title || "");
  return (
    <div className="hb-editor">
      <div className="hb-source__row">
        <label className="hb-lbl">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            if (title !== (config.title || "")) onPatch({ title });
          }}
          className="hb-input"
          placeholder="e.g. Deals of the day"
        />
      </div>

      {kind === "deals_row" && (
        <div className="hb-source__row">
          <label className="hb-lbl">
            <input
              type="checkbox"
              checked={!!config.show_countdown}
              onChange={(e) => onPatch({ show_countdown: e.target.checked })}
              style={{ marginRight: 8 }}
            />
            Show countdown timer
          </label>
        </div>
      )}

      <ProductSourcePicker config={config} onChange={onPatch} />
    </div>
  );
}

function TitleOnlyEditor({ config, onPatch, labelText = "Title" }) {
  const [title, setTitle] = useState(config.title || "");
  return (
    <div className="hb-editor">
      <div className="hb-source__row">
        <label className="hb-lbl">{labelText}</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            if (title !== (config.title || "")) onPatch({ title });
          }}
          className="hb-input"
        />
      </div>
    </div>
  );
}

function HeroPromoEditor({ config, onPatch }) {
  const tiles = Array.isArray(config.tiles) ? config.tiles : [];
  // Local state so typing doesn't hit the DB per keystroke
  const [drafts, setDrafts] = useState(tiles);

  function updateDraft(i, field, value) {
    const next = drafts.map((t, idx) => idx === i ? { ...t, [field]: value } : t);
    setDrafts(next);
  }
  function commit() {
    onPatch({ tiles: drafts });
  }

  const slots = [0, 1];

  return (
    <div className="hb-editor">
      {slots.map((i) => {
        const t = drafts[i] || { kind: i === 0 ? "warm" : "cool" };
        return (
          <fieldset key={i} className="hb-fieldset">
            <legend>Tile {i + 1}</legend>
            <div className="hb-source__row">
              <label className="hb-lbl">Title</label>
              <input
                type="text"
                className="hb-input"
                value={t.title || ""}
                onChange={(e) => updateDraft(i, "title", e.target.value)}
                onBlur={commit}
              />
            </div>
            <div className="hb-source__row">
              <label className="hb-lbl">Subtitle</label>
              <input
                type="text"
                className="hb-input"
                value={t.subtitle || ""}
                onChange={(e) => updateDraft(i, "subtitle", e.target.value)}
                onBlur={commit}
                placeholder="Simple HTML like <b>60%</b> works"
              />
            </div>
            <div className="hb-source__row">
              <label className="hb-lbl">CTA text</label>
              <input
                type="text"
                className="hb-input hb-input--sm"
                value={t.cta || ""}
                onChange={(e) => updateDraft(i, "cta", e.target.value)}
                onBlur={commit}
                placeholder="Shop now"
              />
            </div>
            <div className="hb-source__row">
              <label className="hb-lbl">Link</label>
              <input
                type="text"
                className="hb-input"
                value={t.href || ""}
                onChange={(e) => updateDraft(i, "href", e.target.value)}
                onBlur={commit}
                placeholder="/deals or /category/air-conditioners"
              />
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}