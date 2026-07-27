import "./Toast.css";

/**
 * Renders a stack of toast notifications. `toasts` is an array of
 * { id, type: 'success' | 'error' | 'info', message }. Managed by the
 * useToasts hook below -- import both together.
 */
export default function Toast({ toasts, onDismiss }) {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div className={`toast toast-${t.type}`} key={t.id}>
          <span className="toast-message">{t.message}</span>
          <button
            className="toast-dismiss"
            onClick={() => onDismiss(t.id)}
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
