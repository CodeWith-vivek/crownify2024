import { useEffect, useSyncExternalStore } from "react";

// Promise-based replacement for window.confirm()'s native browser popup
// ("localhost:5173 says...") — that dialog is unstyled and can't match the
// site design. Module-level singleton (same subscribe/notify pattern as
// useStylesheets.js) so any file can call confirm(...) without needing to
// mount its own dialog — one <ConfirmDialogHost/> in main.jsx serves all of
// them, user and admin alike.
let state = null;
const listeners = new Set();
function notify() {
  listeners.forEach((cb) => cb());
}
function subscribe(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function getState() {
  return state;
}

/**
 * @param {string} message
 * @param {{ confirmText?: string, cancelText?: string, danger?: boolean }} [options]
 *   danger (default true) colors the confirm button red — set false for
 *   neutral actions like "set as primary" that aren't destructive.
 * @returns {Promise<boolean>}
 */
export function confirm(message, options = {}) {
  return new Promise((resolve) => {
    state = {
      message,
      confirmText: options.confirmText || "Confirm",
      cancelText: options.cancelText || "Cancel",
      danger: options.danger !== false,
      resolve,
    };
    notify();
  });
}

function settle(result) {
  state?.resolve(result);
  state = null;
  notify();
}

export function ConfirmDialogHost() {
  const current = useSyncExternalStore(subscribe, getState, getState);

  useEffect(() => {
    if (!current) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [current]);

  useEffect(() => {
    if (!current) return;
    const onKey = (e) => {
      if (e.key === "Escape") settle(false);
      if (e.key === "Enter") settle(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current]);

  if (!current) return null;

  // Fully inline-styled, like Preloader — this can render on any page
  // regardless of which of the 17 CSS profiles happens to be loaded.
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div
        onClick={() => settle(false)}
        style={{ position: "absolute", inset: 0, background: "rgba(16,24,40,0.55)" }}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        style={{
          position: "relative",
          background: "#fff",
          borderRadius: 14,
          padding: "30px 28px 26px",
          maxWidth: 420,
          width: "90%",
          boxShadow: "0 20px 44px rgba(16,24,40,0.28)",
          textAlign: "center",
          fontFamily: "inherit",
        }}
      >
        <p style={{ margin: "0 0 26px", fontSize: 16, color: "#291616", lineHeight: 1.55 }}>{current.message}</p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <button
            type="button"
            onClick={() => settle(false)}
            style={{
              padding: "10px 24px",
              borderRadius: 8,
              border: "1px solid #ddd",
              background: "#fff",
              color: "#291616",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            {current.cancelText}
          </button>
          <button
            type="button"
            onClick={() => settle(true)}
            autoFocus
            style={{
              padding: "10px 24px",
              borderRadius: 8,
              border: "none",
              background: current.danger ? "#dc0909" : "#291616",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            {current.confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
