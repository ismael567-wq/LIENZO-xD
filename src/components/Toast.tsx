import { useEffect } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { useLienzo } from '../store/boardStore';

export function Toast() {
  const toast = useLienzo((state) => state.toast);
  const dismissToast = useLienzo((state) => state.dismissToast);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => dismissToast(toast.id), 3600);
    return () => clearTimeout(timer);
  }, [toast, dismissToast]);

  if (!toast) return null;
  return (
    <div className={`toast is-${toast.kind}`} role="status" aria-live="polite">
      <span className="toast-icon">
        {toast.kind === 'success' ? (
          <CheckCircle2 size={17} />
        ) : toast.kind === 'error' ? (
          <AlertTriangle size={17} />
        ) : (
          <Info size={17} />
        )}
      </span>
      <span>{toast.text}</span>
      <button type="button" onClick={() => dismissToast(toast.id)} aria-label="Cerrar aviso">
        <X size={14} />
      </button>
    </div>
  );
}
