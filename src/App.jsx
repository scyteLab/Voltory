import { lazy, Suspense } from "react";
import { BrowserRouter, Link, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import SEOHead from "./components/seo/SEOHead.jsx";
import { HelmetProvider } from "react-helmet-async";
import { StoreProvider } from "./context/StoreContext.jsx";
import { AdminProvider } from "./context/AdminContext.jsx";
import { CatalogProvider } from "./context/CatalogContext.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { SiteSectionsProvider } from "./context/SiteSectionsContext.jsx";
import TopBar from "./components/layout/TopBar.jsx";
import Header from "./components/layout/Header.jsx";
import Tagline from "./components/brand/Tagline.jsx";
import MainNav from "./components/layout/MainNav.jsx";
import Footer from "./components/layout/Footer.jsx";
import WhatsAppBubble from "./components/layout/WhatsAppBubble.jsx";
import MobileBottomNav from "./components/layout/MobileBottomNav.jsx";
import Toast from "./components/ui/Toast.jsx";
import CallConfirmModal from "./components/ui/CallConfirmModal.jsx";
import ScrollToTop from "./components/ui/ScrollToTop.jsx";
import AuthGuard from "./components/ui/AuthGuard.jsx";
import Logo from "./components/layout/Logo.jsx";
import Home from "./pages/Home.jsx";
import Product from "./pages/Product.jsx";
import Cart from "./pages/Cart.jsx";
import Collection from "./pages/Collection.jsx";
import Category from "./pages/Category.jsx";
import AllCategories from "./pages/AllCategories.jsx";
import Search from "./pages/Search.jsx";
import Brands from "./pages/Brands.jsx";
import Brand from "./pages/Brand.jsx";
import Deals from "./pages/Deals.jsx";
import NewArrivals from "./pages/NewArrivals.jsx";
import BestSellers from "./pages/BestSellers.jsx";
import NotFound from "./pages/NotFound.jsx";
import { SITE } from "./config/site.js";
import { BadgeCheck, ShieldCheck, Truck } from "lucide-react";

/* Code-split routes: admin, account, checkout, order/receipt, sign-in and
   info pages load on demand, so shoppers landing on a product or
   category page don't download the admin panel. */
const AdminGuard = lazy(() => import("./components/admin/AdminGuard.jsx"));
const AdminShell = lazy(() => import("./components/admin/AdminShell.jsx"));
const AdminLogin = lazy(() => import("./pages/admin/AdminLogin.jsx"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard.jsx"));
const CatalogProducts = lazy(() => import("./pages/admin/CatalogProducts.jsx"));
const CatalogProductsImport = lazy(() => import("./pages/admin/CatalogProductsImport.jsx"));
const CatalogStockImport = lazy(() => import("./pages/admin/CatalogStockImport.jsx"));
const CatalogPriceImport = lazy(() => import("./pages/admin/CatalogPriceImport.jsx"));
const CatalogSpecsImport = lazy(() => import("./pages/admin/CatalogSpecsImport.jsx"));
const AdminExports = lazy(() => import("./pages/admin/AdminExports.jsx"));
const AdminInventory = lazy(() => import("./pages/admin/AdminInventory.jsx"));
const AdminMarketing = lazy(() => import("./pages/admin/AdminMarketing.jsx"));
const GMPortal = lazy(() => import("./pages/admin/GMPortal.jsx"));
const GMSetup = lazy(() => import("./pages/admin/GMSetup.jsx"));
const AdminCategories = lazy(() => import("./pages/admin/AdminCategories.jsx"));
const AdminBrands = lazy(() => import("./pages/admin/AdminBrands.jsx"));
const AdminCollections = lazy(() => import("./pages/admin/AdminCollections.jsx"));
const AdminCollectionEdit = lazy(() => import("./pages/admin/AdminCollectionEdit.jsx"));
const AdminOffers = lazy(() => import("./pages/admin/AdminOffers.jsx"));
const AdminOfferEdit = lazy(() => import("./pages/admin/AdminOfferEdit.jsx"));
const AdminAttributes = lazy(() => import("./pages/admin/AdminAttributes.jsx"));
const AdminAttributeEdit = lazy(() => import("./pages/admin/AdminAttributeEdit.jsx"));
const AdminOrders = lazy(() => import("./pages/admin/AdminOrders.jsx"));
const AdminOrderDetail = lazy(() => import("./pages/admin/AdminOrderDetail.jsx"));
const AdminReceipts = lazy(() => import("./pages/admin/AdminReceipts.jsx"));
const AdminReceiptDetail = lazy(() => import("./pages/admin/AdminReceiptDetail.jsx"));
const AdminCustomers = lazy(() => import("./pages/admin/AdminCustomers.jsx"));
const AdminCustomerDetail = lazy(() => import("./pages/admin/AdminCustomerDetail.jsx"));
const AdminTeam = lazy(() => import("./pages/admin/AdminTeam.jsx"));
const AdminWarranty = lazy(() => import("./pages/admin/AdminWarranty.jsx"));
const AdminWarrantyDetail = lazy(() => import("./pages/admin/AdminWarrantyDetail.jsx"));
const AdminReports = lazy(() => import("./pages/admin/AdminReports.jsx"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings.jsx"));
const AdminHomepage = lazy(() => import("./pages/admin/AdminHomepage.jsx"));
const AdminReviews = lazy(() => import("./pages/admin/AdminReviews.jsx"));
const AdminQuestions = lazy(() => import("./pages/admin/AdminQuestions.jsx"));
const AdminWhatsappQuotes = lazy(() => import("./pages/admin/AdminWhatsappQuotes.jsx"));
const AdminWhatsappQuoteDetail = lazy(() => import("./pages/admin/AdminWhatsappQuoteDetail.jsx"));
const AdminInbox = lazy(() => import("./pages/admin/AdminInbox.jsx"));
const Checkout = lazy(() => import("./pages/Checkout.jsx"));
const OrderConfirmation = lazy(() => import("./pages/OrderConfirmation.jsx"));
const Receipt = lazy(() => import("./pages/Receipt.jsx"));
const Login = lazy(() => import("./pages/Login.jsx"));
const SignUp = lazy(() => import("./pages/SignUp.jsx"));
const TrackOrder = lazy(() => import("./pages/TrackOrder.jsx"));
const HelpCenter = lazy(() => import("./pages/HelpCenter.jsx"));
const Contact = lazy(() => import("./pages/Contact.jsx"));
const InstallationServices = lazy(() => import("./pages/InstallationServices.jsx"));
const Blog = lazy(() => import("./pages/Blog.jsx"));
const About = lazy(() => import("./pages/About.jsx"));
const Careers = lazy(() => import("./pages/Careers.jsx"));
const ReviewGuidelines = lazy(() => import("./pages/ReviewGuidelines.jsx"));
const Affiliate = lazy(() => import("./pages/Affiliate.jsx"));
const Compare = lazy(() => import("./pages/Compare.jsx"));
const Terms = lazy(() => import("./pages/Terms.jsx"));
const Privacy = lazy(() => import("./pages/Privacy.jsx"));
const Returns = lazy(() => import("./pages/Returns.jsx"));
const AccountLayout = lazy(() => import("./pages/account/AccountLayout.jsx"));
const AccountOverview = lazy(() => import("./pages/account/AccountOverview.jsx"));
const AccountOrders = lazy(() => import("./pages/account/AccountOrders.jsx"));
const AccountAddresses = lazy(() => import("./pages/account/AccountAddresses.jsx"));
const AccountReviews = lazy(() => import("./pages/account/AccountReviews.jsx"));
const AccountQuestions = lazy(() => import("./pages/account/AccountQuestions.jsx"));
const AccountWishlist = lazy(() => import("./pages/account/AccountWishlist.jsx"));

function RouteLoading() {
  return <div className="route-loading" role="status" aria-live="polite"><span className="route-loading__spin" aria-hidden="true" /> Loading…</div>;
}

const AUTH_TRUST = [
  { Icon: ShieldCheck, text: "100% Original Products — sourced from authorized distributors." },
  { Icon: BadgeCheck, text: "Official brand warranty on every purchase." },
  { Icon: Truck, text: "Fast & reliable delivery across Nigeria." },
];

/* Private paths: never indexed (also sent as an X-Robots-Tag header by
   netlify.toml). A page's own SEOHead, rendered deeper, still wins. */
const PRIVATE_PATH = /^\/(account|admin|cart|checkout|order|receipt|track-order|login|signup|verify-otp)(\/|$)/;
function PrivateNoIndex() {
  const { pathname } = useLocation();
  return PRIVATE_PATH.test(pathname) ? <SEOHead title="NAVEN" noindex /> : null;
}

function StoreLayout() {
  return (
    <>
      <PrivateNoIndex />
      <TopBar />
      <Header />
      <MainNav />
      <Suspense fallback={<RouteLoading />}>
        <Outlet />
      </Suspense>
      <Footer />
      <WhatsAppBubble />
      <MobileBottomNav />
      <Toast />
      <CallConfirmModal />
    </>
  );
}

function AuthLayout() {
  return (
    <div className="auth-shell">
      <div className="auth-brand">
        <Link to="/" className="auth-brand__logo-link">
          <Logo tagline={false} />
        </Link>
        <div className="auth-brand__body">
          <h2 className="auth-brand__headline">
            Original Electronics.<br />Trusted Performance.
          </h2>
          <div className="auth-brand__sub">
            <Tagline size="md" className="brand-tagline--on-dark" />
          </div>
          <ul className="auth-brand__trust">
            {AUTH_TRUST.map(({ Icon, text }) => (
              <li key={text}>
                <span className="auth-brand__trust-icon"><Icon size={18} /></span>
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="auth-brand__back">
          <Link to="/">← Back to store</Link>
        </p>
      </div>
      <div className="auth-form-panel">
        <Suspense fallback={<RouteLoading />}>
          <Outlet />
        </Suspense>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <HelmetProvider>
      <StoreProvider>
        <AdminProvider>
          <CatalogProvider>
            <AuthProvider>
              <SiteSectionsProvider>
          <BrowserRouter>
            <ScrollToTop />
            <Suspense fallback={<RouteLoading />}>
            <Routes>
              <Route element={<StoreLayout />}>
                <Route path="/" element={<Home />} />
                <Route path="/search" element={<Search />} />
                <Route path="/categories" element={<AllCategories />} />
                <Route path="/category/:id" element={<Category />} />
                <Route path="/collection/:slug" element={<Collection />} />
                <Route path="/product/:slug" element={<Product />} />
                <Route path="/brands" element={<Brands />} />
                <Route path="/brand/:id" element={<Brand />} />
                <Route path="/deals" element={<Deals />} />
                <Route path="/new" element={<NewArrivals />} />
                <Route path="/best-sellers" element={<BestSellers />} />
                <Route path="/compare" element={<Compare />} />
                <Route path="/cart" element={<Cart />} />
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/order/:id" element={<OrderConfirmation />} />
                <Route path="/receipt/:id" element={<Receipt />} />
                <Route path="/track-order" element={<TrackOrder />} />
                <Route path="/help" element={<HelpCenter />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/services/installation" element={<InstallationServices />} />
                <Route path="/blog" element={<Blog />} />
                <Route path="/about" element={<About />} />
                <Route path="/careers" element={<Careers />} />
                <Route path="/reviews-guidelines" element={<ReviewGuidelines />} />
                <Route path="/affiliate" element={<Affiliate />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/returns" element={<Returns />} />

                <Route path="/account" element={<AuthGuard><AccountLayout /></AuthGuard>}>
                  <Route index element={<AccountOverview />} />
                  <Route path="orders" element={<AccountOrders />} />
                  <Route path="orders/:id" element={<OrderConfirmation />} />
                  <Route path="addresses" element={<AccountAddresses />} />
                  <Route path="reviews"   element={<AccountReviews />} />
                  <Route path="questions" element={<AccountQuestions />} />
                  <Route path="wishlist" element={<AccountWishlist />} />
                </Route>

                <Route path="*" element={<NotFound />} />
              </Route>
              {/* Login and SignUp are both fully self-contained pages now
                  (each wraps its form in <AuthShell>, which renders its
                  own brand showcase panel) — nesting them in AuthLayout
                  would render a second brand panel around them. VerifyOtp
                  still uses the plain .auth-card design, so it keeps
                  relying on AuthLayout for the brand panel. */}
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<SignUp />} />
              <Route element={<AuthLayout />}>
              </Route>

              <Route path="/admin/login" element={<AdminLogin />} />
              <Route element={<AdminGuard><AdminShell /></AdminGuard>}>
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin/products/import" element={<CatalogProductsImport />} />
                <Route path="/admin/inventory" element={<AdminInventory />} />
                <Route path="/admin/inventory/update" element={<CatalogStockImport />} />
                <Route path="/admin/pricing" element={<Navigate to="/admin/pricing/update" replace />} />
                <Route path="/admin/pricing/update" element={<CatalogPriceImport />} />
                <Route path="/admin/specs/update" element={<CatalogSpecsImport />} />
                <Route path="/admin/specs" element={<Navigate to="/admin/specs/update" replace />} />
                <Route path="/admin/exports" element={<AdminExports />} />
                <Route path="/admin/marketing" element={<AdminMarketing />} />
                <Route path="/admin/gm-portal" element={<GMPortal />} />
                <Route path="/admin/gm-setup" element={<GMSetup />} />
                <Route path="/admin/products" element={<CatalogProducts />} />
                <Route path="/admin/catalog/categories" element={<AdminCategories />} />
                <Route path="/admin/catalog/brands" element={<AdminBrands />} />
                <Route path="/admin/collections" element={<AdminCollections />} />
                <Route path="/admin/collections/:id" element={<AdminCollectionEdit />} />
                <Route path="/admin/offers" element={<AdminOffers />} />
                <Route path="/admin/offers/:id" element={<AdminOfferEdit />} />
                <Route path="/admin/attributes" element={<AdminAttributes />} />
                <Route path="/admin/attributes/:id" element={<AdminAttributeEdit />} />
                <Route path="/admin/orders" element={<AdminOrders />} />
                <Route path="/admin/orders/:id" element={<AdminOrderDetail />} />
                <Route path="/admin/receipts" element={<AdminReceipts />} />
                <Route path="/admin/receipts/:id" element={<AdminReceiptDetail />} />
                <Route path="/admin/customers" element={<AdminCustomers />} />
                <Route path="/admin/customers/:phone" element={<AdminCustomerDetail />} />
                <Route path="/admin/team" element={<AdminTeam />} />
                <Route path="/admin/warranty" element={<AdminWarranty />} />
                <Route path="/admin/warranty/:id" element={<AdminWarrantyDetail />} />
                <Route path="/admin/reports" element={<AdminReports />} />
                <Route path="/admin/homepage" element={<AdminHomepage />} />
                <Route path="/admin/reviews" element={<AdminReviews />} />
                <Route path="/admin/questions" element={<AdminQuestions />} />
                <Route path="/admin/whatsapp-quotes" element={<AdminWhatsappQuotes />} />
                <Route path="/admin/whatsapp-quotes/:id" element={<AdminWhatsappQuoteDetail />} />
                <Route path="/admin/inbox" element={<AdminInbox />} />
                <Route path="/admin/messages" element={<Navigate to="/admin/inbox" replace />} />
                <Route path="/admin/settings" element={<AdminSettings />} />
              </Route>
            </Routes>
            </Suspense>
          </BrowserRouter>
              </SiteSectionsProvider>
            </AuthProvider>
          </CatalogProvider>
        </AdminProvider>
      </StoreProvider>
    </HelmetProvider>
  );
}