import { MessageCircle } from "lucide-react";
import { SITE } from "../../config/site.js";

export default function WhatsAppBubble() {
  return (
    <a className="wa" href={SITE.whatsappLink} target="_blank" rel="noreferrer">
      <MessageCircle size={18} />
      <span>
        <small>Need help choosing?</small>
        Chat on WhatsApp
      </span>
    </a>
  );
}
