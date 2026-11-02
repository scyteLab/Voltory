/**
 * Honeypot: off-screen and hidden from screen readers; bots fill it.
 *
 * The name and autocomplete value are chosen so browser autofill and
 * password managers leave it alone: "website" / "url" style names get
 * filled by Safari contact cards and identity managers, and Chrome
 * ignores autocomplete="off". "new-password" is never autofilled.
 */
export default function HoneypotField({ value, onChange }) {
  return (
    <div aria-hidden="true" className="contact-hp">
      <label>
        Leave this empty
        <input
          type="text"
          name="nv_hp_field"
          tabIndex={-1}
          autoComplete="new-password"
          data-lpignore="true"
          data-1p-ignore="true"
          data-bwignore="true"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
    </div>
  );
}
