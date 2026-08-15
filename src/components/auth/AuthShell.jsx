import AuthShowcase from "./AuthShowcase.jsx";

/**
 * AuthShell — the two-column layout shared by all auth pages.
 *
 * Left: AuthShowcase (animated brand panel, identical across pages)
 * Right: whatever form the caller passes in via {children}
 *
 * The right panel is deliberately unopinionated — each auth page
 * (Login, SignUp, whatever comes next) owns its own form JSX and
 * hook wiring. This shell just guarantees they all wear the same
 * left panel and the same responsive layout.
 *
 * Usage:
 *   <AuthShell>
 *     <div className="ashell-form__inner">
 *       ...form goes here...
 *     </div>
 *   </AuthShell>
 */
export default function AuthShell({ children }) {
  return (
    <div className="ashell-page">
      <AuthShowcase />
      <section className="ashell-form">
        {children}
      </section>
    </div>
  );
}