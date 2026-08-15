import { Check } from "lucide-react";

/**
 * Grid of "option cards" — richer than a plain radio, more compact
 * than swatches. Each card can render its own preview via a child
 * function or a static preview string.
 *
 * Props:
 *   options   — map { key: { label, preview?, ...anything else } }
 *   value     — currently-selected key
 *   onChange  — (key) => void
 *   label     — group label
 *   hint      — group helper text
 *   renderPreview — optional (opt, key) => JSX to render each preview
 *   columns   — grid columns override (default 3)
 */
export default function OptionCard({
  options, value, onChange, label, hint, renderPreview, columns = 3,
}) {
  return (
    <fieldset className="adm-optcards">
      <legend className="adm-optcards__legend">
        <span>{label}</span>
        {hint && <small>{hint}</small>}
      </legend>
      <div
        className="adm-optcards__grid"
        style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
      >
        {Object.entries(options).map(([key, opt]) => {
          const isOn = key === value;
          return (
            <label
              key={key}
              className={"adm-optcard" + (isOn ? " adm-optcard--on" : "")}
            >
              <input
                type="radio"
                name={label}
                value={key}
                checked={isOn}
                onChange={() => onChange(key)}
              />
              {isOn && <span className="adm-optcard__check"><Check size={11} strokeWidth={3} /></span>}
              <div className="adm-optcard__preview">
                {renderPreview ? renderPreview(opt, key) : (opt.preview || opt.label)}
              </div>
              <b className="adm-optcard__label">{opt.label}</b>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}