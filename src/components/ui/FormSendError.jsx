import { AlertTriangle } from "lucide-react";
import { SITE } from "../../config/site.js";

/**
 * Error block shown when a public form couldn't be saved, with
 * WhatsApp as the fallback so the visitor is never stuck.
 */
export default function FormSendError({ rateLimited = false, what = "message" }) {
  return (
    <div className="contact-error" role="alert">
      <AlertTriangle size={18} />
      <div>
        <b>
          {rateLimited
            ? "You've just sent this. Please wait 30 seconds before trying again."
            : `Sorry, your ${what} couldn't be sent.`}
        </b>
        <p>
          Please try again, or message us directly on{" "}
          <a href={SITE.whatsappLink} target="_blank" rel="noreferrer">
            WhatsApp ({SITE.whatsapp})
          </a>.
        </p>
      </div>
    </div>
  );
}
