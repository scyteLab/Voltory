import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Check, ChevronDown, Clock, Search, Tag, TrendingUp, X,
} from "lucide-react";
import { POPULAR_SEARCHES } from "../../data/products.js";
import { useCatalog } from "../../context/CatalogContext.jsx";
import { naira } from "../../utils/format.js";
import { search, searchUrl } from "../../utils/searchEngine.js";
import {
  addRecentSearch, clearRecentSearches, getRecentSearches, removeRecentSearch,
} from "../../utils/recentSearches.js";
import Icon from "../ui/Icon.jsx";

/**
 * Header search bar. Three sub-pieces share state intimately:
 *   1. "All Categories" dropdown (left of input) — scope selector
 *   2. The input — focus and typing
 *   3. Autocomplete dropdown — products / categories / brands / recent
 *
 * Keyboard:
 *   - Arrow Up/Down: move through suggestions
 *   - Enter: navigate to highlighted suggestion, or submit search
 *   - Escape: close dropdowns
 *   - Click outside: close dropdowns
 */
export default function SearchBar() {
  const { categories: CATEGORIES } = useCatalog();
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState(null); // null = All Categories
  const [openCat, setOpenCat] = useState(false);
  const [openSug, setOpenSug] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [recent, setRecent] = useState(() => getRecentSearches());
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  // Live results computed on every keystroke. Cheap because dataset is small;
  // when we hit a backend this becomes a debounced API call.
  const results = useMemo(
    () => search(query, { categoryScope: scope }),
    [query, scope]
  );

  // Flatten suggestions into a single list so arrow keys can step through them.
  const flatSuggestions = useMemo(() => {
    if (query.length < 2) {
      return [
        ...recent.map((r) => ({ type: "recent", value: r })),
        ...POPULAR_SEARCHES.map((p) => ({ type: "popular", value: p })),
      ];
    }
    const list = [];
    for (const p of results.products) list.push({ type: "product", value: p });
    for (const c of results.categories) list.push({ type: "category", value: c });
    for (const b of results.brands) list.push({ type: "brand", value: b });
    return list;
  }, [query, results, recent]);

  // Reset highlight when the suggestion list changes
  useEffect(() => { setHighlight(-1); }, [flatSuggestions.length, openSug]);

  // Refresh recents whenever the dropdown opens
  useEffect(() => {
    if (openSug) setRecent(getRecentSearches());
  }, [openSug]);

  // Close everything on outside click
  useEffect(() => {
    function onDown(e) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target)) {
        setOpenCat(false);
        setOpenSug(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // ---------- handlers ----------
  function submit(qOverride) {
    const q = (qOverride ?? query).trim();
    if (!q) return;
    addRecentSearch(q);
    setOpenSug(false);
    inputRef.current?.blur();
    navigate(searchUrl(q, scope));
  }

  function pickSuggestion(s) {
    if (s.type === "product") {
      addRecentSearch(s.value.name);
      setOpenSug(false);
      navigate(`/product/${s.value.slug}`);
    } else if (s.type === "category") {
      setOpenSug(false);
      navigate(`/category/${s.value.id}`);
    } else if (s.type === "brand") {
      addRecentSearch(s.value.name);
      setOpenSug(false);
      navigate(searchUrl(s.value.name, null));
    } else if (s.type === "recent" || s.type === "popular") {
      setQuery(s.value);
      submit(s.value);
    }
  }

  function onKeyDown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpenSug(true);
      setHighlight((h) => Math.min(flatSuggestions.length - 1, h + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(-1, h - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlight >= 0 && highlight < flatSuggestions.length) {
        pickSuggestion(flatSuggestions[highlight]);
      } else {
        submit();
      }
    } else if (e.key === "Escape") {
      setOpenSug(false);
      setOpenCat(false);
      inputRef.current?.blur();
    }
  }

  function selectScope(catId) {
    setScope(catId);
    setOpenCat(false);
    inputRef.current?.focus();
  }

  function clearScope(e) {
    e.stopPropagation();
    setScope(null);
  }

  function handleRemoveRecent(e, value) {
    e.stopPropagation();
    removeRecentSearch(value);
    setRecent(getRecentSearches());
  }

  function handleClearRecents(e) {
    e.stopPropagation();
    clearRecentSearches();
    setRecent([]);
  }

  const scopedCategory = scope ? CATEGORIES.find((c) => c.id === scope) : null;
  const showSuggestions = openSug;

  return (
    <>
      {/* Dims + blurs the rest of the page while the search is active,
          and brightens the search bar above it — Jumia-style. */}
      {showSuggestions && (
        <div className="search-overlay" onClick={() => setOpenSug(false)} />
      )}
      <div className={"search" + (showSuggestions ? " search--active" : "")} ref={wrapRef} role="search">
      {/* ---- All Categories selector ---- */}
      <button
        type="button"
        className={"search__cat" + (openCat ? " search__cat--open" : "")}
        onClick={() => { setOpenCat((v) => !v); setOpenSug(false); }}
        aria-haspopup="listbox"
        aria-expanded={openCat}
      >
        {scopedCategory ? (
          <>
            <span className="search__cat-chip">
              {scopedCategory.label}
              <X size={12} onClick={clearScope} role="button" aria-label="Clear category" />
            </span>
          </>
        ) : (
          <>All Categories</>
        )}
        <ChevronDown size={14} />
      </button>

      {openCat && (
        <div className="search__catpanel" role="listbox" aria-label="Choose a category">
          <button
            className={"search__catitem" + (scope === null ? " search__catitem--on" : "")}
            onClick={() => selectScope(null)}
            role="option"
            aria-selected={scope === null}
          >
            {scope === null ? <Check size={14} /> : <span className="search__catitem-dot" />}
            All Categories
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              className={"search__catitem" + (scope === c.id ? " search__catitem--on" : "")}
              onClick={() => selectScope(c.id)}
              role="option"
              aria-selected={scope === c.id}
            >
              {scope === c.id ? <Check size={14} /> : <Icon name={c.icon} size={14} />}
              {c.label}
            </button>
          ))}
        </div>
      )}

      {/* ---- input ---- */}
      <input
        ref={inputRef}
        className="search__input"
        placeholder={
          scopedCategory
            ? `Search in ${scopedCategory.label}…`
            : "Search for products, brands and categories..."
        }
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpenSug(true); setOpenCat(false); }}
        onFocus={() => { setOpenSug(true); setOpenCat(false); }}
        onKeyDown={onKeyDown}
        aria-label="Search products"
        aria-autocomplete="list"
        aria-expanded={showSuggestions}
        autoComplete="off"
      />
      <button
        type="button"
        className="search__go"
        onClick={() => submit()}
        aria-label="Search"
      >
        <Search size={18} />
      </button>

      {/* ---- autocomplete dropdown ---- */}
      {showSuggestions && (
        <div className="search__panel" role="listbox" aria-label="Search suggestions">
          {/* RECENT — shown only when query is empty */}
          {query.length < 2 && recent.length > 0 && (
            <div className="search__group">
              <div className="search__grouphead">
                <Clock size={13} /> Recent searches
                <button className="search__groupclear" onClick={handleClearRecents}>
                  Clear all
                </button>
              </div>
              {recent.map((r, i) => {
                const idx = i;
                return (
                  <SuggestionRow
                    key={`recent-${r}`}
                    type="recent"
                    highlighted={highlight === idx}
                    onMouseEnter={() => setHighlight(idx)}
                    onClick={() => pickSuggestion({ type: "recent", value: r })}
                  >
                    <Clock size={13} className="search__sug-icon" />
                    <span className="search__sug-text">{r}</span>
                    <button
                      className="search__sug-remove"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={(e) => handleRemoveRecent(e, r)}
                      aria-label={`Remove ${r}`}
                    >
                      <X size={13} />
                    </button>
                  </SuggestionRow>
                );
              })}
            </div>
          )}

          {/* POPULAR — shown only when query is empty */}
          {query.length < 2 && (
            <div className="search__group">
              <div className="search__grouphead">
                <TrendingUp size={13} /> Popular searches
              </div>
              <div className="search__chips">
                {POPULAR_SEARCHES.map((p, i) => {
                  const idx = recent.length + i;
                  return (
                    <button
                      key={`popular-${p}`}
                      type="button"
                      className={"search__chip" + (highlight === idx ? " search__chip--on" : "")}
                      onMouseEnter={() => setHighlight(idx)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pickSuggestion({ type: "popular", value: p })}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* PRODUCTS */}
          {query.length >= 2 && results.products.length > 0 && (
            <div className="search__group">
              <div className="search__grouphead">
                <Search size={13} /> Products
              </div>
              {results.products.map((p, i) => {
                const idx = i;
                return (
                  <SuggestionRow
                    key={p.sku}
                    type="product"
                    highlighted={highlight === idx}
                    onMouseEnter={() => setHighlight(idx)}
                    onClick={() => pickSuggestion({ type: "product", value: p })}
                  >
                    <span className="search__sug-img">
                      {p.image && <img src={p.image} alt="" />}
                    </span>
                    <span className="search__sug-info">
                      <span className="search__sug-name">{p.name}</span>
                      <span className="search__sug-meta">{p.brand}</span>
                    </span>
                    <b className="search__sug-price">{naira(p.price)}</b>
                  </SuggestionRow>
                );
              })}
              {results.totalProductMatches > results.products.length && (
                <button
                  className="search__seeall"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => submit()}
                >
                  See all {results.totalProductMatches} results for "{query}" →
                </button>
              )}
            </div>
          )}

          {/* CATEGORIES */}
          {query.length >= 2 && results.categories.length > 0 && (
            <div className="search__group">
              <div className="search__grouphead">
                <Tag size={13} /> Categories
              </div>
              {results.categories.map((c, i) => {
                const idx = results.products.length + i;
                return (
                  <SuggestionRow
                    key={c.id}
                    type="category"
                    highlighted={highlight === idx}
                    onMouseEnter={() => setHighlight(idx)}
                    onClick={() => pickSuggestion({ type: "category", value: c })}
                  >
                    <span className="search__sug-tagicon"><Icon name={c.icon} size={15} /></span>
                    <span className="search__sug-text">
                      Browse <b>{c.label}</b>
                    </span>
                  </SuggestionRow>
                );
              })}
            </div>
          )}

          {/* BRANDS */}
          {query.length >= 2 && results.brands.length > 0 && (
            <div className="search__group">
              <div className="search__grouphead">
                <Tag size={13} /> Brands
              </div>
              {results.brands.map((b, i) => {
                const idx = results.products.length + results.categories.length + i;
                return (
                  <SuggestionRow
                    key={b.id}
                    type="brand"
                    highlighted={highlight === idx}
                    onMouseEnter={() => setHighlight(idx)}
                    onClick={() => pickSuggestion({ type: "brand", value: b })}
                  >
                    <span className="search__sug-brandlogo">
                      <img src={b.logo} alt="" />
                    </span>
                    <span className="search__sug-text">
                      See all <b>{b.name}</b> products
                    </span>
                  </SuggestionRow>
                );
              })}
            </div>
          )}

          {/* EMPTY STATE */}
          {query.length >= 2 &&
            results.products.length === 0 &&
            results.categories.length === 0 &&
            results.brands.length === 0 && (
              <div className="search__empty">
                <p>No matches for <b>"{query}"</b>.</p>
                <small>Try a different keyword, brand, or category name.</small>
              </div>
            )}
        </div>
      )}
      </div>
    </>
  );
}

/** A single suggestion row — highlighted state shared with keyboard nav. */
function SuggestionRow({ highlighted, onMouseEnter, onClick, children }) {
  return (
    <div
      className={"search__sug" + (highlighted ? " search__sug--on" : "")}
      onMouseEnter={onMouseEnter}
      onMouseDown={(e) => e.preventDefault()} // keep focus on input
      onClick={onClick}
      role="option"
      aria-selected={highlighted}
    >
      {children}
    </div>
  );
}