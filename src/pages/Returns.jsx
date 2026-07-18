import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Home as HomeIcon } from "lucide-react";
import { SITE } from "../config/site.js";
import { useStore } from "../context/StoreContext.jsx";

export default function Returns() {
  const { requestCall } = useStore();
  useEffect(() => {
    const prev = document.title;
    document.title = `Returns & Refunds — ${SITE.name}`;
    return () => { document.title = prev; };
  }, []);

  return (
    <main className="wrap mkt-page">
      <nav className="crumb" aria-label="Breadcrumb">
        <Link to="/"><HomeIcon size={13} /> Home</Link>
        <ChevronRight size={12} />
        <span>Returns &amp; Refunds</span>
      </nav>

      <div className="section-head" style={{ marginTop: 14 }}>
        <h2>Returns &amp; Refund Policy</h2>
        <p style={{ fontSize: 12.5, color: "var(--mut)", margin: 0 }}>
          Our commitment to your satisfaction — clear and fair return guidelines
        </p>
      </div>

      <div className="legal-page">
        <p className="legal-updated">Last updated: 1 June 2026</p>

        <h2>1. Return Window</h2>
        <p>
          At {SITE.name}, we want you to be completely satisfied with every purchase. If you are
          not happy with a product, you may request a return within <strong>7 days</strong> of
          delivery. The return window begins on the date the item is delivered to you as confirmed
          by our logistics partner.
        </p>
        <p>
          To be eligible for a return, you must initiate the return request within this 7-day
          period by contacting our customer support team. Requests submitted after the return
          window has closed will not be accepted.
        </p>

        <h2>2. Eligibility Conditions</h2>
        <p>To qualify for a return, the following conditions must be met:</p>
        <ul>
          <li>The product must be in its original, unused, and undamaged condition.</li>
          <li>All original packaging, tags, labels, and accessories (including manuals, cables, remote controls, and free gifts) must be intact and included.</li>
          <li>The product must not show signs of installation, use, or physical damage caused by the customer.</li>
          <li>The product's serial number and barcodes must be intact and match our records.</li>
          <li>You must provide a valid proof of purchase (order confirmation email or receipt).</li>
          <li>The product must not fall under the non-returnable items category (see Section 3).</li>
        </ul>

        <h2>3. Non-Returnable Items</h2>
        <p>
          For hygiene, safety, and practical reasons, the following items cannot be returned
          or exchanged once delivered:
        </p>
        <ul>
          <li>Personal care and grooming appliances (hair dryers, shavers, trimmers, electric toothbrushes) once opened or used.</li>
          <li>Products with broken seals, removed tamper-proof stickers, or opened software/media packaging.</li>
          <li>Consumable items such as batteries, bulbs, filters, and cartridges.</li>
          <li>Customised or made-to-order products.</li>
          <li>Items purchased during clearance sales marked as "final sale" or "non-returnable".</li>
          <li>Gift cards and promotional vouchers.</li>
          <li>Products with physical damage caused by misuse, improper installation, or accidents after delivery.</li>
        </ul>

        <h2>4. How to Request a Return</h2>
        <p>Follow these steps to initiate a return:</p>
        <ul>
          <li>
            <strong>Step 1 — Contact us:</strong> Reach out to our customer support team via
            email at <a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a>, call
            us at <a href={`tel:${SITE.phone.replace(/\s/g, "")}`} onClick={(e) => { e.preventDefault(); requestCall(SITE.phone); }}>{SITE.phone}</a>, or message us
            on <a href={SITE.whatsappLink} target="_blank" rel="noreferrer">WhatsApp</a>.
            Provide your order number and the reason for the return.
          </li>
          <li>
            <strong>Step 2 — Receive authorisation:</strong> Our team will review your request and,
            if eligible, issue a Return Merchandise Authorisation (RMA) number along with return
            instructions. Returns without an RMA number will not be processed.
          </li>
          <li>
            <strong>Step 3 — Pack the item:</strong> Carefully repack the product in its original
            packaging with all accessories, manuals, and bundled items. Include the RMA number
            visibly on the package.
          </li>
          <li>
            <strong>Step 4 — Ship or schedule pickup:</strong> Depending on your location and the
            product, we will either arrange a pickup from your address or provide a drop-off
            location. Return shipping costs may apply for change-of-mind returns (see Section 5).
          </li>
          <li>
            <strong>Step 5 — Inspection and processing:</strong> Once we receive the returned
            item, our quality assurance team will inspect it within 3 business days. You will be
            notified of the outcome via email or SMS.
          </li>
        </ul>

        <h2>5. Refund Policy</h2>
        <h3>5.1 Refund Eligibility</h3>
        <p>
          Refunds are issued only after the returned product passes our quality inspection and
          meets all eligibility criteria. Refunds are processed to the original payment method
          used for the purchase.
        </p>
        <h3>5.2 Refund Timeline</h3>
        <ul>
          <li><strong>Bank transfers and cards:</strong> Refunds are processed within 5-10 business days after approval. Your bank may take additional time to reflect the credit in your account.</li>
          <li><strong>Wallet credits:</strong> If you opt for a {SITE.name} store credit, the refund is applied to your account within 24 hours of approval.</li>
          <li><strong>Pay-on-Delivery orders:</strong> Refunds for cash payments are processed via bank transfer. You will need to provide your bank account details.</li>
        </ul>
        <h3>5.3 Partial Refunds</h3>
        <p>
          In certain situations, partial refunds may be granted if the returned product shows minor
          signs of use, has missing accessories, or has damaged packaging. The deduction amount will
          be communicated to you before the refund is processed.
        </p>
        <h3>5.4 Return Shipping Costs</h3>
        <p>
          For change-of-mind returns (where the product is not defective), return shipping costs are
          the responsibility of the customer. For defective or incorrect items, {SITE.name} covers
          all return shipping costs.
        </p>

        <h2>6. Exchange Policy</h2>
        <p>
          We offer exchanges subject to product availability. If you would like to exchange a product
          for a different model, colour, or size, please contact us within the 7-day return window.
        </p>
        <ul>
          <li>Exchanges are subject to the same eligibility conditions as returns.</li>
          <li>If the replacement product costs more than the original, you will need to pay the price difference.</li>
          <li>If the replacement costs less, the difference will be refunded to your original payment method or applied as store credit.</li>
          <li>If the desired replacement is out of stock, you may choose to wait for restocking or opt for a full refund instead.</li>
        </ul>

        <h2>7. Damaged or Defective Items</h2>
        <p>
          We take quality seriously. If you receive a product that is damaged during transit,
          defective, or materially different from what you ordered, please notify us within
          48 hours of delivery with the following:
        </p>
        <ul>
          <li>Clear photographs of the damage or defect.</li>
          <li>A photograph of the shipping label and outer packaging.</li>
          <li>Your order number and a brief description of the issue.</li>
        </ul>
        <p>
          For confirmed damaged or defective items, {SITE.name} will:
        </p>
        <ul>
          <li>Arrange free pickup of the item from your delivery address.</li>
          <li>Provide a replacement at no additional cost, subject to availability.</li>
          <li>Issue a full refund if a replacement is not available or if you prefer a refund.</li>
        </ul>
        <p>
          We may request that you return the damaged item before a replacement or refund is
          processed. In some cases, for lower-value items, we may issue a refund or replacement
          without requiring the item to be returned.
        </p>

        <h2>8. Warranty Claims</h2>
        <p>
          All products sold on {SITE.name} come with the manufacturer's official warranty. Warranty
          coverage varies by brand and product category. Warranty details are specified on the
          product page and included in the packaging.
        </p>
        <h3>8.1 How to Make a Warranty Claim</h3>
        <ul>
          <li>Contact our customer support team with your order number, product details, and a description of the issue.</li>
          <li>Warranty claims may be handled directly by {SITE.name} or referred to the manufacturer's authorised service centre, depending on the product and brand.</li>
          <li>You may be required to provide proof of purchase and photographs or videos demonstrating the defect.</li>
        </ul>
        <h3>8.2 What Warranty Does Not Cover</h3>
        <ul>
          <li>Damage caused by misuse, accidents, improper installation, or unauthorised modifications.</li>
          <li>Normal wear and tear, including cosmetic damage such as scratches and dents.</li>
          <li>Damage caused by power surges, voltage fluctuations, or use of incorrect power supply.</li>
          <li>Products with removed, altered, or illegible serial numbers.</li>
          <li>Consumable parts such as batteries, filters, and bulbs unless covered by specific manufacturer terms.</li>
        </ul>

        <h2>9. Cancellations</h2>
        <p>
          You may cancel an order before it has been dispatched for a full refund. Once an order
          has been shipped, it cannot be cancelled — you will need to follow the return process
          outlined above after delivery.
        </p>
        <p>
          To cancel an order, contact us immediately
          at <a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a> or
          via <a href={SITE.whatsappLink} target="_blank" rel="noreferrer">WhatsApp</a> with
          your order number.
        </p>

        <h2>10. Contact Us</h2>
        <p>
          If you have questions about our Returns and Refund Policy, need help initiating a return,
          or want to check the status of a return or refund, our team is ready to help:
        </p>
        <ul>
          <li>Email: <a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a></li>
          <li>Phone: <a href={`tel:${SITE.phone.replace(/\s/g, "")}`} onClick={(e) => { e.preventDefault(); requestCall(SITE.phone); }}>{SITE.phone}</a></li>
          <li>WhatsApp: <a href={SITE.whatsappLink} target="_blank" rel="noreferrer">{SITE.whatsapp}</a></li>
        </ul>
        <p>
          Our customer support team is available Monday to Saturday, 8:00 AM to 8:00 PM (WAT).
          We aim to respond to all enquiries within 24 hours.
        </p>
      </div>
    </main>
  );
}
