/**
 * CatalogLoading — shimmer placeholder for catalogue-driven pages
 * (brand, category) while CatalogContext is still fetching. Stops
 * those pages flashing "not found" straight after a refresh.
 */
export default function CatalogLoading({ label = "Loading" }) {
  return (
    <main className="wrap" style={{ padding: "24px 0 48px" }} aria-busy="true" aria-label={label}>
      <div className="skel" style={{ height: 14, width: 220, borderRadius: 6, marginBottom: 16 }} />
      <div className="skel" style={{ height: 140, borderRadius: "var(--r-lg)", marginBottom: 20 }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14 }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skel" style={{ height: 260, borderRadius: "var(--r)" }} />
        ))}
      </div>
    </main>
  );
}
