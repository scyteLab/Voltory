import { Zap } from "lucide-react";
import { SITE, wordmarkParts } from "../../config/site.js";

/**
 * Rename-proof wordmark. Reads SITE.name; the bolt replaces the
 * letter at SITE.logoBoltIndex (the "O" in V-LTORY). If the future
 * name has no good slot, set logoBoltIndex to -1 in site.js and
 * the wordmark renders as clean text with no bolt at all.
 */
export default function Logo({ tagline = true }) {
  const { pre, post, boltFirst } = wordmarkParts();
  const noBolt = SITE.logoBoltIndex === -1;
  return (
    <span className="logo">
      <span className="logo__wordmark">
        {noBolt ? (
          post
        ) : boltFirst ? (
          <>
            <Zap className="logo__bolt" size={22} fill="currentColor" />
            {post}
          </>
        ) : (
          <>
            {pre}
            <Zap className="logo__bolt" size={22} fill="currentColor" />
            {post}
          </>
        )}
      </span>
      {tagline && <span className="logo__tag">{SITE.tagline}</span>}
    </span>
  );
}
