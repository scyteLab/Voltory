import { SITE } from "../config/site.js";
import HomeRenderer from "../components/home/HomeRenderer.jsx";
import SEOHead from "../components/seo/SEOHead.jsx";
import { organizationSchema, websiteSchema } from "../lib/seo/structuredData.js";

/**
 * Home — the storefront landing page.
 *
 * As of Session 31, the homepage layout is data-driven: it reads its
 * sections and their config from the `site_sections` table via
 * SiteSectionsContext, and HomeRenderer maps each row to a component.
 *
 * The visual output is intentionally identical to the pre-Session-31
 * hardcoded homepage — all we've done is move the layout definition
 * out of code and into data. Session 31b adds the admin UI to
 * rearrange, hide, and edit sections.
 */
export default function Home() {

  return (
    <>
      <SEOHead
        description="NAVEN — The Premium Electronics. Shop fridges, air conditioners, TVs, washing machines and premium appliances from Scanfrost, Midea, Samsung, Sony, Panasonic, Kenwood. Nationwide delivery, pay-on-delivery available."
        jsonLd={[organizationSchema(), websiteSchema()]}
      />
      <HomeRenderer />
    </>
  );
}