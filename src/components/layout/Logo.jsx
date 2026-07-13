import { Zap } from "lucide-react";
import { SITE, wordmarkParts } from "../../config/site.js";

/**
 * Rename-proof wordmark. Reads SITE.name; the bolt replaces the
 * letter at SITE.logoBoltIndex (the "O" in V-LTORY). If the future
 * name has no good slot, set logoBoltIndex to -1 in site.js and
 * the bolt simply leads the name.
 */
export default function Logo({ tagline = true }) {
  const { pre, post, boltFirst } = wordmarkParts();
  return (
    <span className="logo">
      <span className="logo__wordmark">
        {boltFirst ? (
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
