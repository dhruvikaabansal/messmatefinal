import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

/**
 * Toasts and a promise-based confirm dialog.
 *
 * The old build used window.alert / window.confirm, which are blocking, ugly on
 * mobile, and impossible to style. Everything user-facing now flows through
 * here so feedback is consistent and non-blocking.
 */

const ToastContext = createContext(null);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
};

let nextId = 1;

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);

  const dismiss = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const push = useCallback(
    (message, tone = 'info', ms = 3200) => {
      const id = nextId++;
      setToasts((t) => [...t, { id, message, tone }]);
      if (ms) setTimeout(() => dismiss(id), ms);
      return id;
    },
    [dismiss]
  );

  const confirm = useCallback(
    ({ title, body, confirmLabel = 'Confirm', tone = 'danger' }) =>
      new Promise((resolve) => {
        setConfirmState({ title, body, confirmLabel, tone, resolve });
      }),
    []
  );

  const closeConfirm = (answer) => {
    confirmState?.resolve(answer);
    setConfirmState(null);
  };

  const value = useMemo(
    () => ({
      toast: push,
      success: (m) => push(m, 'success'),
      error: (m) => push(m, 'error', 4200),
      confirm,
    }),
    [push, confirm]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div className="toast-host" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.tone}`} onClick={() => dismiss(t.id)}>
            <span className="grow">{t.message}</span>
          </div>
        ))}
      </div>

      {confirmState && (
        <div className="overlay" role="dialog" aria-modal="true" onClick={() => closeConfirm(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="stack">
              <h2>{confirmState.title}</h2>
              {confirmState.body && <p className="muted">{confirmState.body}</p>}
              <div className="row" style={{ marginTop: 8 }}>
                <button className="btn btn--ghost grow" onClick={() => closeConfirm(false)}>
                  Cancel
                </button>
                <button
                  className={`btn grow ${confirmState.tone === 'danger' ? 'btn--danger' : 'btn--primary'}`}
                  onClick={() => closeConfirm(true)}
                >
                  {confirmState.confirmLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
};
