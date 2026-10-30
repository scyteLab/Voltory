import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft, Check, Clock, Inbox, Mail, MessageCircle, Phone, Save,
} from "lucide-react";
import {
  fetchMessagesForAdmin, fetchMessageStatusCounts, updateMessage,
} from "../../lib/contactMessagesAdmin.js";
import { adminToast } from "../../lib/adminToast.js";

/**
 * AdminMessages — /admin/messages
 *
 * Inbox for the public Contact form (table contact_messages).
 * List on the left, detail on the right (stacked on mobile).
 * From the detail the admin can change status, keep a private
 * note, and reply by email or WhatsApp.
 */
const STATUS_LABEL = { new: "New", replied: "Replied", closed: "Closed" };

function formatDate(iso) {
  return new Date(iso).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" });
}

function whatsappUrl(phone) {
  const digits = (phone || "").replace(/\D+/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits.startsWith("234") ? digits : "234" + digits.replace(/^0/, "")}`;
}

function mailtoUrl(msg) {
  const subject = `Re: ${msg.subject || "Your message to NAVEN"}`;
  const quoted = msg.message.split("\n").map((l) => `> ${l}`).join("\n");
  const body = `Hi ${msg.name},\n\n\n\n---\nYou wrote on ${formatDate(msg.created_at)}:\n${quoted}`;
  return `mailto:${msg.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export default function AdminMessages() {
  const [status, setStatus]     = useState("new");
  const [messages, setMessages] = useState([]);
  const [counts, setCounts]     = useState({ new: 0, replied: 0, closed: 0 });
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  const refreshCounts = useCallback(() => {
    fetchMessageStatusCounts().then((c) => c.ok && setCounts(c.counts));
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    const res = await fetchMessagesForAdmin({ status });
    setLoading(false);
    if (res.ok) {
      setMessages(res.messages);
      setError(null);
    } else {
      setError(res.error);
    }
    refreshCounts();
  }, [status, refreshCounts]);

  useEffect(() => { refresh(); }, [refresh]);

  const selected = messages.find((m) => m.id === selectedId) || null;

  // Keep the edited row in the list; it stays visible until the next
  // refresh even if its new status no longer matches the tab.
  function applyUpdate(updated) {
    setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    refreshCounts();
  }

  const TABS = [
    { id: "new",     label: "New",     count: counts.new },
    { id: "replied", label: "Replied", count: counts.replied },
    { id: "closed",  label: "Closed",  count: counts.closed },
    { id: "all",     label: "All",     count: counts.new + counts.replied + counts.closed },
  ];

  return (
    <div className="adm-page">
      <header className="adm-page__head">
        <div>
          <h1>Messages</h1>
          <p>Messages sent from the Contact page. Newest first.</p>
        </div>
      </header>

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

      {error && <div className="hb__err">Couldn't load messages: {error}</div>}

      {loading && messages.length === 0 ? (
        <div className="hb__loading">Loading messages…</div>
      ) : messages.length === 0 ? (
        <div className="cat-empty">
          <Inbox size={40} strokeWidth={1.2} />
          <h2>{status === "all" ? "No messages yet" : `No ${STATUS_LABEL[status].toLowerCase()} messages`}</h2>
          <p>
            {status === "new"
              ? "When someone sends the Contact form, it appears here."
              : "Nothing to see in this bucket right now."}
          </p>
        </div>
      ) : (
        <div className={"msg-layout" + (selected ? " msg-layout--detail" : "")}>
          <ul className="msg-list">
            {messages.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  className={"msg-row" + (m.id === selectedId ? " msg-row--on" : "") + (m.status === "new" ? " msg-row--new" : "")}
                  onClick={() => setSelectedId(m.id)}
                >
                  <div className="msg-row__top">
                    <b>{m.name}</b>
                    <span className={`msg-chip msg-chip--${m.status}`}>{STATUS_LABEL[m.status]}</span>
                  </div>
                  <div className="msg-row__subject">{m.subject || "No subject"}</div>
                  <div className="msg-row__preview">{m.message}</div>
                  <div className="msg-row__date"><Clock size={11} /> {formatDate(m.created_at)}</div>
                </button>
              </li>
            ))}
          </ul>

          {selected ? (
            <MessageDetail
              key={selected.id}
              msg={selected}
              onBack={() => setSelectedId(null)}
              onUpdated={applyUpdate}
            />
          ) : (
            <div className="msg-detail msg-detail--empty">
              <Inbox size={32} strokeWidth={1.2} />
              <p>Select a message to read it.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MessageDetail({ msg, onBack, onUpdated }) {
  const [note, setNote] = useState(msg.admin_note || "");
  const [busy, setBusy] = useState(false);
  const noteDirty = note !== (msg.admin_note || "");
  const waUrl = whatsappUrl(msg.phone);

  async function save(patch, okText) {
    setBusy(true);
    const res = await updateMessage(msg.id, patch);
    setBusy(false);
    if (!res.ok) {
      adminToast.error(`Couldn't save: ${res.error}`);
      return;
    }
    adminToast.success(okText);
    onUpdated(res.message);
  }

  return (
    <section className="msg-detail">
      <button type="button" className="msg-detail__back" onClick={onBack}>
        <ArrowLeft size={14} /> All messages
      </button>

      <header className="msg-detail__head">
        <div>
          <span className={`msg-chip msg-chip--${msg.status}`}>{STATUS_LABEL[msg.status]}</span>
          <h2>{msg.subject || "No subject"}</h2>
          <p className="msg-detail__from">
            <b>{msg.name}</b>
            {msg.email && <> · <a href={`mailto:${msg.email}`}>{msg.email}</a></>}
            {msg.phone && <> · <a href={`tel:${msg.phone}`}>{msg.phone}</a></>}
          </p>
          <p className="msg-detail__date"><Clock size={12} /> {formatDate(msg.created_at)}</p>
        </div>
      </header>

      <div className="msg-detail__body">{msg.message}</div>

      <div className="msg-detail__actions">
        {msg.email && (
          <a href={mailtoUrl(msg)} className="adm-btn adm-btn--primary">
            <Mail size={14} /> Reply by email
          </a>
        )}
        {waUrl && (
          <a href={waUrl} target="_blank" rel="noreferrer" className="adm-btn adm-btn--secondary">
            <MessageCircle size={14} /> WhatsApp
          </a>
        )}
        {msg.phone && (
          <a href={`tel:${msg.phone}`} className="adm-btn adm-btn--secondary">
            <Phone size={14} /> Call
          </a>
        )}
      </div>

      <h3>Status</h3>
      <div className="msg-detail__status">
        {Object.entries(STATUS_LABEL).map(([s, label]) => (
          <button
            key={s}
            type="button"
            className={"adm-btn adm-btn--secondary" + (msg.status === s ? " adm-btn--on" : "")}
            onClick={() => save({ status: s }, `Marked as ${label.toLowerCase()}`)}
            disabled={busy || msg.status === s}
          >
            {msg.status === s && <Check size={14} />} {label}
          </button>
        ))}
      </div>

      <h3>Admin note</h3>
      <textarea
        className="hb-input"
        rows={4}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        disabled={busy}
        placeholder="Private to the team, e.g. who replied and what was promised."
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
