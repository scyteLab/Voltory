import { Link } from "react-router-dom";
import { Info } from "lucide-react";

/**
 * Shown on My Account and My Orders when the server reports guest
 * orders for this phone placed BEFORE the account existed. Those stay
 * hidden from the account (anyone could sign up with a phone number
 * without an SMS check) and remain reachable with Track Order.
 */
export const EARLIER_ORDERS_TEXT =
  "Orders you placed before creating this account aren't shown here for your security. " +
  "You can still view them with Track Order (order ID + phone).";

export default function EarlierOrdersNotice({ show }) {
  if (!show) return null;
  return (
    <p className="earlier-orders" role="note">
      <Info size={15} aria-hidden="true" />
      <span>
        Orders you placed before creating this account aren't shown here for your security.
        You can still view them with <Link to="/track-order">Track Order</Link> (order ID + phone).
      </span>
    </p>
  );
}
