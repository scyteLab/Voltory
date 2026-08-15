import { AlertCircle, Ban, CheckCircle2, RotateCcw } from "lucide-react";
import { ORDER_STATUSES, TIMELINE_ORDER } from "../../config/orderStatus.js";

/**
 * Renders a horizontal progression: confirmed → processing → shipped → delivered.
 * The current status shows filled + emphasized; previous stages show a
 * completed check. Branch states (cancelled, refunded) render as a
 * separate banner at the top instead of trying to sit on the timeline.
 */
export default function OrderStatusTimeline({ status }) {
  // Special branch states — not on the linear timeline
  if (status === "cancelled") {
    return (
      <div className="adm-timeline adm-timeline--branch adm-timeline--cancelled">
        <span className="adm-timeline__branch-icon"><Ban size={16} /></span>
        <div>
          <b>Order cancelled</b>
          <small>This order will not be fulfilled. No further status changes are available.</small>
        </div>
      </div>
    );
  }
  if (status === "refunded") {
    return (
      <div className="adm-timeline adm-timeline--branch adm-timeline--refunded">
        <span className="adm-timeline__branch-icon"><RotateCcw size={16} /></span>
        <div>
          <b>Order refunded</b>
          <small>This delivered order has been refunded to the customer.</small>
        </div>
      </div>
    );
  }

  const currentOrder = ORDER_STATUSES[status]?.order ?? 0;

  return (
    <ol className="adm-timeline">
      {TIMELINE_ORDER.map((stage, i) => {
        const meta = ORDER_STATUSES[stage];
        const stageOrder = meta.order;
        const isCurrent = stage === status;
        const isDone = stageOrder < currentOrder;
        const cls =
          isCurrent ? "adm-timeline__step--on" :
          isDone    ? "adm-timeline__step--done" :
                      "adm-timeline__step--upcoming";
        return (
          <li key={stage} className={"adm-timeline__step " + cls}>
            <span className="adm-timeline__dot">
              {isDone ? <CheckCircle2 size={13} /> : isCurrent ? <AlertCircle size={13} /> : <span className="adm-timeline__dot-empty" />}
            </span>
            <span className="adm-timeline__label">{meta.label}</span>
            {i < TIMELINE_ORDER.length - 1 && <span className="adm-timeline__line" />}
          </li>
        );
      })}
    </ol>
  );
}