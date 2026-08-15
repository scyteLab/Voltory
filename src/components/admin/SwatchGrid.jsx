import { Check } from "lucide-react";

/**
 * Grid of color swatches. Each swatch is a big colored square with
 * a label; the selected one shows a check overlay in the swatch's
 * contrast color.
 *
 * Props:
 *   options   — object map { key: { label, hex, ink? } }
 *   value     — the currently-selected key
 *   onChange  — (key) => void
 *   label     — group label
 *   hint      — helper text below the label
 */
export default function SwatchGrid({ options, value, onChange, label, hint }) {
  return (
    <fieldset className="adm-swatches">
      <legend className="adm-swatches__legend">
        <span>{label}</span>
        {hint && <small>{hint}</small>}
      </legend>
      <div className="adm-swatches__grid">
        {Object.entries(options).map(([key, opt]) => {
          const isOn = key === value;
          const ink = opt.ink || "#FFFFFF";
          return (
            <label
              key={key}
              className={"adm-swatch" + (isOn ? " adm-swatch--on" : "")}
              title={opt.label}
            >
              <input
                type="radio"
                name={label}
                value={key}
                checked={isOn}
                onChange={() => onChange(key)}
              />
              <span
                className="adm-swatch__color"
                style={{ background: opt.hex, color: ink }}
                aria-hidden="true"
              >
                {isOn && <Check size={18} strokeWidth={3} />}
              </span>
              <span className="adm-swatch__label">{opt.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}