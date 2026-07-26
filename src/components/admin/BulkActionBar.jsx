import { useState } from "react";
import { AlertTriangle, Check, CircleSlash, Trash2, X } from "lucide-react";

/**
 * BulkActionBar
 *
 * Appears above the table when at least one row is selected.
 * Actions: Set Active / Set Inactive / Delete / Clear selection.
 * Delete uses inline "Are you sure?" pattern \u2014 no browser confirm().
 *
 * The parent owns the actual mutations and passes async callbacks.
 * We just display state and gate on confirmation.
 */
export default function BulkActionBar({
  count, onSetStatus, onDelete, onClear,
}) {
  const [busy, setBusy] = useState(null); // "active" | "inactive" | "delete"
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState(null);

  if (count === 0) return null;

  async function run(kind, fn) {
    setError(null);
    setBusy(kind);
    try { await fn(); }
    catch (e) { setError(e.message || String(e)); }
    finally { setBusy(null); setConfirmDelete(false); }
  }

  return (
    <div className={"adm-bulkbar" + (confirmDelete ? " adm-bulkbar--danger" : "")}>
      <div className="adm-bulkbar__left">
        <button
          type="button" className="adm-icon-btn adm-icon-btn--sm"
          onClick={onClear} aria-label="Clear selection"
        >
          <X size={16} />
        </button>
        <b>{count} selected</b>
        {error && (
          <span className="adm-bulkbar__err">
            <AlertTriangle size={13} /> {error}
          </span>
        )}
      </div>

      <div className="adm-bulkbar__right">
        {!confirmDelete && (
          <>
            <button
              type="button"
              className="adm-btn adm-btn--secondary"
              disabled={busy != null}
              onClick={() => run("active", () => onSetStatus("active"))}
            >
              {busy === "active" ? "Working\u2026" : <><Check size={13} /> Set Active</>}
            </button>
            <button
              type="button"
              className="adm-btn adm-btn--secondary"
              disabled={busy != null}
              onClick={() => run("inactive", () => onSetStatus("inactive"))}
            >
              {busy === "inactive" ? "Working\u2026" : <><CircleSlash size={13} /> Set Inactive</>}
            </button>
            <button
              type="button"
              className="adm-btn adm-btn--ghost-danger"
              disabled={busy != null}
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={13} /> Delete
            </button>
          </>
        )}

        {confirmDelete && (
          <>
            <span className="adm-bulkbar__confirm">
              Delete <b>{count}</b> product{count === 1 ? "" : "s"} permanently?
            </span>
            <button
              type="button" className="adm-btn adm-btn--secondary"
              onClick={() => setConfirmDelete(false)}
              disabled={busy === "delete"}
            >
              Cancel
            </button>
            <button
              type="button" className="adm-btn adm-btn--danger"
              disabled={busy === "delete"}
              onClick={() => run("delete", onDelete)}
            >
              {busy === "delete" ? "Deleting\u2026" : "Yes, delete"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}