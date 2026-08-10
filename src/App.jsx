import { BrowserRouter, Link, Outlet, Route, Routes } from "react-router-dom";
import { StoreProvider } from "./context/StoreContext.jsx";
import { AdminProvider } from "./context/AdminContext.jsx";
import { CatalogProvider } from "./context/CatalogContext.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { SiteSectionsProvider } from "./context/SiteSectionsContext.jsx";
import AdminGuard from "./components/admin/AdminGuard.jsx";
import AdminShell from "./components/admin/AdminShell.jsx";
import AdminLogin from "./pages/admin/AdminLogin.jsx";
import AdminDashboard from "./pages/admin/AdminDashboard.jsx";
import CatalogProducts from "./pages/admin/CatalogProducts.jsx";
import AdminCategories from "./pages/admin/AdminCategories.jsx";
import AdminBrands from "./pages/admin/AdminBrands.jsx";
import AdminOrders from "./pages/admin/AdminOrders.jsx";
import AdminOrderDetail from "./pages/admin/AdminOrderDetail.jsx";
import AdminCustomers from "./pages/admin/AdminCustomers.jsx";
import AdminCustomerDetail from "./pages/admin/AdminCustomerDetail.jsx";
import AdminWarranty from "./pages/admin/AdminWarranty.jsx";
import AdminWarrantyDetail from "./pages/admin/AdminWarrantyDetail.jsx";
import AdminReports from "./pages/admin/AdminReports.jsx";
import AdminSettings from "./pages/admin/AdminSettings.jsx";
import AdminHomepage from "./pages/admin/AdminHomepage.jsx";
import AdminReviews from "./pages/admin/AdminReviews.jsx";
import AdminWhatsappQuotes from "./pages/admin/AdminWhatsappQuotes.jsx";
import AdminWhatsappQuoteDetail from "./pages/admin/AdminWhatsappQuoteDetail.jsx";
import TopBar from "./components/layout/TopBar.jsx";
import Header from "./components/layout/Header.jsx";
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
import Checkout from "./pages/Checkout.jsx";
import OrderConfirmation from "./pages/OrderConfirmation.jsx";
import Category from "./pages/Category.jsx";
import AllCategories from "./pages/AllCategories.jsx";
import Search from "./pages/Search.jsx";
import Login from "./pages/Login.jsx";
import SignUp from "./pages/SignUp.jsx";
import VerifyOtp from "./pages/VerifyOtp.jsx";
import Brands from "./pages/Brands.jsx";
import Brand from "./pages/Brand.jsx";
import Deals from "./pages/Deals.jsx";
import NewArrivals from "./pages/NewArrivals.jsx";
import BestSellers from "./pages/BestSellers.jsx";
import TrackOrder from "./pages/TrackOrder.jsx";
import HelpCenter from "./pages/HelpCenter.jsx";
import Contact from "./pages/Contact.jsx";
import InstallationServices from "./pages/InstallationServices.jsx";
import Blog from "./pages/Blog.jsx";
import About from "./pages/About.jsx";
import Careers from "./pages/Careers.jsx";
import ReviewGuidelines from "./pages/ReviewGuidelines.jsx";
import Affiliate from "./pages/Affiliate.jsx";
import Compare from "./pages/Compare.jsx";
import Terms from "./pages/Terms.jsx";
import Privacy from "./pages/Privacy.jsx";
import Returns from "./pages/Returns.jsx";
import NotFound from "./pages/NotFound.jsx";
import AccountLayout from "./pages/account/AccountLayout.jsx";
import AccountOverview from "./pages/account/AccountOverview.jsx";
import AccountOrders from "./pages/account/AccountOrders.jsx";
import AccountAddresses from "./pages/account/AccountAddresses.jsx";
import AccountReviews from "./pages/account/AccountReviews.jsx";
import AccountWishlist from "./pages/account/AccountWishlist.jsx";
import { SITE } from "./config/site.js";
import { BadgeCheck, ShieldCheck, Truck } from "lucide-react";

const AUTH_TRUST = [
  { Icon: ShieldCheck, text: "100% Original Products — sourced from authorized distributors." },
  { Icon: BadgeCheck, text: "Official brand warranty on every purchase." },
  { Icon: Truck, text: "Fast & reliable delivery across Nigeria." },
];

function StoreLayout() {
  return (
    <>
      <TopBar />
      <Header />
      <MainNav />
      <Outlet />
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
          <p className="auth-brand__sub">{SITE.tagline}</p>
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
        <Outlet />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <AdminProvider>
        <CatalogProvider>
          <AuthProvider>
            <SiteSectionsProvider>
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            <Route element={<StoreLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/search" element={<Search />} />
              <Route path="/categories" element={<AllCategories />} />
              <Route path="/category/:id" element={<Category />} />
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
                <Route path="wishlist" element={<AccountWishlist />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Route>
            <Route element={<AuthLayout />}>
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<SignUp />} />
              <Route path="/verify-otp" element={<VerifyOtp />} />
            </Route>

            <Route path="/admin/login" element={<AdminLogin />} />
            <Route element={<AdminGuard><AdminShell /></AdminGuard>}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/products" element={<CatalogProducts />} />
              <Route path="/admin/catalog/categories" element={<AdminCategories />} />
              <Route path="/admin/catalog/brands" element={<AdminBrands />} />
              <Route path="/admin/orders" element={<AdminOrders />} />
              <Route path="/admin/orders/:id" element={<AdminOrderDetail />} />
              <Route path="/admin/customers" element={<AdminCustomers />} />
              <Route path="/admin/customers/:phone" element={<AdminCustomerDetail />} />
              <Route path="/admin/warranty" element={<AdminWarranty />} />
              <Route path="/admin/warranty/:id" element={<AdminWarrantyDetail />} />
              <Route path="/admin/reports" element={<AdminReports />} />
              <Route path="/admin/homepage" element={<AdminHomepage />} />
              <Route path="/admin/reviews" element={<AdminReviews />} />
              <Route path="/admin/whatsapp-quotes" element={<AdminWhatsappQuotes />} />
              <Route path="/admin/whatsapp-quotes/:id" element={<AdminWhatsappQuoteDetail />} />
              <Route path="/admin/settings" element={<AdminSettings />} />
            </Route>
          </Routes>
        </BrowserRouter>
            </SiteSectionsProvider>
          </AuthProvider>
        </CatalogProvider>
      </AdminProvider>
    </StoreProvider>
  );
}