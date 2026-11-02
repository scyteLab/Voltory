import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchMessageStatusCounts } from "../../lib/contactMessagesAdmin.js";
import { countNewSubscribers, fetchNewSubmissionCountsByType } from "../../lib/inboxAdmin.js";
import { FORM_TYPES } from "../../config/formTypes.js";
import MessagesTab from "../../components/admin/inbox/MessagesTab.jsx";
import NewsletterTab from "../../components/admin/inbox/NewsletterTab.jsx";
import SubmissionsTab from "../../components/admin/inbox/SubmissionsTab.jsx";

/**
 * AdminInbox — /admin/inbox?tab=<tab>&id=<row id>
 *
 * Everything the public forms send in, one tab per form:
 *   messages     → contact_messages
 *   newsletter   → newsletter_subscribers
 *   installation / affiliate / careers → form_submissions (by form_type)
 *
 * The notification emails link here with ?tab=…&id=… so the row
 * opens straight away. (/admin/messages redirects here.)
 */
const TABS = [
  { id: "messages",   label: "Messages" },
  { id: "newsletter", label: "Newsletter" },
  ...Object.entries(FORM_TYPES).map(([id, cfg]) => ({ id, label: cfg.label })),
];

export default function AdminInbox() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.id === params.get("tab")) ? params.get("tab") : "messages";
  const initialId = params.get("id");
  const [badges, setBadges] = useState({});

  const refreshBadges = useCallback(async () => {
    const [msgs, subs, newsletter] = await Promise.all([
      fetchMessageStatusCounts(),
      fetchNewSubmissionCountsByType(),
      countNewSubscribers(),
    ]);
    setBadges({
      messages: msgs.counts?.new || 0,
      newsletter,
      ...subs.counts,
    });
  }, []);

  useEffect(() => { refreshBadges(); }, [refreshBadges]);

  function openTab(id) {
    setParams({ tab: id });
  }

  const content =
    tab === "messages"   ? <MessagesTab key={`m-${initialId}`} initialId={initialId} onChanged={refreshBadges} /> :
    tab === "newsletter" ? <NewsletterTab onChanged={refreshBadges} /> :
    <SubmissionsTab key={`${tab}-${initialId}`} formType={tab} initialId={initialId} onChanged={refreshBadges} />;

  return (
    <div className="adm-page">
      <header className="adm-page__head">
        <div>
          <h1>Inbox</h1>
          <p>Everything sent through the website's forms. Newest first.</p>
        </div>
      </header>

      <nav className="inbox-tabs" role="tablist" aria-label="Inbox sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={"inbox-tab" + (tab === t.id ? " inbox-tab--on" : "")}
            onClick={() => openTab(t.id)}
          >
            {t.label}
            {badges[t.id] > 0 && <span className="inbox-tab__count">{badges[t.id]}</span>}
          </button>
        ))}
      </nav>

      {content}
    </div>
  );
}
