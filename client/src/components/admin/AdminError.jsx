/**
 * Shown when an admin page's data request fails.
 *
 * Without it, a failed fetch falls through to the page's empty state — so a
 * network error on the product list reads as "no products", and on the
 * dashboard as zeroed-out revenue. For an admin that's actively misleading:
 * it looks like the data was deleted rather than that the request failed.
 */
export function AdminError({
  title = "Couldn't load this data",
  message = "We couldn't reach the server. Nothing has been changed — please try again.",
  onRetry,
}) {
  return (
    <div className="adm-card" style={{ padding: "48px 24px", textAlign: "center" }}>
      <span className="material-icons" style={{ fontSize: 40, color: "var(--adm-accent, #dc0909)" }}>
        error_outline
      </span>
      <h3 style={{ margin: "12px 0 6px", fontSize: 18, fontWeight: 600 }}>{title}</h3>
      <p style={{ color: "var(--adm-muted, #6b7280)", marginBottom: 20 }}>{message}</p>
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => (onRetry ? onRetry() : window.location.reload())}
      >
        Try Again
      </button>
    </div>
  );
}
