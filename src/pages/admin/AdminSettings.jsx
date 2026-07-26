import { useState } from "react";
import {
  BadgeCheck, Bell, Boxes, Check, Moon, Package,
  Palette, RotateCcw, Sun, Sparkles, User,
} from "lucide-react";
import { useAdminTheme } from "../../context/AdminThemeContext.jsx";
import {
  ACCENT_PRESETS, BRAND_PRESETS, DENSITY_PRESETS, FONT_PRESETS,
  MODES, RADIUS_PRESETS,
} from "../../config/adminTokens.js";
import SwatchGrid from "../../components/admin/SwatchGrid.jsx";
import OptionCard from "../../components/admin/OptionCard.jsx";

/**
 * Admin Settings \u2014 Theme customization.
 *
 * All changes fire immediately (no Save button) because the theme
 * context persists on every setTheme call. The Reset button
 * restores DEFAULT_THEME.
 *
 * The right column is a Preview card that shows sample chrome
 * (buttons, chip, KPI-style tile) so operators can see the effect
 * without navigating away.
 */
export default function AdminSettings() {
  const { theme, setTheme, resetTheme } = useAdminTheme();
  const [savedFlash, setSavedFlash] = useState(null);

  function change(key, val) {
    setTheme(key, val);
    setSavedFlash(key);
    setTimeout(() => setSavedFlash((k) => (k === key ? null : k)), 1500);
  }

  function onReset() {
    if (!window.confirm("Reset the admin theme to Voltory defaults?")) return;
    resetTheme();
  }

  return (
    <div className="adm-page adm-settings">
      <header className="adm-page__head">
        <div>
          <h1>Settings</h1>
          <p>Customise the look of your admin console. Changes save automatically and follow your account across devices.</p>
        </div>
        <button className="adm-btn adm-btn--secondary" onClick={onReset}>
          <RotateCcw size={13} /> Reset to Voltory defaults
        </button>
      </header>

      <div className="adm-settings__split">
        {/* LEFT: controls */}
        <div className="adm-settings__controls">
          <section className="adm-widget">
            <header>
              <div>
                <b><Palette size={14} style={{ verticalAlign: "middle", marginRight: 6 }} /> Colors</b>
                <small>Sidebar brand color and interactive accent</small>
              </div>
              {savedFlash === "brand" || savedFlash === "accent" ? (
                <span className="adm-settings__flash"><Check size={12} /> Saved</span>
              ) : null}
            </header>
            <div className="adm-widget__body" style={{ padding: "18px 22px 22px" }}>
              <SwatchGrid
                label="Brand color"
                hint="Used for the sidebar and primary controls"
                options={BRAND_PRESETS}
                value={theme.brand}
                onChange={(v) => change("brand", v)}
              />
              <div style={{ height: 20 }} />
              <SwatchGrid
                label="Accent color"
                hint="Highlights, badges, active-state edges"
                options={ACCENT_PRESETS}
                value={theme.accent}
                onChange={(v) => change("accent", v)}
              />
            </div>
          </section>

          <section className="adm-widget">
            <header>
              <div>
                <b>Typography</b>
                <small>Font family for the entire admin console</small>
              </div>
              {savedFlash === "font" && <span className="adm-settings__flash"><Check size={12} /> Saved</span>}
            </header>
            <div className="adm-widget__body" style={{ padding: "18px 22px 22px" }}>
              <OptionCard
                label="Font"
                options={FONT_PRESETS}
                value={theme.font}
                onChange={(v) => change("font", v)}
                columns={3}
                renderPreview={(opt) => (
                  <span style={{ fontFamily: opt.stack, fontSize: 18, fontWeight: 700, letterSpacing: "-0.01em" }}>
                    Voltory Aa
                  </span>
                )}
              />
            </div>
          </section>

          <section className="adm-widget">
            <header>
              <div>
                <b>Shape & Density</b>
                <small>Corner radius and row height</small>
              </div>
              {(savedFlash === "radius" || savedFlash === "density") && (
                <span className="adm-settings__flash"><Check size={12} /> Saved</span>
              )}
            </header>
            <div className="adm-widget__body" style={{ padding: "18px 22px 22px" }}>
              <OptionCard
                label="Corner radius"
                hint="How rounded panels, buttons, and cards feel"
                options={RADIUS_PRESETS}
                value={theme.radius}
                onChange={(v) => change("radius", v)}
                columns={3}
                renderPreview={(opt) => (
                  <span
                    className="adm-optcard__demo-box"
                    style={{
                      borderRadius: opt.lg,
                      background: "var(--adm-brand-soft)",
                      border: "1px solid var(--adm-brand-line)",
                    }}
                  />
                )}
              />

              <div style={{ height: 18 }} />

              <OptionCard
                label="Density"
                hint="How much air the layout breathes"
                options={DENSITY_PRESETS}
                value={theme.density}
                onChange={(v) => change("density", v)}
                columns={3}
                renderPreview={(opt) => (
                  <div className="adm-optcard__demo-rows">
                    {[0, 1, 2].map((i) => (
                      <span key={i} style={{ height: opt.rowH === "36px" ? 8 : opt.rowH === "44px" ? 10 : 12, background: "var(--adm-hover)" }} />
                    ))}
                  </div>
                )}
              />
            </div>
          </section>

          <section className="adm-widget">
            <header>
              <div>
                <b>Appearance</b>
                <small>Light or dark theme (sidebar stays branded)</small>
              </div>
              {savedFlash === "mode" && <span className="adm-settings__flash"><Check size={12} /> Saved</span>}
            </header>
            <div className="adm-widget__body" style={{ padding: "18px 22px 22px" }}>
              <OptionCard
                label="Mode"
                options={MODES}
                value={theme.mode}
                onChange={(v) => change("mode", v)}
                columns={2}
                renderPreview={(_, key) => (
                  <span className="adm-optcard__demo-mode">
                    {key === "dark"
                      ? <><Moon size={20} /><em style={{ background: "#0F172A" }} /></>
                      : <><Sun size={20} /><em style={{ background: "#F8FAFC", border: "1px solid #E5E9F1" }} /></>
                    }
                  </span>
                )}
              />
            </div>
          </section>
        </div>

        {/* RIGHT: preview */}
        <aside className="adm-settings__preview">
          <div className="adm-widget">
            <header>
              <div>
                <b>Live preview</b>
                <small>Chrome samples using your current theme</small>
              </div>
            </header>
            <div className="adm-widget__body" style={{ padding: "18px 22px 22px", display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Sample buttons */}
              <div className="adm-settings__demo">
                <b className="adm-settings__demo-label">Buttons</b>
                <div className="adm-settings__demo-row">
                  <button className="adm-btn adm-btn--primary" type="button">
                    <BadgeCheck size={13} /> Primary
                  </button>
                  <button className="adm-btn adm-btn--secondary" type="button">
                    Secondary
                  </button>
                  <button className="adm-btn adm-btn--accent" type="button">
                    Accent
                  </button>
                </div>
              </div>

              {/* Sample chips */}
              <div className="adm-settings__demo">
                <b className="adm-settings__demo-label">Status chips</b>
                <div className="adm-settings__demo-row">
                  <span className="adm-chip adm-chip--ok">Delivered</span>
                  <span className="adm-chip adm-chip--warn">Processing</span>
                  <span className="adm-chip adm-chip--info">Confirmed</span>
                  <span className="adm-chip adm-chip--err">Cancelled</span>
                </div>
              </div>

              {/* Sample "table row" */}
              <div className="adm-settings__demo">
                <b className="adm-settings__demo-label">Table row</b>
                <div className="adm-settings__demo-tblrow">
                  <span className="adm-ptbl__thumb"><Package size={16} /></span>
                  <div className="adm-ptbl__product-meta">
                    <b>Voltory 1.5HP Split AC</b>
                    <small>SKU <span className="adm-mono">VAC-DEMO01</span></small>
                  </div>
                  <span style={{ fontWeight: 700 }}>₦520,000</span>
                  <span className="adm-chip adm-chip--ok">In Stock</span>
                </div>
              </div>

              {/* Sample KPI-style tile */}
              <div className="adm-settings__demo">
                <b className="adm-settings__demo-label">KPI tile</b>
                <div className="adm-settings__demo-kpi">
                  <span className="adm-kpi__icon" style={{ background: "var(--adm-brand-soft)", color: "var(--adm-brand)" }}>
                    <Sparkles size={17} />
                  </span>
                  <div>
                    <p className="adm-kpi__label">Total Revenue</p>
                    <p className="adm-kpi__value" style={{ margin: 0, fontSize: 22 }}>₦42,430,000</p>
                    <small className="adm-kpi__delta adm-kpi__delta--up">
                      ↑ 18.7% <span>vs last month</span>
                    </small>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="adm-widget">
            <header><div><b>Signed in as</b></div></header>
            <div className="adm-widget__body" style={{ padding: "12px 22px 18px" }}>
              <div className="adm-settings__account">
                <span className="adm-user__avatar">V</span>
                <div>
                  <b>Voltory Admin</b>
                  <small>Super Admin · preferences save to your account</small>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}