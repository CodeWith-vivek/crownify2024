import { useParams, useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "../adminApi";
import { AdminError } from "@/components/admin/AdminError";

function InfoCard({ icon, title, children }) {
  return (
    <div className="adm-card">
      <div className="adm-card__body" style={{ display: "flex", gap: 14 }}>
        <span className="adm-stat__icon" style={{ width: 40, height: 40 }}>
          <i className="material-icons" style={{ fontSize: 20 }}>
            {icon}
          </i>
        </span>
        <div style={{ minWidth: 0 }}>
          <p className="adm-stat__label" style={{ marginBottom: 6 }}>
            {title}
          </p>
          <div style={{ fontSize: 14, lineHeight: 1.6 }}>{children}</div>
        </div>
      </div>
    </div>
  );
}

export function OrderDetailsPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const itemId = searchParams.get("itemId");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-order-details", id, itemId],
    queryFn: () => adminApi.orderDetails(id, itemId),
  });

  // isError first — on a failed request data is undefined, so the
  // "not found" branch would otherwise claim the order doesn't exist.
  if (isError) return <AdminError onRetry={refetch} />;
  if (isLoading) return <p style={{ color: "var(--adm-text-muted)" }}>Loading order…</p>;

  const order = data?.order;
  const orderItem = data?.orderItem;
  const financials = data?.financials;
  if (!order || !orderItem) return <p style={{ color: "var(--adm-text-muted)" }}>Order not found.</p>;

  return (
    <>
      <div className="adm-page-head">
        <div>
          <h1>Order #{order.orderNumber}</h1>
          <p>Placed {new Date(order.orderedAt).toLocaleString()}</p>
        </div>
        <div className="adm-page-head__actions">
          <Link to="/admin/orderlist" className="btn btn-secondary">
            <i className="material-icons">arrow_back</i>
            Back to orders
          </Link>
        </div>
      </div>

      <div className="adm-grid-2" style={{ marginBottom: 20 }}>
        <InfoCard icon="person" title="Customer">
          <div className="adm-cell-title">{order.userId?.name}</div>
          <div className="adm-cell-sub">{order.userId?.email}</div>
        </InfoCard>

        <InfoCard icon="payments" title="Payment">
          <div className="adm-cell-title">{order.paymentMethod}</div>
          <div className="adm-cell-sub">{order.paymentStatus}</div>
        </InfoCard>

        <InfoCard icon="local_shipping" title="Deliver to">
          <div className="adm-cell-sub">
            {order.shippingAddress?.flatHouseCompany || "N/A"}
            <br />
            {order.shippingAddress?.city || "N/A"} — {order.shippingAddress?.postalCode || "N/A"}
          </div>
        </InfoCard>
      </div>

      <div className="adm-card">
        <div className="adm-card__head">Item</div>
        <div className="adm-tablewrap">
          <table className="table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Unit price</th>
                <th>Quantity</th>
                <th style={{ textAlign: "right" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <div className="adm-cell-media">
                    <img className="adm-thumb adm-thumb--lg" src={`/uploads/product-image/${orderItem.productImage}`} alt="" />
                    <div style={{ minWidth: 0 }}>
                      <div className="adm-cell-title">{orderItem.productName}</div>
                      {orderItem.variant && (
                        <div className="adm-cell-sub">
                          {orderItem.variant.size} · {orderItem.variant.color}
                        </div>
                      )}
                      <span className="adm-badge" style={{ marginTop: 6 }}>
                        {orderItem.orderStatus}
                      </span>
                    </div>
                  </div>
                </td>
                <td>₹{orderItem.salePrice}</td>
                <td>{orderItem.quantity}</td>
                <td style={{ textAlign: "right" }}>
                  <span className="adm-cell-title">₹{orderItem.totalPrice}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="adm-card__body" style={{ borderTop: "1px solid var(--adm-border)", display: "flex", justifyContent: "flex-end" }}>
          <div style={{ minWidth: 260 }}>
            <div className="adm-list-row">
              <span style={{ color: "var(--adm-text-muted)" }}>Item total</span>
              <span className="adm-list-row__value">₹{orderItem.totalPrice}</span>
            </div>
            {financials?.hasVoidedItems && (
              <>
                <div className="adm-list-row">
                  <span style={{ color: "var(--adm-text-muted)" }}>Order total (original)</span>
                  <span className="adm-list-row__value">₹{financials.orderTotal}</span>
                </div>
                <div className="adm-list-row">
                  <span style={{ color: "var(--adm-text-muted)" }}>Amount payable now</span>
                  <span className="adm-list-row__value">₹{financials.amountPayable}</span>
                </div>
              </>
            )}
            <p className="adm-help" style={{ marginTop: 10 }}>
              Shipping charged separately. Coupon discounts apply at order level.
              {financials?.hasVoidedItems &&
                " Other items on this order have been cancelled/returned, so the order's original total no longer matches what's payable."}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
