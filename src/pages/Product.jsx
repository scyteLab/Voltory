import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  BadgeCheck, ChevronRight, FileBadge, Heart, Home as HomeIcon,
  MessageCircle, Minus, Plus, Repeat, ShieldCheck, ShoppingCart, Truck, Wrench,
} from "lucide-react";
import { RECOMMENDED_ADDON } from "../data/products.js";
import { useCatalog } from "../context/CatalogContext.jsx";
import { snapshotByCategory, snapshotCategoryById } from "../lib/catalogSnapshot.js";
import { naira, discountPct, stockState } from "../utils/format.js";
import { addRecentlyViewed } from "../utils/recentlyViewed.js";
import { useStore } from "../context/StoreContext.jsx";
import { SITE } from "../config/site.js";
import { MAX_COMPARE } from "../utils/comparison.js";
import RatingStars from "../components/product/RatingStars.jsx";
import Gallery from "../components/product/Gallery.jsx";
import SpecsTabs from "../components/product/SpecsTabs.jsx";
import ReviewsSection from "../components/product/ReviewsSection.jsx";
import AddToCartBar from "../components/product/AddToCartBar.jsx";
import ProductCard from "../components/product/ProductCard.jsx";
import LastViewed from "../components/home/LastViewed.jsx";

function NotFound({ slug }) {
  return (
    <main className="wrap" style={{ padding: "80px 24px", textAlign: "center" }}>
      <h1 style={{ fontSize: 28, marginBottom: 10 }}>Product not found</h1>
      <p style={{ color: "var(--mut)", marginBottom: 24 }}>
        We couldn't find a product matching <b>{slug}</b>. It may have been
        removed or the link may be outdated.
      </p>
      <Link to="/" className="btn-shop" style={{ display: "inline-block", padding: "12px 24px" }}>
        Back to Home
      </Link>
    </main>
  );
}

function ProductJsonLd({ product }) {
  const json = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    image: product.image ? [new URL(product.image, window.location.origin).href] : [],
    description: product.description || product.name,
    sku: product.sku,
    brand: { "@type": "Brand", name: product.brand },
    offers: {
      "@type": "Offer",
      url: window.location.href,
      priceCurrency: SITE.currency,
      price: product.price,
      availability: product.stock > 0
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
    aggregateRating: product.reviews
      ? { "@type": "AggregateRating", ratingValue: product.rating, reviewCount: product.reviews }
      : undefined,
  };
  return (
    // eslint-disable-next-line react/no-danger
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }} />
  );
}

