import { MapPin, Plus, Star } from "lucide-react";

/**
 * AddressPicker
 *
 * Shown in the Checkout page when a signed-in customer has one or
 * more saved addresses. Radio-style selection of an existing
 * address, plus a "New address" toggle that reveals the manual
 * form fields.
 *
 * When `selectedId` is null, the caller renders the New Address
 * form. When `selectedId` is an address's id, the form is hidden
 * and the picked address is used at order time.
 */
export default function AddressPicker({ addresses, selectedId, onSelect, onNew }) {
  if (!addresses || addresses.length === 0) return null;

  return (
    <div className="ck-addrpicker">
      <div className="ck-addrpicker__label">Deliver to</div>

      <ul className="ck-addrpicker__list">
        {addresses.map((a) => {
          const picked = selectedId === a.id;
          return (
            <li key={a.id}>
              <label className={"ck-addropt" + (picked ? " ck-addropt--picked" : "")}>
                <input
                  type="radio"
                  name="ck-address-picker"
                  checked={picked}
                  onChange={() => onSelect(a.id)}
                />
                <span className="ck-addropt__icon"><MapPin size={16} /></span>
                <span className="ck-addropt__body">
                  <span className="ck-addropt__top">
                    {a.label && <b className="ck-addropt__label">{a.label}</b>}
                    {a.is_default && (
                      <span className="ck-addropt__default"><Star size={10} /> Default</span>
                    )}
                  </span>
                  <b className="ck-addropt__name">{a.name || "—"}</b>
                  <span className="ck-addropt__addr">
                    {a.street}, {a.lga}, {a.state}
                  </span>
                  {a.landmark && (
                    <small className="ck-addropt__land">Landmark: {a.landmark}</small>
                  )}
                </span>
              </label>
            </li>
          );
        })}

        <li>
          <label
            className={
              "ck-addropt ck-addropt--new" +
              (selectedId === null ? " ck-addropt--picked" : "")
            }
          >
            <input
              type="radio"
              name="ck-address-picker"
              checked={selectedId === null}
              onChange={() => onNew()}
            />
            <span className="ck-addropt__icon ck-addropt__icon--new"><Plus size={16} /></span>
            <span className="ck-addropt__body">
              <b>Deliver to a different address</b>
              <small>Enter a new address below</small>
            </span>
          </label>
        </li>
      </ul>
    </div>
  );
}