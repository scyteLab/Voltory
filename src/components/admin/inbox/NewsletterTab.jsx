import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Inbox } from "lucide-react";
import {
  downloadSubscribersCsv, fetchSubscribersForAdmin, markNewsletterSeen, setSubscriberStatus,
} from "../../../lib/inboxAdmin.js";
import { adminToast } from "../../../lib/adminToast.js";
import { formatDate } from "./inboxUtils.js";

/**
 * NewsletterTab — Admin → Inbox → Newsletter
 *
 * Signups from the Footer and the Blog page (newsletter_subscribers).
 * A list with search, a status filter, Export CSV (exports what's
 * shown) and a per-row unsubscribe / resubscribe.
 */
export default function NewsletterTab({ onChanged }) {
  const [status, setStatus]   = useState("subscribed");
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [query, setQuery]     = useState("");
  const [busyId, setBusyId]   = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const res = await fetchSubscribersForAdmin({ status });
    setLoading(false);
    if (res.ok) {
      setRows(res.rows);
      setError(null);
    } else {
      setError(res.error);
    }
  }, [status]);

  useEffect(() => { refresh(); }, [refresh]);

  // Opening this tab clears its part of the sidebar badge.
  useEffect(() => {
    markNewsletterSeen();
    onChanged?.();
  }, [onChanged]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? rows.filter((r) => r.email.includes(q) || (r.source || "").includes(q)) : rows;
  }, [rows, query]);

  async function toggle(row) {
    const next = row.status === "subscribed" ? "unsubscribed" : "subscribed";
    setBusyId(row.id);
    const res = await setSubscriberStatus(row.id, next);
    setBusyId(null);
    if (!res.ok) {
      adminToast.error(`Couldn't save: ${res.error}`);
      return;
    }
    adminToast.success(next === "subscribed" ? "Resubscribed" : "Unsubscribed");
    setRows((prev) => prev.map((r) => (r.id === row.id ? res.row : r)));
  }

  const FILTERS = [
    { id: "subscribed",   label: "Subscribed" },
    { id: "unsubscribed", label: "Unsubscribed" },
    { id: "all",          label: "All" },
  ];

  return (
    <div>
      <div className="inbox-toolbar">
        <div className="revq-tabs" role="tablist">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={status === f.id}
              className={"revq-tab" + (status === f.id ? " revq-tab--on" : "")}
              onClick={() => setStatus(f.id)}
            >
              {f.label}
              {status === f.id && rows.length > 0 && <span className="revq-tab__count">{rows.length}</span>}
            </button>
          ))}
        </div>
        <div className="inbox-toolbar__right">
          <input
            className="hb-input inbox-search"
            type="search"
            placeholder="Search email or source"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            type="button"
            className="adm-btn adm-btn--primary"
            onClick={() => downloadSubscribersCsv(shown)}
            disabled={shown.length === 0}
          >
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {error && <div className="hb__err">Couldn't load subscribers: {error}</div>}

      {loading && rows.length === 0 ? (
        <div className="hb__loading">Loading subscribers…</div>
      ) : shown.length === 0 ? (
        <div className="cat-empty">
          <Inbox size={40} strokeWidth={1.2} />
          <h2>No subscribers here</h2>
          <p>Signups from the footer and the Blog page appear here.</p>
        </div>
      ) : (
        <div className="inbox-table-wrap">
          <table className="inbox-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Source</th>
                <th>Topics</th>
                <th>Signed up</th>
                <th>Status</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id}>
                  <td><a href={`mailto:${r.email}`}>{r.email}</a></td>
                  <td>{r.source}</td>
                  <td className="inbox-table__topics">{(r.topics || []).join(", ") || "—"}</td>
                  <td>{formatDate(r.created_at)}</td>
                  <td>
                    <span className={`msg-chip msg-chip--${r.status === "subscribed" ? "replied" : "closed"}`}>
                      {r.status === "subscribed" ? "Subscribed" : "Unsubscribed"}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="adm-btn adm-btn--secondary adm-btn--sm"
                      onClick={() => toggle(r)}
                      disabled={busyId === r.id}
                    >
                      {r.status === "subscribed" ? "Unsubscribe" : "Resubscribe"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
