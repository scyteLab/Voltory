import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Home as HomeIcon } from "lucide-react";
import { SITE } from "../config/site.js";

export default function Terms() {
  useEffect(() => {
    const prev = document.title;
    document.title = `Terms & Conditions — ${SITE.name}`;
    return () => { document.title = prev; };
  }, []);

  return (
    <main className="wrap mkt-page">
      <nav className="crumb" aria-label="Breadcrumb">
        <Link to="/"><HomeIcon size={13} /> Home</Link>
        <ChevronRight size={12} />
        <span>Terms &amp; Conditions</span>
      </nav>

      <div className="section-head" style={{ marginTop: 14 }}>
        <h2>Terms &amp; Conditions</h2>
        <p style={{ fontSize: 12.5, color: "var(--mut)", margin: 0 }}>
          Please read these terms carefully before using {SITE.name}
        </p>
      </div>

      <div className="legal-page">
        <p className="legal-updated">Last updated: 1 June 2026</p>

        <h2>1. Acceptance of Terms</h2>
        <p>
          Welcome to {SITE.name}. By accessing or using our website, mobile applications,
          or any services provided by {SITE.legalName} ("we", "us", "our"), you agree to be
          bound by these Terms and Conditions. If you do not agree with any part of these
          terms, you must not use our platform. Your continued use of {SITE.name} after any
          modifications to these terms constitutes acceptance of those changes.
        </p>
        <p>
          These terms apply to all visitors, registered users, and customers who access or
          use {SITE.name} in any capacity, including browsing, purchasing products, or
          interacting with our content.
        </p>

        <h2>2. Account Registration</h2>
        <p>
          To place orders and access certain features, you may need to create an account.
          You agree to provide accurate, current, and complete information during registration
          and to keep your account details up to date.
        </p>
        <ul>
          <li>You are responsible for maintaining the confidentiality of your login credentials.</li>
          <li>You must not share your account with any other person.</li>
          <li>You are liable for all activities that occur under your account.</li>
          <li>You must notify us immediately at {SITE.supportEmail} if you suspect any unauthorized use of your account.</li>
          <li>We reserve the right to suspend or terminate accounts that violate these terms or are used for fraudulent purposes.</li>
        </ul>

        <h2>3. Orders and Pricing</h2>
        <p>
          All prices on {SITE.name} are displayed in Nigerian Naira ({SITE.currency}) and
          are inclusive of applicable taxes unless otherwise stated. While we make every effort
          to ensure accuracy, prices and availability are subject to change without prior notice.
        </p>
        <h3>3.1 Order Acceptance</h3>
        <p>
          Placing an order constitutes an offer to purchase. We reserve the right to accept or
          decline any order. An order is confirmed only when you receive an order confirmation
          email or notification from us. We may cancel orders due to pricing errors, product
          unavailability, suspected fraud, or other legitimate reasons.
        </p>
        <h3>3.2 Product Descriptions</h3>
        <p>
          We strive to describe and display products as accurately as possible. However, we do
          not warrant that product descriptions, images, colours, or other content on our platform
          are completely accurate, reliable, or error-free. Minor variations in appearance may occur
          due to screen display settings.
        </p>
        <h3>3.3 Quantity Limits</h3>
        <p>
          We reserve the right to limit the quantity of items purchased per person, per household,
          or per order. These restrictions may apply to orders placed under the same account,
          payment method, or delivery address.
        </p>

        <h2>4. Payment</h2>
        <p>
          {SITE.name} accepts payments via bank transfer, debit/credit cards, USSD, and other
          payment methods as displayed at checkout. All payments are processed through secure,
          PCI-compliant payment gateways.
        </p>
        <ul>
          <li>Payment must be completed before your order is processed for dispatch.</li>
          <li>For Pay-on-Delivery orders (where available), full payment is due at the point of delivery.</li>
          <li>We do not store your full card details on our servers.</li>
          <li>If payment fails or is reversed after dispatch, we reserve the right to recover the owed amount or cancel the order.</li>
          <li>Promotional codes and discounts are subject to specific terms and may not be combined unless stated otherwise.</li>
        </ul>

        <h2>5. Delivery</h2>
        <p>
          We deliver to addresses across Nigeria. Delivery timelines provided at checkout are
          estimates and may vary depending on your location, product availability, and logistics
          conditions. Orders above {SITE.currencySymbol}{SITE.freeDeliveryOver.toLocaleString()} qualify
          for free standard delivery within Lagos.
        </p>
        <h3>5.1 Delivery Responsibility</h3>
        <p>
          Risk of loss and title for items pass to you upon delivery. You are responsible for
          providing an accurate delivery address. We are not liable for delays caused by incorrect
          addresses, recipient unavailability, or circumstances beyond our reasonable control
          (including but not limited to natural disasters, strikes, or government restrictions).
        </p>
        <h3>5.2 Installation Services</h3>
        <p>
          Professional installation is available for eligible products at a fee
          of {SITE.currencySymbol}{SITE.installationFee.toLocaleString()}. Installation services are
          subject to availability in your area and separate terms may apply.
        </p>

        <h2>6. Intellectual Property</h2>
        <p>
          All content on {SITE.name} — including but not limited to text, graphics, logos,
          images, product photographs, software, and page layout — is the property
          of {SITE.legalName} or our content suppliers and is protected by Nigerian and
          international copyright, trademark, and intellectual property laws.
        </p>
        <ul>
          <li>You may not reproduce, distribute, modify, or create derivative works from any content without our prior written consent.</li>
          <li>The {SITE.name} name, logo, and all related names, logos, product and service names, designs, and slogans are trademarks of {SITE.legalName}.</li>
          <li>Third-party brand names and logos displayed on our platform remain the property of their respective owners and are used for product identification purposes only.</li>
        </ul>

        <h2>7. Limitation of Liability</h2>
        <p>
          To the maximum extent permitted by Nigerian law, {SITE.legalName} shall not be liable
          for any indirect, incidental, special, consequential, or punitive damages arising out of
          or related to your use of our platform or the purchase of any products, including but not
          limited to:
        </p>
        <ul>
          <li>Loss of profits, revenue, data, or business opportunities.</li>
          <li>Personal injury or property damage resulting from product misuse.</li>
          <li>Unauthorised access to or alteration of your transmissions or data.</li>
          <li>Service interruptions, bugs, viruses, or other harmful components transmitted through our platform.</li>
          <li>Actions or omissions of third-party service providers, including payment processors and logistics partners.</li>
        </ul>
        <p>
          Our total liability for any claim arising from or related to your use of {SITE.name} shall
          not exceed the amount you paid for the specific product or service giving rise to the claim.
        </p>

        <h2>8. Prohibited Conduct</h2>
        <p>When using {SITE.name}, you agree not to:</p>
        <ul>
          <li>Use the platform for any unlawful purpose or in violation of any applicable law.</li>
          <li>Attempt to gain unauthorised access to any part of the platform, other accounts, or computer systems.</li>
          <li>Interfere with or disrupt the integrity or performance of the platform.</li>
          <li>Submit false, misleading, or fraudulent information including during account registration or order placement.</li>
          <li>Use bots, scrapers, or automated tools to access or extract data from the platform.</li>
          <li>Engage in any activity that imposes an unreasonable or disproportionately large load on our infrastructure.</li>
        </ul>

        <h2>9. Governing Law and Dispute Resolution</h2>
        <p>
          These Terms and Conditions are governed by and construed in accordance with the laws
          of the Federal Republic of Nigeria. Any dispute arising out of or in connection with
          these terms shall first be resolved through good-faith negotiation between the parties.
        </p>
        <p>
          If a dispute cannot be resolved through negotiation within thirty (30) days, it shall be
          referred to mediation under the rules of the Lagos Court of Arbitration. If mediation
          fails, either party may submit the dispute to the jurisdiction of the courts of Lagos
          State, Nigeria.
        </p>
        <p>
          Nothing in this clause prevents either party from seeking urgent injunctive or
          equitable relief from a court of competent jurisdiction.
        </p>

        <h2>10. Indemnification</h2>
        <p>
          You agree to indemnify, defend, and hold harmless {SITE.legalName}, its directors,
          officers, employees, agents, and affiliates from and against any claims, liabilities,
          damages, losses, and expenses (including reasonable legal fees) arising out of or in
          any way connected with your access to or use of {SITE.name}, your violation of these
          terms, or your infringement of any third-party rights.
        </p>

        <h2>11. Changes to These Terms</h2>
        <p>
          We reserve the right to update or modify these Terms and Conditions at any time. Changes
          will be posted on this page with an updated "Last updated" date. It is your responsibility
          to review these terms periodically. Continued use of {SITE.name} after any changes
          constitutes your acceptance of the revised terms.
        </p>
        <p>
          For material changes that significantly affect your rights, we will make reasonable efforts
          to notify you via email or through a prominent notice on our platform.
        </p>

        <h2>12. Severability</h2>
        <p>
          If any provision of these terms is found to be invalid, illegal, or unenforceable by a
          court of competent jurisdiction, the remaining provisions shall continue in full force
          and effect. The invalid provision shall be modified to the minimum extent necessary to
          make it valid and enforceable while preserving the original intent.
        </p>

        <h2>13. Contact Us</h2>
        <p>
          If you have questions or concerns about these Terms and Conditions, please contact us:
        </p>
        <ul>
          <li>Email: <a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a></li>
          <li>Phone: <a href={`tel:${SITE.phone}`}>{SITE.phone}</a></li>
          <li>WhatsApp: <a href={SITE.whatsappLink} target="_blank" rel="noreferrer">{SITE.whatsapp}</a></li>
        </ul>
      </div>
    </main>
  );
}
