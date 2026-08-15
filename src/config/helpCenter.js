/**
 * ============================================================
 *  HELP CENTER CONTENT
 *  Six topics with real Q&A content. Edit any answer here —
 *  the Help Center page reads from this file. When the admin
 *  CMS lands, this becomes a database table; the page does not change.
 * ============================================================
 */

export const HELP_TOPICS = [
  {
    id: "ordering",
    icon: "ShoppingCart",
    label: "Ordering",
    blurb: "Placing an order, payment options, order changes.",
    items: [
      {
        q: "Do I need to create an account before I can shop?",
        a: "No. You can shop and check out as a guest. When you place your first order, we automatically create an account for you using the phone number you provide at checkout — no signup form, no password. Next time you visit, enter the same phone number on the Sign In page and we’ll send you a one-time code.",
      },
      {
        q: "What payment methods do you accept?",
        a: "We accept Card (Visa, Mastercard, Verve via Paystack), Bank Transfer (one-time account number generated at checkout), Pay on Delivery for orders within Lagos, and USSD from your bank app.",
      },
      {
        q: "Can I change or cancel my order?",
        a: "Orders can be changed or cancelled while they are still in the “Confirmed” stage — before our team begins processing. Once an order moves to “Processing,” it is being prepared for dispatch and can no longer be cancelled directly. Contact us on WhatsApp and we’ll do our best to help.",
      },
      {
        q: "Are all your products original?",
        a: "Every product on NAVEN is sourced from authorised distributors and comes with the full manufacturer warranty. We do not stock refurbished, parallel-import, or unbranded items. If anything ever arrives that doesn’t look authentic, contact us within 7 days and we’ll replace or refund it immediately.",
      },
      {
        q: "How do I apply a coupon or discount code?",
        a: "Add your items to the cart, then enter the code in the “Have a coupon?” field. The discount appears in the order summary before you pay. New customers get 10% off their first order with the code WELCOME10 (already applied automatically).",
      },
    ],
  },
  {
    id: "delivery",
    icon: "Truck",
    label: "Delivery",
    blurb: "Delivery times, zones, fees, and tracking.",
    items: [
      {
        q: "How long does delivery take?",
        a: "Lagos, Abuja FCT and Port Harcourt: 1–3 working days. All other states: 3–7 working days. Large appliances (refrigerators, washing machines, ACs) may take an extra 1–2 days for handling. You’ll receive SMS updates at each stage — Confirmed, Processing, Out for Delivery, Delivered.",
      },
      {
        q: "How much does delivery cost?",
        a: "Standard delivery is ₦5,500 nationwide. Orders above ₦150,000 ship FREE — the discount is applied automatically at checkout. Large or fragile items in remote locations may attract a small additional handling fee, which we’ll confirm by phone before dispatch.",
      },
      {
        q: "Where can I track my order?",
        a: "Visit our Track Order page and enter your order ID (starts with VLT-) — you’ll find it in the SMS confirmation we sent after checkout. If you’re signed in, your orders are also listed in My Account → My Orders with live status.",
      },
      {
        q: "Do you deliver to my area?",
        a: "Yes — we deliver to all 36 states and the FCT. Some very remote locations may require a small additional handling fee, which we’ll communicate by phone before dispatch.",
      },
      {
        q: "What if I’m not available when delivery arrives?",
        a: "Our rider will call you 30–60 minutes before arrival. If you’re unavailable, you can nominate someone else to receive the package on your behalf, or we’ll re-schedule for the next working day. Two failed delivery attempts will return the order to our warehouse; a re-delivery fee may apply.",
      },
    ],
  },
  {
    id: "returns",
    icon: "Repeat",
    label: "Returns & Refunds",
    blurb: "Return policy, refund timelines, and damaged items.",
    items: [
      {
        q: "What is your return policy?",
        a: "We offer a 7-day return window for eligible items. To qualify, the product must be in its original packaging, unused, and with all accessories. Some categories — personal care items, software, and consumables — are non-returnable for hygiene and licensing reasons.",
      },
      {
        q: "How do I start a return?",
        a: "Contact us via WhatsApp or the Contact page with your order ID and reason for return. We’ll arrange pickup (typically free within Lagos) and process your refund once we inspect the item.",
      },
      {
        q: "How long do refunds take?",
        a: "Once we receive and inspect the returned item, refunds are processed within 5–7 working days. Card payments are refunded to the original card; bank transfers are refunded to the originating account. Pay-on-Delivery orders are refunded by bank transfer to an account you provide.",
      },
      {
        q: "My item arrived damaged — what do I do?",
        a: "Take a photo of the damaged item and its packaging, and contact us within 48 hours on WhatsApp. We’ll arrange a free replacement or refund without you having to send the item back first.",
      },
      {
        q: "Can I exchange an item for a different one?",
        a: "Yes, within the 7-day window. We’ll arrange pickup of the original and dispatch of the replacement; if there’s a price difference, we’ll either refund the difference or send a payment link for the top-up.",
      },
    ],
  },
  {
    id: "warranty",
    icon: "ShieldCheck",
    label: "Warranty",
    blurb: "Manufacturer warranty, claims, repairs.",
    items: [
      {
        q: "Are your products covered by warranty?",
        a: "Yes. Every product on NAVEN carries the manufacturer’s official warranty — typically 1 year on most appliances, and up to 10 years on AC compressors from certain brands. The warranty period is shown on each product page.",
      },
      {
        q: "How do I make a warranty claim?",
        a: "Contact us first with your order ID and a description of the issue. We’ll route the claim to the authorised service centre for your brand — there’s usually one in every major city. For Lagos, we can often arrange in-home diagnostics for major appliances.",
      },
      {
        q: "Does the warranty cover accidental damage?",
        a: "Manufacturer warranties cover defects in materials and workmanship — not accidental damage, misuse, power surge damage (a stabilizer would have helped here), or normal wear and tear. We can usually still arrange a paid repair via the service centre.",
      },
      {
        q: "What happens if my product fails just outside the warranty period?",
        a: "Contact us anyway. Many manufacturers extend goodwill repairs for failures very close to warranty expiry, particularly for premium products. We’ll advocate on your behalf.",
      },
    ],
  },
  {
    id: "payments",
    icon: "CreditCard",
    label: "Payments & Security",
    blurb: "Card safety, transfer process, POD verification.",
    items: [
      {
        q: "Is it safe to pay with my card on NAVEN?",
        a: "Yes. We never see or store your card details — all card payments are processed by Paystack, the most widely-used PCI-DSS Level 1 certified payment processor in Nigeria. The same security that protects your bank app protects your NAVEN checkout.",
      },
      {
        q: "How does bank transfer work?",
        a: "We generate a unique virtual account number for your order. Transfer the exact amount, and confirmation is automatic within minutes. No need to send proof of payment — our system reconciles it directly.",
      },
      {
        q: "Why does Pay on Delivery require OTP verification?",
        a: "POD orders are reserved stock that costs us money to hold. The OTP confirms you actually intend to receive the order. Without verification, fraudulent or accidental POD orders waste rider time and tie up inventory.",
      },
      {
        q: "When am I charged?",
        a: "Card and bank transfer: at checkout. Pay on Delivery: only when our rider hands you the order. Refunds for cancelled orders are processed within 24 hours.",
      },
    ],
  },
  {
    id: "account",
    icon: "User",
    label: "My Account",
    blurb: "Sign in, account details, password reset.",
    items: [
      {
        q: "I don’t remember signing up — do I have an account?",
        a: "If you’ve ever placed an order with us, yes. We create your account automatically using the phone number you used at checkout. To sign in, go to the Sign In page, enter that phone number, and we’ll send you a one-time code to verify.",
      },
      {
        q: "I didn’t receive my OTP code — what do I do?",
        a: "Check that your phone number was entered correctly (the format we use is 0803 123 4567). Codes are delivered by SMS and usually arrive within 60 seconds. If it still hasn’t arrived, click “Resend code” after 30 seconds. If problems persist, contact us — we can help verify your identity manually.",
      },
      {
        q: "Can I change my phone number?",
        a: "Yes. While signed in, go to My Account and contact us — changing the phone number that identifies your account is a sensitive operation, so we handle it manually to protect against account takeover. We’ll verify your identity using both the old and new numbers before making the change.",
      },
      {
        q: "What if someone else uses my phone number?",
        a: "Every sign-in requires the one-time code sent only to your number. As long as you control your SIM, your account is protected. If you ever lose your phone, contact us immediately so we can suspend the account.",
      },
      {
        q: "How do I delete my account?",
        a: "Email us at " + "support@mynaven.com" + " from the email address linked to your account, and we’ll process the deletion within 7 days. Note: order history is retained for accounting purposes per Nigerian tax law, but no personal data remains visible after deletion.",
      },
    ],
  },
];

export function findTopic(id) {
  return HELP_TOPICS.find((t) => t.id === id) || null;
}