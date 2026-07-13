import { SITE } from "../../config/site.js";
import Icon from "../ui/Icon.jsx";

/** Dark utility strip with four guarantees, sits above the footer. */
export default function BottomBenefits() {
  return (
    <section className="bbenefits" aria-label="Our guarantees">
      <div className="wrap bbenefits__inner">
        {SITE.bottomBenefits.map((b) => (
          <div className="bbenefit" key={b.title}>
            <span className="bbenefit__icon"><Icon name={b.icon} size={20} /></span>
            <span>
              <b>{b.title}</b>
              <p>{b.text}</p>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}