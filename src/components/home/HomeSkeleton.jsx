/**
 * HomeSkeleton — shown while SiteSectionsContext is loading the
 * homepage layout, so visitors see a shimmering placeholder instead
 * of a blank gap between the header and footer.
 *
 * Mirrors the real layout's structure (.hero-row grid, .wrap section
 * stacks) so the page doesn't jump/shift once real content swaps in.
 */
export default function HomeSkeleton() {
  return (
    <main className="home" aria-hidden="true">
      <div className="wrap hero-row">
        <div className="skel skel--sidebar" />
        <div className="skel skel--hero" />
        <div className="skel-col">
          <div className="skel skel--promo" />
          <div className="skel skel--promo" />
        </div>
      </div>

      <div className="wrap">
        <div className="skel skel--heading" />
        <div className="skel-row">
          {Array.from({ length: 6 }).map((_, i) => (
            <div className="skel skel--tile" key={i} />
          ))}
        </div>

        <div className="skel skel--heading" />
        <div className="skel-row">
          {Array.from({ length: 5 }).map((_, i) => (
            <div className="skel skel--card" key={i} />
          ))}
        </div>

        <div className="skel skel--heading" />
        <div className="skel-row">
          {Array.from({ length: 6 }).map((_, i) => (
            <div className="skel skel--pill" key={i} />
          ))}
        </div>

        <div className="skel-row skel-row--bands">
          <div className="skel skel--band" />
          <div className="skel skel--band" />
        </div>
      </div>
    </main>
  );
}
