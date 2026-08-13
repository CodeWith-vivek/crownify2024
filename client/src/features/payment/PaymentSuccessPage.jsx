import { useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { usePageAssets } from "@/lib/usePageAssets";
import { userProfiles } from "@/styles/userProfiles";
import { paymentApi } from "./paymentApi";
import { Preloader, usePreloaderVisible } from "@/components/layout/Preloader";
import { PageError } from "@/components/layout/PageError";

export function PaymentSuccessPage() {
  usePageAssets("user", "headerpaymentSuccess", userProfiles);
  const showPreloader = usePreloaderVisible();

  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("orderId");

  const { data, isError, refetch } = useQuery({
    queryKey: ["payment-success", orderId],
    queryFn: () => paymentApi.success(orderId),
    enabled: !!orderId,
  });

  const order = data?.order;
  const user = data?.user;

  // A failed lookup must not sit on a blank page forever — say so and offer
  // a retry, rather than rendering null indefinitely.
  if (isError) return <PageError title="Couldn't load your order" message="We couldn't reach the server. Your order status is unchanged — please try again." onRetry={refetch} />;

  // Preloader must survive the early return below, otherwise the page paints
  // bare while the order request is still in flight.
  if (!order) return showPreloader ? <Preloader /> : null;

  return (
    <>
      {showPreloader && <Preloader />}
      <div className="container-fluid crownify4 d-flex justify-content-center align-items-center">
        <img src="/assets/admin/images/logo/Crownify_logo_text.png" className="custom-logo" />
      </div>
      <div className="wrapper" style={{ position: "relative", overflow: "hidden" }}>
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "url('/assets/images/capSuccessBlur.webp') no-repeat center center",
            backgroundSize: "cover",
            filter: "blur(8px)",
            zIndex: 0,
          }}
        ></div>

        <div
          className="card"
          style={{
            position: "relative",
            zIndex: 1,
            backgroundColor: "#fff",
            borderRadius: 10,
            boxShadow: "0px 4px 8px rgba(0, 0, 0, 0.2)",
            padding: 20,
            textAlign: "center",
          }}
        >
          <div className="icon-container">
            <svg className="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>
          <h1>Order Successfully Placed</h1>

          <div className="order-details" style={{ marginBottom: 30 }}>
            <div className="left-side">
              <p>
                <span className="label">Order ID</span>
              </p>
              <p>
                <span className="label">Name</span>
              </p>
              <p>
                <span className="label">Date</span>
              </p>
              <p>
                <span className="label">Payment</span>
              </p>
              <p>
                <span className="label">Payment Status</span>
              </p>
              <p>
                <span className="label">Amount</span>
              </p>
            </div>
            <div className="right-side">
              <p>
                <span className="value" id="orderNumber">
                  {order.orderNumber.slice(-4)}
                </span>
              </p>
              <p>
                <span className="value">{user?.name || "N/A"}</span>
              </p>
              <p>
                <span className="value">{new Date(order.orderedAt).toLocaleDateString()}</span>
              </p>
              <p>
                <span className="value">{order.paymentMethod}</span>
              </p>
              <p>
                <span className="value">{order.paymentStatus}</span>
              </p>
              <p>
                <span className="value">INR {order.grandTotal.toFixed(2)}</span>
              </p>
            </div>
          </div>

          <Link to="/orders" className="button" style={{ width: 320, maxWidth: "100%" }}>
            View Order Details
          </Link>
          <Link to="/" style={{ width: 320, maxWidth: "100%" }} className="button">
            Continue Shopping
          </Link>
        </div>
      </div>
      <div className="container-fluid crownify4 d-flex justify-content-center align-items-center">
        <img src="/assets/admin/images/logo/Crownify_logo_text.png" className="custom-logo" />
      </div>
    </>
  );
}
