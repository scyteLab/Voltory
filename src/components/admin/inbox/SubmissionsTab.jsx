import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft, Check, Clock, Inbox, Mail, MessageCircle, Phone, Save,
} from "lucide-react";
import {
  fetchSubmissionsForAdmin, fetchSubmissionStatusCounts, updateSubmission,
} from "../../../lib/inboxAdmin.js";
import { adminToast } from "../../../lib/adminToast.js";
import {
  FORM_TYPES, SUBMISSION_STATUS_LABEL, submissionDataRows,
} from "../../../config/formTypes.js";
import { formatDate, mailtoReply, whatsappUrl } from "./inboxUtils.js";

/**
 * SubmissionsTab — Admin → Inbox → Installation / Affiliate / Careers
 *
 * One component for every form_submissions form_type. Same layout as
 * MessagesTab: list on the left, detail on the right (stacked on
 * mobile), with status, a private note and reply links.
 */
export default function SubmissionsTab({ formType, initialId = null, onChanged }) {
  const config = FORM_TYPES[formType];
  const [status, setStatus]   = useState(initialId ? "all" : "new");
  const [rows, setRows]       = useState([]);
  const [counts, setCounts]   = useState({ new: 0, in_progress: 0, done: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [selectedId, setSelectedId] = useState(initialId);

  const refreshCounts = useCallback(() => {
    fetchSubmissionStatusCounts(formType).then((c) => c.ok && setCounts(c.counts));
  }, [formType]);

  const refresh = useCallback(async () => {
    setLoading(true);
    const res = await fetchSubmissionsForAdmin({ formType, status });
    setLoading(false);
    if (res.ok) {
      setRows(res.rows);
      setError(null);
    } else {
      setError(res.error);
    }
    refreshCounts();
  }, [formType, status, refreshCounts]);

  useEffect(() => { refresh(); }, [refresh]);

  const selected = rows.find((r) => r.id === selectedId) || null;

  // Keep the edited row in the list until the next refresh.
  function applyUpdate(updated) {
    setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    refreshCounts();
    onChanged?.();
  }

  const TABS = [
    { id: "new",         label: "New",         count: counts.new },
    { id: "in_progress", label: "In progress", count: counts.in_progress },
    { id: "done",        label: "Done",        count: counts.done },
    { id: "all",         label: "All",         count: counts.new + counts.in_progress + counts.done },
  ];

  return (
    <div>
      <div className="revq-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={status === t.id}
            className={"revq-tab" + (status === t.id ? " revq-tab--on" : "")}
            onClick={() => { setStatus(t.id); setSelectedId(null); }}
          >
            {t.label}
            {t.count > 0 && <span className="revq-tab__count">{t.count}</span>}
          </button>
        ))}
      </div>

      {error && <div className="hb__err">Couldn't load {config.label.toLowerCase()} submissions: {error}</div>}

      {loading && rows.length === 0 ? (
        <div className="hb__loading">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="cat-empty">
          <Inbox size={40} strokeWidth={1.2} />
          <h2>
            {status === "all"
              ? `No ${config.label.toLowerCase()} submissions yet`
              : `Nothing ${SUBMISSION_STATUS_LABEL[status].toLowerCase()}`}
          </h2>
          <p>
            {status === "new"
              ? `When someone sends the ${config.title.toLowerCase()} form, it appears here.`
              : "Nothing to see in this bucket right now."}
          </p>
        </div>
      ) : (
        <div className={"msg-layout" + (selected ? " msg-layout--detail" : "")}>
          <ul className="msg-list">
            {rows.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  className={"msg-row" + (r.id === selectedId ? " msg-row--on" : "") + (r.status === "new" ? " msg-row--new" : "")}
                  onClick={() => setSelectedId(r.id)}
                >
                  <div className="msg-row__top">
                    <b>{r.name}</b>
                    <span className={`msg-chip msg-chip--${r.status}`}>{SUBMISSION_STATUS_LABEL[r.status]}</span>
                  </div>
                  <div className="msg-row__subject">{config.summary(r.data || {}) || config.title}</div>
                  <div className="msg-row__preview">{[r.email, r.phone].filter(Boolean).join(" · ")}</div>
                  <div className="msg-row__date"><Clock size={11} /> {formatDate(r.created_at)}</div>
                </button>
              </li>
            ))}
          </ul>

          {selected ? (
            <SubmissionDetail
              key={selected.id}
              row={selected}
              config={config}
              onBack={() => setSelectedId(null)}
              onUpdated={applyUpdate}
            />
          ) : (
            <div className="msg-detail msg-detail--empty">
              <Inbox size={32} strokeWidth={1.2} />
              <p>Select a submission to read it.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SubmissionDetail({ row, config, onBack, onUpdated }) {
  const [note, setNote] = useState(row.admin_note || "");
  const [busy, setBusy] = useState(false);
  const noteDirty = note !== (row.admin_note || "");
  const waUrl = whatsappUrl(row.phone);
  const dataRows = submissionDataRows(row.form_type, row.data);
  const reference = row.data?.reference;

  async function save(patch, okText) {
    setBusy(true);
    const res = await updateSubmission(row.id, patch);
    setBusy(false);
    if (!res.ok) {
      adminToast.error(`Couldn't save: ${res.error}`);
      return;
    }
    adminToast.success(okText);
    onUpdated(res.row);
  }

  const mailto = row.email && mailtoReply({
    to: row.email,
    subject: `Re: your ${config.title.toLowerCase()}${reference ? ` (${reference})` : ""}`,
    name: row.name,
    quoted: dataRows.map(([label, value]) => `${label}: ${value}`).join("\n"),
    createdAt: row.created_at,
  });

  return (
    <section className="msg-detail">
      <button type="button" className="msg-detail__back" onClick={onBack}>
        <ArrowLeft size={14} /> All {config.label.toLowerCase()}
      </button>

      <header className="msg-detail__head">
        <div>
          <span className={`msg-chip msg-chip--${row.status}`}>{SUBMISSION_STATUS_LABEL[row.status]}</span>
          <h2>{config.title}</h2>
          <p className="msg-detail__from">
            <b>{row.name}</b>
            {row.email && <> · <a href={`mailto:${row.email}`}>{row.email}</a></>}
            {row.phone && <> · <a href={`tel:${row.phone}`}>{row.phone}</a></>}
          </p>
          <p className="msg-detail__date"><Clock size={12} /> {formatDate(row.created_at)}</p>
        </div>
      </header>

      <dl className="inbox-fields">
        {dataRows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{/^https?:\/\//i.test(value)
              ? <a href={value} target="_blank" rel="noreferrer noopener">{value}</a>
              : value}</dd>
          </div>
        ))}
      </dl>

      <div className="msg-detail__actions">
        {mailto && (
          <a href={mailto} className="adm-btn adm-btn--primary">
            <Mail size={14} /> Reply by email
          </a>
        )}
        {waUrl && (
          <a href={waUrl} target="_blank" rel="noreferrer" className="adm-btn adm-btn--secondary">
            <MessageCircle size={14} /> WhatsApp
          </a>
        )}
        {row.phone && (
          <a href={`tel:${row.phone}`} className="adm-btn adm-btn--secondary">
            <Phone size={14} /> Call
          </a>
        )}
      </div>

      <h3>Status</h3>
      <div className="msg-detail__status">
        {Object.entries(SUBMISSION_STATUS_LABEL).map(([s, label]) => (
          <button
            key={s}
            type="button"
            className={"adm-btn adm-btn--secondary" + (row.status === s ? " adm-btn--on" : "")}
            onClick={() => save({ status: s }, `Marked as ${label.toLowerCase()}`)}
            disabled={busy || row.status === s}
          >
            {row.status === s && <Check size={14} />} {label}
          </button>
        ))}
      </div>

      <h3>Admin note</h3>
      <textarea
        className="hb-input"
        rows={4}
        maxLength={5000}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        disabled={busy}
        placeholder="Private to the team, e.g. who called back and what was agreed."
      />
      {noteDirty && (
        <div style={{ marginTop: 8 }}>
          <button
            type="button"
            className="adm-btn adm-btn--secondary"
            onClick={() => save({ admin_note: note.trim() || null }, "Note saved")}
            disabled={busy}
          >
            <Save size={14} /> Save note
          </button>
        </div>
      )}
    </section>
  );
}
