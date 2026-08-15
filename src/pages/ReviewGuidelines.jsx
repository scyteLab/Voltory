import { useEffect } from "react";
import { Link } from "react-router-dom";
import {
  BadgeCheck, CheckCircle2, Flag, MessageSquare, Shield, XCircle,
} from "lucide-react";
import { SITE } from "../config/site.js";

/**
 * Review Guidelines — /reviews-guidelines
 *
 * Public page. Explains, in plain English, how Voltory handles
 * customer reviews. Purpose is transparency: if we're ever accused
 * of hiding negative reviews, this page is our defence — here's
 * exactly what we allow, what we don't, and how the process works.
 *
 * Deliberately hand-written (not from a CMS) so we own the wording
 * and don't accidentally publish an unfinished draft.
 */
export default function ReviewGuidelines() {
  useEffect(() => {
    const prev = document.title;
    document.title = `Review Guidelines — ${SITE.name}`;
    return () => { document.title = prev; };
  }, []);

  return (
    <main className="wrap rg-page">
      <nav className="crumbs">
        <Link to="/">Home</Link> <span>/</span> <b>Review Guidelines</b>
      </nav>

      <header className="rg-hero">
        <MessageSquare size={40} strokeWidth={1.5} className="rg-hero__icon" />
        <h1>Our Review Guidelines</h1>
        <p>
          We want honest reviews. This page explains exactly how reviews work on NAVEN,
          what we allow, and what we remove. Nothing is hidden.
        </p>
      </header>

      <section className="rg-sec">
        <h2><BadgeCheck size={22} /> How reviews work</h2>
        <ul>
          <li>
            <b>Only verified buyers can review a product.</b> If we don't have a record of you
            purchasing a product, you won't see the write-review option for it.
          </li>
          <li>
            <b>Verified reviews go live immediately.</b> You don't wait for our team's approval.
            The review is visible on the product page the moment you submit it.
          </li>
          <li>
            <b>You can edit or delete your own review anytime</b> from your account's
            <Link to="/account/reviews"> My Reviews</Link> page. Your name is shown alongside your review.
          </li>
          <li>
            <b>All reviews — positive and negative — are welcome.</b> A three-star review from
            someone who bought the product is worth as much to future shoppers as a five-star one.
          </li>
        </ul>
      </section>

      <section className="rg-sec rg-sec--allow">
        <h2><CheckCircle2 size={22} /> What we allow</h2>
        <ul>
          <li>Honest opinions about the product, positive or negative</li>
          <li>Comparisons with other products you've used</li>
          <li>Comments on delivery, packaging, and installation experience</li>
          <li>Comments on features that worked well, or didn't</li>
          <li>Photos of the product in use (coming soon)</li>
          <li>Constructive criticism, even if it's tough on us</li>
        </ul>
      </section>

      <section className="rg-sec rg-sec--deny">
        <h2><XCircle size={22} /> What we remove</h2>
        <ul>
          <li><b>Spam or promotional content</b> — links to other stores, referral codes, ads</li>
          <li><b>Hate speech or personal attacks</b> — abuse aimed at people, not the product</li>
          <li><b>Reviews for a different product</b> — posted on the wrong item by mistake</li>
          <li><b>Fake reviews</b> — written by people who never bought the product, or paid to post</li>
          <li><b>Confidential information</b> — phone numbers, addresses, order numbers of other people</li>
          <li><b>Duplicate content</b> — the same review posted multiple times</li>
        </ul>
        <p className="rg-note">
          If your review is removed, you'll see the reason on your
          <Link to="/account/reviews"> My Reviews</Link> page. You can revise and resubmit.
        </p>
      </section>

      <section className="rg-sec">
        <h2><Shield size={22} /> Our commitment</h2>
        <ul>
          <li>We <b>do not</b> remove reviews just because they are critical of a product</li>
          <li>We <b>do not</b> remove reviews just because they are critical of NAVEN</li>
          <li>We <b>do not</b> ask customers to change or delete honest reviews</li>
          <li>We <b>do not</b> pay for reviews, or offer discounts in exchange for positive ones</li>
          <li>Every removal comes with a reason visible to the review's author</li>
        </ul>
      </section>

      <section className="rg-sec rg-sec--foot">
        <h2><Flag size={22} /> See a review that shouldn't be there?</h2>
        <p>
          Reach out via <a href={SITE.whatsappLink} target="_blank" rel="noreferrer">WhatsApp</a>
          or <Link to="/contact">the contact page</Link> with the product name and a screenshot,
          and we'll take a look.
        </p>
      </section>

      <p className="rg-updated">Last updated August 2026 • Questions? <Link to="/contact">Contact us</Link></p>
    </main>
  );
}