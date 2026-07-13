import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Home as HomeIcon } from "lucide-react";
import { SITE } from "../config/site.js";

export default function Privacy() {
  useEffect(() => {
    const prev = document.title;
    document.title = `Privacy Policy — ${SITE.name}`;
    return () => { document.title = prev; };
  }, []);

  return (
    <main className="wrap mkt-page">
      <nav className="crumb" aria-label="Breadcrumb">
        <Link to="/"><HomeIcon size={13} /> Home</Link>
        <ChevronRight size={12} />
        <span>Privacy Policy</span>
      </nav>

      <div className="section-head" style={{ marginTop: 14 }}>
        <h2>Privacy Policy</h2>
        <p style={{ fontSize: 12.5, color: "var(--mut)", margin: 0 }}>
          How {SITE.name} collects, uses, and protects your personal data
        </p>
      </div>

      <div className="legal-page">
        <p className="legal-updated">Last updated: 1 June 2026</p>

        <h2>1. Introduction</h2>
        <p>
          {SITE.legalName} ("we", "us", "our") is committed to protecting the privacy and
          personal data of every individual who visits or uses {SITE.name}. This Privacy Policy
          explains how we collect, use, store, share, and protect your information in accordance
          with the Nigeria Data Protection Regulation (NDPR) 2019, the Nigeria Data Protection
          Act (NDPA) 2023, and other applicable data protection laws.
        </p>
        <p>
          By using {SITE.name}, you consent to the data practices described in this policy. We
          encourage you to read this policy carefully and contact us if you have any questions.
        </p>

        <h2>2. Data We Collect</h2>
        <p>We collect information in several ways when you interact with {SITE.name}:</p>

        <h3>2.1 Information You Provide Directly</h3>
        <ul>
          <li><strong>Account information:</strong> Full name, email address, phone number, and password when you create an account.</li>
          <li><strong>Order information:</strong> Delivery address, billing details, and payment information when you place an order.</li>
          <li><strong>Communication data:</strong> Messages, feedback, reviews, and any information you share when you contact our support team via email, phone, or WhatsApp.</li>
          <li><strong>Profile preferences:</strong> Wishlist items, saved addresses, and notification preferences.</li>
        </ul>

        <h3>2.2 Information Collected Automatically</h3>
        <ul>
          <li><strong>Device and browser data:</strong> IP address, browser type and version, operating system, screen resolution, and device identifiers.</li>
          <li><strong>Usage data:</strong> Pages visited, products viewed, search queries, click patterns, time spent on pages, and referring URLs.</li>
          <li><strong>Location data:</strong> Approximate location derived from your IP address to provide relevant delivery estimates and regional pricing.</li>
          <li><strong>Cookies and similar technologies:</strong> Data collected through cookies, web beacons, and local storage (see Section 6).</li>
        </ul>

        <h3>2.3 Information from Third Parties</h3>
        <ul>
          <li>Payment verification data from our payment processors.</li>
          <li>Delivery status updates from our logistics partners.</li>
          <li>Fraud prevention data from security service providers.</li>
        </ul>

        <h2>3. How We Use Your Data</h2>
        <p>We use your personal information for the following purposes:</p>
        <ul>
          <li><strong>Order fulfilment:</strong> Processing, delivering, and managing your orders, including sending order confirmations, shipping updates, and delivery notifications.</li>
          <li><strong>Account management:</strong> Creating and maintaining your account, authenticating your identity, and managing your preferences.</li>
          <li><strong>Customer support:</strong> Responding to your enquiries, resolving complaints, and providing after-sales assistance.</li>
          <li><strong>Personalisation:</strong> Recommending products based on your browsing history, purchase history, and preferences to improve your shopping experience.</li>
          <li><strong>Marketing:</strong> Sending promotional offers, newsletters, and product announcements (only with your consent, and you can opt out at any time).</li>
          <li><strong>Platform improvement:</strong> Analysing usage patterns to improve website functionality, performance, and user experience.</li>
          <li><strong>Security and fraud prevention:</strong> Detecting, investigating, and preventing fraudulent transactions and unauthorised access.</li>
          <li><strong>Legal compliance:</strong> Meeting our obligations under Nigerian law, including tax reporting and regulatory requirements.</li>
        </ul>

        <h2>4. Data Sharing and Disclosure</h2>
        <p>
          We do not sell your personal data to third parties. We may share your information only
          in the following circumstances:
        </p>
        <ul>
          <li><strong>Service providers:</strong> We share data with trusted third-party providers who assist us with payment processing, order delivery, email communication, analytics, and customer support. These providers are contractually bound to protect your data and use it only for the specified purposes.</li>
          <li><strong>Logistics partners:</strong> Your name, phone number, and delivery address are shared with our delivery partners to fulfil your orders.</li>
          <li><strong>Payment processors:</strong> Payment details are shared with licensed payment service providers to process your transactions securely.</li>
          <li><strong>Legal requirements:</strong> We may disclose your data if required to do so by law, court order, or regulatory authority, or to protect the rights, property, or safety of {SITE.legalName}, our users, or the public.</li>
          <li><strong>Business transfers:</strong> In the event of a merger, acquisition, or sale of assets, your data may be transferred as part of the transaction, subject to the same privacy protections.</li>
        </ul>

        <h2>5. Data Security</h2>
        <p>
          We implement robust technical and organisational measures to protect your personal data
          against unauthorised access, alteration, disclosure, or destruction:
        </p>
        <ul>
          <li>SSL/TLS encryption for all data transmitted between your browser and our servers.</li>
          <li>Encrypted storage of sensitive data including passwords (hashed and salted) and payment tokens.</li>
          <li>Regular security audits and vulnerability assessments.</li>
          <li>Access controls limiting employee access to personal data on a need-to-know basis.</li>
          <li>Secure, PCI-DSS compliant payment processing through accredited providers.</li>
        </ul>
        <p>
          While we take extensive precautions, no method of electronic transmission or storage is
          100% secure. We cannot guarantee absolute security, but we are committed to promptly
          addressing any security incidents.
        </p>

        <h2>6. Cookies and Tracking Technologies</h2>
        <p>
          {SITE.name} uses cookies and similar technologies to enhance your browsing experience.
          Cookies are small text files stored on your device that help us recognise you and remember
          your preferences.
        </p>
        <h3>6.1 Types of Cookies We Use</h3>
        <ul>
          <li><strong>Essential cookies:</strong> Required for the platform to function properly, including session management, shopping cart functionality, and security features. These cannot be disabled.</li>
          <li><strong>Functional cookies:</strong> Remember your preferences such as language, region, and display settings to provide a personalised experience.</li>
          <li><strong>Analytics cookies:</strong> Help us understand how visitors interact with our platform, which pages are most popular, and where users encounter issues. This data is aggregated and anonymised.</li>
          <li><strong>Marketing cookies:</strong> Used to deliver relevant advertisements and measure the effectiveness of our marketing campaigns. These are only set with your consent.</li>
        </ul>
        <h3>6.2 Managing Cookies</h3>
        <p>
          You can manage or delete cookies through your browser settings. Please note that
          disabling certain cookies may limit your ability to use some features of {SITE.name}.
        </p>

        <h2>7. Data Retention</h2>
        <p>We retain your personal data only for as long as necessary to fulfil the purposes outlined in this policy:</p>
        <ul>
          <li><strong>Account data:</strong> Retained for as long as your account is active and for up to 24 months after account closure.</li>
          <li><strong>Order records:</strong> Retained for a minimum of 6 years for tax and legal compliance purposes.</li>
          <li><strong>Marketing preferences:</strong> Retained until you withdraw consent or unsubscribe.</li>
          <li><strong>Usage and analytics data:</strong> Retained in aggregated, anonymised form for up to 36 months.</li>
          <li><strong>Support communications:</strong> Retained for up to 24 months after case resolution.</li>
        </ul>
        <p>
          When data is no longer required, it is securely deleted or anonymised so that it can no
          longer be associated with you.
        </p>

        <h2>8. Your Rights</h2>
        <p>
          Under the Nigeria Data Protection Regulation (NDPR) and the Nigeria Data Protection
          Act (NDPA), you have the following rights regarding your personal data:
        </p>
        <ul>
          <li><strong>Right of access:</strong> You can request a copy of the personal data we hold about you.</li>
          <li><strong>Right to rectification:</strong> You can request correction of inaccurate or incomplete personal data.</li>
          <li><strong>Right to deletion:</strong> You can request deletion of your personal data, subject to legal retention requirements.</li>
          <li><strong>Right to restrict processing:</strong> You can request that we limit how we use your data in certain circumstances.</li>
          <li><strong>Right to data portability:</strong> You can request your data in a structured, commonly used, machine-readable format.</li>
          <li><strong>Right to object:</strong> You can object to the processing of your data for direct marketing purposes at any time.</li>
          <li><strong>Right to withdraw consent:</strong> Where processing is based on consent, you can withdraw your consent at any time without affecting the lawfulness of prior processing.</li>
        </ul>
        <p>
          To exercise any of these rights, please contact us at{" "}
          <a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a>. We will respond to
          your request within 30 days.
        </p>

        <h2>9. Children's Privacy</h2>
        <p>
          {SITE.name} is not intended for use by individuals under the age of 18. We do not
          knowingly collect personal data from children. If you are a parent or guardian and
          believe your child has provided us with personal data, please contact us
          at {SITE.supportEmail} and we will take steps to delete such information promptly.
        </p>

        <h2>10. International Data Transfers</h2>
        <p>
          Your data is primarily stored and processed within Nigeria. In cases where data may
          be transferred to servers or service providers located outside Nigeria, we ensure that
          appropriate safeguards are in place in compliance with the NDPR and NDPA, including
          data processing agreements and adequate security measures.
        </p>

        <h2>11. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time to reflect changes in our practices,
          technology, legal requirements, or other factors. When we make material changes, we will
          notify you by updating the "Last updated" date at the top of this page and, where
          appropriate, by sending you an email notification.
        </p>
        <p>
          We encourage you to review this policy periodically to stay informed about how we protect
          your data.
        </p>

        <h2>12. Contact Us</h2>
        <p>
          If you have any questions, concerns, or requests regarding this Privacy Policy or how we
          handle your personal data, please contact our Data Protection team:
        </p>
        <ul>
          <li>Email: <a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a></li>
          <li>Phone: <a href={`tel:${SITE.phone}`}>{SITE.phone}</a></li>
          <li>WhatsApp: <a href={SITE.whatsappLink} target="_blank" rel="noreferrer">{SITE.whatsapp}</a></li>
        </ul>
        <p>
          You also have the right to lodge a complaint with the Nigeria Data Protection Commission
          (NDPC) if you believe your data protection rights have been violated.
        </p>
      </div>
    </main>
  );
}
