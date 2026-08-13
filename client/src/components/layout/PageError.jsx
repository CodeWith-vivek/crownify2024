/**
 * Shown when a page's data request fails.
 *
 * Without this, a failed fetch falls through to the page's empty state — so a
 * network error on /cart reads as "Your Cart is Empty" and a failed /orders
 * request reads as "You have not ordered anything yet". That wrongly tells
 * people their data is gone. This distinguishes "we couldn't load it" from
 * "there's genuinely nothing here", and offers a retry.
 */
export function PageError({ title = "Something went wrong", message = "We couldn't load this page. Please check your connection and try again.", onRetry }) {
  return (
    <div className="container" style={{ padding: "70px 15px", textAlign: "center" }}>
      <div style={{ maxWidth: 460, margin: "0 auto" }}>
        <i className="fa fa-triangle-exclamation" style={{ fontSize: 40, color: "#dc0909", marginBottom: 18, display: "block" }}></i>
        <h3 style={{ fontWeight: 600, marginBottom: 10 }}>{title}</h3>
        <p style={{ color: "#777", lineHeight: 1.6, marginBottom: 22 }}>{message}</p>
        <button
          type="button"
          className="btn btn-primary"
          style={{ backgroundColor: "#291616", borderColor: "#291616", minWidth: 150 }}
          onClick={() => (onRetry ? onRetry() : window.location.reload())}
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
