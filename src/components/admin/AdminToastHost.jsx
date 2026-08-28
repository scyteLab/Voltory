import { useEffect, useState } from "react";
import { AlertCircle, Check, X } from "lucide-react";
import { subscribeAdminToast } from "../../lib/adminToast.js";

const AUTO_DISMISS_MS = 3500;

/**
 * Renders whatever adminToast.success()/error() emit. Mounted once
 * in AdminShell — never imported by individual admin pages.
 */
export default function AdminToastHost() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    return subscribeAdminToast((toast) => {
      setToasts((prev) => [...prev, toast]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, AUTO_DISMISS_MS);
    });
  }, []);

  function dismiss(id) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  if (!toasts.length) return null;

  return (
    <div className="adm-toast-host">
      {toasts.map((t) => (
        <div key={t.id} className={"adm-toast adm-toast--" + t.type} role="status">
          {t.type === "success" ? <Check size={15} /> : <AlertCircle size={15} />}
          <span>{t.message}</span>
          <button onClick={() => dismiss(t.id)} aria-label="Dismiss">
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}
