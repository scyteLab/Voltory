import { useEffect, useState } from "react";
import { Check, KeyRound, Palette } from "lucide-react";
import { useAdmin } from "../../context/AdminContext.jsx";
import { useStore } from "../../context/StoreContext.jsx";
import { SITE } from "../../config/site.js";

const FONT_PAIRS = [
  { id: "default", label: "Default", note: "Roboto — clean and neutral.", family: '"Roboto", system-ui, sans-serif' },
  { id: "playful", label: "Playful", note: "Fredoka + Nunito — rounded and friendly.", family: '"Fredoka", system-ui, sans-serif' },
];

export default function AdminSettings() {
  const { admin, changePassword } = useAdmin();
  const { theme, fontPair, saveAppearance } = useStore();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState(null);
  const [ok, setOk] = useState(false);
  const [saving, setSaving] = useState(false);

  const [selTheme, setSelTheme] = useState(theme);
  const [selFont, setSelFont] = useState(fontPair);
  const [appearanceSaving, setAppearanceSaving] = useState(false);
  const [appearanceOk, setAppearanceOk] = useState(false);
  const [appearanceError, setAppearanceError] = useState(null);

  // Site settings load async — keep the pickers in sync once they arrive.
  useEffect(() => { setSelTheme(theme); }, [theme]);
  useEffect(() => { setSelFont(fontPair); }, [fontPair]);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setOk(false);
    if (next.length < 8) return setError("New password must be at least 8 characters.");
    if (next !== confirm) return setError("New password and confirmation don't match.");

    setSaving(true);
    try {
      await changePassword(current, next);
      setCurrent(""); setNext(""); setConfirm("");
      setOk(true);
    } catch (e2) {
      setError(e2.message);
    } finally {
      setSaving(false);
    }
  }

  async function onSaveAppearance() {
    setAppearanceError(null);
    setAppearanceOk(false);
    setAppearanceSaving(true);
    try {
      await saveAppearance({ theme: selTheme, font_pair: selFont });
      setAppearanceOk(true);
    } catch (e) {
      setAppearanceError(e.message);
    } finally {
      setAppearanceSaving(false);
    }
  }

  const appearanceDirty = selTheme !== theme || selFont !== fontPair;

  return (
    <div className="adm-page">
      <div className="adm-page__head">
        <div>
          <p className="adm-crumb">Dashboard / Settings</p>
          <h1>Settings</h1>
          <p className="adm-page__sub">Signed in as {admin?.email}.</p>
        </div>
      </div>

      <div className="adm-table-card adm-settings-card">
        <div className="adm-panel__head">
          <h2><Palette size={16} /> Site Appearance</h2>
        </div>
        <p className="adm-page__sub" style={{ marginBottom: 14 }}>
          Applies instantly, site-wide, for every visitor — not just this browser.
        </p>

        {appearanceError && <p className="adm-form-error">{appearanceError}</p>}
        {appearanceOk && !appearanceDirty && <p className="adm-form-ok">Appearance updated for the whole site.</p>}

        <p className="adm-swatch-label">Color Theme</p>
        <div className="adm-swatch-grid">
          {SITE.themes.map((t) => (
            <button
              type="button"
              key={t.id}
              className={"adm-swatch-card" + (selTheme === t.id ? " adm-swatch-card--on" : "")}
              onClick={() => { setSelTheme(t.id); setAppearanceOk(false); }}
            >
              <span className="adm-swatch-dots">
                {t.swatches.map((c) => <span key={c} style={{ background: c }} />)}
              </span>
              <span className="adm-swatch-meta">
                <b>{t.label}</b>
                <small>{t.note}</small>
              </span>
              {selTheme === t.id && <Check size={16} className="adm-swatch-check" />}
            </button>
          ))}
        </div>

        <p className="adm-swatch-label">Font Pairing</p>
        <div className="adm-swatch-grid">
          {FONT_PAIRS.map((f) => (
            <button
              type="button"
              key={f.id}
              className={"adm-swatch-card" + (selFont === f.id ? " adm-swatch-card--on" : "")}
              onClick={() => { setSelFont(f.id); setAppearanceOk(false); }}
            >
              <span className="adm-swatch-meta">
                <b style={{ fontFamily: f.family }}>{f.label} — Voltory</b>
                <small>{f.note}</small>
              </span>
              {selFont === f.id && <Check size={16} className="adm-swatch-check" />}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="adm-btn adm-btn--primary"
          disabled={!appearanceDirty || appearanceSaving}
          onClick={onSaveAppearance}
          style={{ marginTop: 6 }}
        >
          {appearanceSaving ? "Applying…" : "Apply to Site"}
        </button>
      </div>

      <div className="adm-table-card adm-settings-card">
        <div className="adm-panel__head">
          <h2><KeyRound size={16} /> Change Password</h2>
        </div>
        <form className="adm-settings-form" onSubmit={onSubmit}>
          {error && <p className="adm-form-error">{error}</p>}
          {ok && <p className="adm-form-ok">Password updated.</p>}

          <label className="adm-field">
            <span>Current Password</span>
            <input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
          </label>
          <label className="adm-field">
            <span>New Password</span>
            <input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={8} />
          </label>
          <label className="adm-field">
            <span>Confirm New Password</span>
            <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} />
          </label>

          <button type="submit" className="adm-btn adm-btn--primary" disabled={saving}>
            {saving ? "Updating…" : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