export default function Product() {
  const { slug } = useParams();
  const { bySlug, bySku, byCategory } = useCatalog();
  const navigate = useNavigate();
  const product = bySlug(slug);
  const {
    addToCart, toggleWishlist, isInWishlist,
    toggleCompare, isInComparison,
  } = useStore();
  const [qty, setQty] = useState(1);
  const buyBoxRef = useRef(null);

  useEffect(() => {
    if (!product) return;
    addRecentlyViewed(product.sku);
    const prev = document.title;
    document.title = `${product.name} \u2014 ${SITE.name}`;
    return () => { document.title = prev; };
  }, [product]);

  if (!product) return <NotFound slug={slug} />;

  const st = stockState(product.stock);
  const off = discountPct(product.price, product.was);
  const saved = product.was ? product.was - product.price : 0;
  const wished = isInWishlist(product.sku);
  const compared = isInComparison(product.sku);
  const related = byCategory(product.category).filter((p) => p.sku !== product.sku).slice(0, 5);
  const addon = product.sku === RECOMMENDED_ADDON ? null : bySku(RECOMMENDED_ADDON);
  const bundlePrice = addon ? product.price + addon.price : null;

  const handleAdd = () => addToCart(product.sku, qty);
  const handleAddBundle = () => {
    addToCart(product.sku, qty);
    if (addon) addToCart(addon.sku, 1);
  };
  const handleWish = () => toggleWishlist(product.sku);
  const handleCompare = () => {
    const result = toggleCompare(product.sku);
    if (result.full) {
      alert(`You can compare up to ${MAX_COMPARE} products at a time. Remove one from /compare to add this.`);
      navigate("/compare");
    }
  };

  return (
    <main className="wrap">
      <ProductJsonLd product={product} />

      <nav className="crumb" aria-label="Breadcrumb">
        <Link to="/"><HomeIcon size={13} /> Home</Link>
        <ChevronRight size={12} />
        <Link to={`/category/${product.category}`}>{categoryLabel(product.category)}</Link>
        <ChevronRight size={12} />
        <span>{product.name}</span>
      </nav>

      <section className="pdp">
        <Gallery images={productImages(product)} name={product.name} />

        <div className="pdp__buy" ref={buyBoxRef}>
          <div className="pdp__brand">
            <span>{product.brand}</span>
            {product.badge === "best" && (
              <span className="pdp__badge pdp__badge--best"><BadgeCheck size={12} /> Best Seller</span>
            )}
            {product.badge === "new" && (
              <span className="pdp__badge pdp__badge--new">New</span>
            )}
          </div>
          <h1 className="pdp__name">{product.name}</h1>
          <div className="pdp__meta">
            <RatingStars rating={product.rating} reviews={product.reviews} size={14} />
            <span className="pdp__sku">SKU <b className="mono">{product.sku}</b></span>
            {product.model && <span className="pdp__sku">Model <b className="mono">{product.model}</b></span>}
          </div>

          <div className="pdp__price">
            <span className="pdp__price-now">{naira(product.price)}</span>
            {product.was && <span className="pdp__price-was">{naira(product.was)}</span>}
            {off > 0 && <span className="pdp__price-off">-{off}%</span>}
          </div>
          {saved > 0 && (
            <p className="pdp__saved">You save {naira(saved)} on this product</p>
          )}

          <p className={`pdp__stock pdp__stock--${st}`}>
            {st === "ok" && <>● In Stock · Ships within 24 hours</>}
            {st === "low" && <>● Only {product.stock} left — order soon</>}
            {st === "out" && <>● Currently Out of Stock</>}
          </p>

          <ul className="pdp__trust">
            <li><Truck size={15} /> Free delivery on orders over {naira(SITE.freeDeliveryOver)}</li>
            <li><ShieldCheck size={15} /> Manufacturer warranty included</li>
            <li><Wrench size={15} /> Professional installation available</li>
            <li><FileBadge size={15} /> 7-day return policy</li>
          </ul>

          <div className="pdp__buyrow">
            <div className="pdp__qty">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease quantity">
                <Minus size={14} />
              </button>
              <input
                value={qty}
                onChange={(e) => {
                  const n = parseInt(e.target.value || "1", 10);
                  setQty(Number.isFinite(n) && n > 0 ? Math.min(n, product.stock || 99) : 1);
                }}
                inputMode="numeric"
                aria-label="Quantity"
              />
              <button onClick={() => setQty((q) => Math.min((product.stock || 99), q + 1))} aria-label="Increase quantity">
                <Plus size={14} />
              </button>
            </div>
            <button className="pdp__add" onClick={handleAdd} disabled={st === "out"}>
              <ShoppingCart size={16} /> Add to Cart
            </button>
            <button
              className={"pdp__wish" + (wished ? " pdp__wish--on" : "")}
              onClick={handleWish}
              aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
              aria-pressed={wished}
              title={wished ? "Remove from wishlist" : "Add to wishlist"}
            >
              <Heart size={16} fill={wished ? "currentColor" : "none"} />
            </button>
            <button
              className={"pdp__compare" + (compared ? " pdp__compare--on" : "")}
              onClick={handleCompare}
              aria-label={compared ? "Remove from comparison" : "Add to comparison"}
              aria-pressed={compared}
              title={compared ? "Remove from comparison" : "Add to comparison"}
            >
              <Repeat size={16} />
            </button>
          </div>

          <a className="pdp__wa" href={SITE.whatsappLink} target="_blank" rel="noreferrer">
            <span className="pdp__wa-icon"><MessageCircle size={18} /></span>
            <span>
              <b>Need help choosing?</b>
              <small>Chat with our product experts on WhatsApp</small>
            </span>
          </a>
        </div>
      </section>

      {addon && (
        <section className="bundle" aria-label="Recommended add-on">
          <div className="bundle__head">
            <Plus size={18} />
            <div>
              <h3>Frequently Bought Together</h3>
              <p>Power-protect your purchase with the recommended stabilizer.</p>
            </div>
          </div>
          <div className="bundle__items">
            <div className="bundle__item">
              <span className="bundle__img">{product.image && <img src={product.image} alt="" />}</span>
              <p>{product.name}</p>
              <b>{naira(product.price)}</b>
            </div>
            <span className="bundle__plus">+</span>
            <div className="bundle__item">
              <span className="bundle__img">{addon.image && <img src={addon.image} alt="" />}</span>
              <p>{addon.name}</p>
              <b>{naira(addon.price)}</b>
            </div>
            <div className="bundle__total">
              <span>Bundle price</span>
              <b>{naira(bundlePrice)}</b>
              <button className="bundle__add" onClick={handleAddBundle}>
                <ShoppingCart size={15} /> Add Both to Cart
              </button>
            </div>
          </div>
        </section>
      )}

      <SpecsTabs product={product} />

      <ReviewsSection productSku={product.sku} productName={product.name} />

      {related.length > 0 && (
        <>
          <div className="section-head" style={{ marginTop: 40 }}>
            <h2>You May Also Like</h2>
            <Link to={`/category/${product.category}`}>
              View all <ChevronRight size={14} style={{ verticalAlign: "middle" }} />
            </Link>
          </div>
          <section className="pgrid" aria-label="Related products">
            {related.map((p) => <ProductCard key={p.sku} product={p} />)}
          </section>
        </>
      )}

      <div className="section-head" style={{ marginTop: 40 }}>
        <h2>Recently Viewed</h2>
      </div>
      <LastViewed />

      <AddToCartBar product={product} anchorRef={buyBoxRef} qty={qty} />
    </main>
  );
}

function categoryLabel(id) {
  const cat = snapshotCategoryById(id);
  return cat ? cat.label : id;
}

function productImages(product) {
  const imgs = [product.image];
  const siblings = snapshotByCategory(product.category)
    .filter((p) => p.sku !== product.sku && p.image && p.image !== product.image);
  for (const s of siblings) {
    if (!imgs.includes(s.image)) imgs.push(s.image);
    if (imgs.length >= 4) break;
  }
  return imgs;
}