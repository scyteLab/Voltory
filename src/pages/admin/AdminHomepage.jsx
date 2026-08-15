import { useMemo } from "react";
import {
  DndContext, KeyboardSensor, PointerSensor,
  closestCenter, useSensor, useSensors,
} from "@dnd-kit/core";
import {
  SortableContext, sortableKeyboardCoordinates,
  verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { ExternalLink, Loader2 } from "lucide-react";
import { useAdminSiteSections } from "../../hooks/useAdminSiteSections.js";
import SectionCard from "../../components/admin/homepage/SectionCard.jsx";
import AddSectionMenu from "../../components/admin/homepage/AddSectionMenu.jsx";

/**
 * AdminHomepage
 *
 * The homepage builder. Left-column: the ordered list of sections
 * as drag-drop cards. Right column intentionally simple for now:
 * a link to preview the storefront homepage in a new tab and a
 * status indicator.
 *
 * Session 31c (future) can add an inline iframe preview and a
 * "publish vs draft" workflow. For now every save is live.
 */
export default function AdminHomepage() {
  const {
    sections, loading, error, saving,
    reorder, toggleVisibility, patchConfig, add, remove,
  } = useAdminSiteSections();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const orderedIds = useMemo(() => sections.map((s) => s.id), [sections]);

  function onDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = orderedIds.indexOf(active.id);
    const newIndex = orderedIds.indexOf(over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(orderedIds, oldIndex, newIndex);
    reorder(next);
  }

  return (
    <div className="adm-page hb">
      <header className="adm-page__head">
        <div>
          <h1>Homepage</h1>
          <p>Rearrange, hide, and edit the sections shown on the storefront homepage. Changes save automatically and go live immediately.</p>
        </div>
        <div className="hb__head-actions">
          {saving && (
            <span className="hb__saving"><Loader2 size={13} className="hb__spin" /> Saving…</span>
          )}
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="adm-btn adm-btn--secondary"
          >
            <ExternalLink size={13} /> View storefront
          </a>
        </div>
      </header>

      {error && (
        <div className="hb__err">
          <div style={{ flex: 1 }}>
            Something went wrong: {error}. Latest changes have been rolled back.
            Check your browser console (F12 → Console) for details.
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              background: "transparent",
              border: "1px solid currentColor",
              color: "inherit",
              padding: "3px 10px",
              borderRadius: 6,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      )}

      {loading && sections.length === 0 ? (
        <div className="hb__loading">Loading sections…</div>
      ) : (
        <>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
              <ol className="hb-list">
                {sections.map((s) => (
                  <SectionCard
                    key={s.id}
                    section={s}
                    onToggleVisibility={toggleVisibility}
                    onPatchConfig={patchConfig}
                    onDelete={remove}
                  />
                ))}
              </ol>
            </SortableContext>
          </DndContext>

          <div className="hb__add-row">
            <AddSectionMenu onAdd={add} />
            <small className="hb-hint">
              New sections are added to the end of the list. Drag to reposition.
            </small>
          </div>
        </>
      )}
    </div>
  );
}