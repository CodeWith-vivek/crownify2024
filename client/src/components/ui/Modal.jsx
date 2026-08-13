import { useEffect } from "react";

const DEFAULT_CONTENT_STYLE = {
  backgroundImage: "url('/assets/images/editAddress2.png')",
  backgroundSize: "cover",
  backgroundPosition: "center",
  backgroundRepeat: "no-repeat",
  backdropFilter: "blur(10px)",
};

// plain=true skips the default background/blur/header chrome — for content
// (like the pixel-perfect AddressForm) that already supplies its own full
// visuals and title, where the generic header would just duplicate it.
//
// modal-content itself does NOT scroll — it stays fixed at up to 90vh so the
// close button (and, for plain content like AddressForm's banner image side)
// never scrolls out of view. Scrollable content is responsible for its own
// internal overflow (see AddressForm's .login-wrap).
export function Modal({ open, onClose, title, children, dialogClassName = "", plain = false }) {
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open) return null;
  return (
    <>
      <div
        className="modal fade show"
        style={{ display: "block", zIndex: 1055, position: "fixed", inset: 0 }}
        tabIndex="-1"
        role="dialog"
      >
        <div
          className={`modal-dialog modal-dialog-centered ${dialogClassName}`.trim()}
          role="document"
          style={{ maxHeight: "90vh", position: "relative" }}
        >
          <div
            className="modal-content"
            style={{
              ...(plain ? { background: "none", border: "none" } : DEFAULT_CONTENT_STYLE),
              maxHeight: "90vh",
              overflow: "hidden",
              position: "relative",
            }}
          >
            {plain ? (
              <>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={onClose}
                  style={{
                    position: "absolute",
                    top: 10,
                    right: 10,
                    zIndex: 5,
                    width: 34,
                    height: 34,
                    borderRadius: "50%",
                    border: "none",
                    background: "rgba(0,0,0,0.55)",
                    color: "#fff",
                    fontSize: 18,
                    lineHeight: 1,
                    cursor: "pointer",
                  }}
                >
                  ×
                </button>
                {children}
              </>
            ) : (
              <>
                <div className="modal-header">
                  <h5 className="modal-title">{title}</h5>
                  <button type="button" className="btn-close" aria-label="Close" onClick={onClose}></button>
                </div>
                <div className="modal-body" style={{ maxHeight: "calc(90vh - 60px)", overflowY: "auto" }}>{children}</div>
              </>
            )}
          </div>
        </div>
      </div>
      <div
        className="modal-backdrop fade show"
        onClick={onClose}
        style={{ zIndex: 1050, position: "fixed", inset: 0 }}
      ></div>
    </>
  );
}
