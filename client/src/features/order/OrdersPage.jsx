import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { profileApi } from "@/features/profile/profileApi";
import { PageError } from "@/components/layout/PageError";
import { orderApi } from "./orderApi";
import { paymentApi } from "@/features/payment/paymentApi";
import { useRazorpayScript } from "@/lib/useRazorpayScript";
import { confirm } from "@/components/ui/ConfirmDialog";
import { productImageUrl } from "@/lib/imageUrl";

function actionForStatus(status, order, item, onCancel, onReturn, onCancelReturn) {
  if (["Placed", "Confirmed", "Failed"].includes(status)) {
    return (
      <button className="btn btn-danger btn-sm" onClick={() => onCancel(order, item)}>
        Cancel
      </button>
    );
  }
  if (status === "Delivered") {
    return (
      <button className="btn btn-warning btn-sm" onClick={() => onReturn(order, item)}>
        Return
      </button>
    );
  }
  if (status === "Return requested") {
    return (
      <button className="btn btn-danger btn-sm" onClick={() => onCancelReturn(order, item)}>
        Cancel Return
      </button>
    );
  }
  return null;
}

export function OrdersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = 10;
  const queryClient = useQueryClient();
  const razorpayReady = useRazorpayScript();

  const { data, isError, refetch } = useQuery({
    queryKey: ["orders", page],
    queryFn: () => profileApi.orders(page, limit),
  });

  const [retrying, setRetrying] = useState(null);
  const [viewOrder, setViewOrder] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelComment, setCancelComment] = useState("");
  const [returnTarget, setReturnTarget] = useState(null);
  const [returnComment, setReturnComment] = useState("");

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["orders"] });

  const submitCancel = async () => {
    if (!cancelTarget) return;
    const { order, item } = cancelTarget;
    try {
      const res = await orderApi.cancelOrder({
        orderNumber: order.orderNumber,
        productSize: item.variant?.size,
        productColor: item.variant?.color,
        cancelComment,
      });
      if (res?.success) {
        toast.success("The item has been successfully canceled.");
        setCancelTarget(null);
        setCancelComment("");
        await refresh();
      } else {
        toast.error(res?.message || "Failed to cancel the item.");
      }
    } catch (err) {
      toast.error(err.message || "Failed to cancel the item.");
    }
  };

  const submitReturn = async () => {
    if (!returnTarget) return;
    if (!returnComment.trim()) {
      toast.error("Please provide a reason for return before proceeding.");
      return;
    }
    const { order, item } = returnTarget;
    try {
      const res = await orderApi.returnItem({
        orderNumber: order.orderNumber,
        productSize: item.variant?.size,
        productColor: item.variant?.color,
        returnComment,
      });
      if (res?.success) {
        toast.success("Your return request has been submitted successfully.");
        setReturnTarget(null);
        setReturnComment("");
        await refresh();
      } else {
        toast.error(res?.message || "Failed to submit the return request.");
      }
    } catch (err) {
      toast.error(err.message || "Failed to submit the return request.");
    }
  };

  const handleCancelReturn = async (order, item) => {
    if (!await confirm("Do you really want to cancel this return request?")) return;
    try {
      const res = await orderApi.cancelReturn({
        orderNumber: order.orderNumber,
        productSize: item.variant?.size,
        productColor: item.variant?.color,
      });
      if (res?.success) {
        toast.success("The return request has been successfully canceled.");
        await refresh();
      } else {
        toast.error(res?.message || "Failed to cancel the return request.");
      }
    } catch (err) {
      toast.error(err.message || "Failed to cancel the return request.");
    }
  };

  const handleRetryPayment = async (order) => {
    if (!razorpayReady || !window.Razorpay) {
      toast.error("Payment gateway is still loading, please try again");
      return;
    }
    setRetrying(order.orderNumber);
    try {
      const res = await paymentApi.retryPayment(order.orderNumber);
      if (!res?.success) {
        toast.error("Unable to initiate payment. Please try again later.");
        return;
      }
      const rzp = new window.Razorpay({
        key: res.key,
        amount: res.amount,
        currency: "INR",
        name: "CROWNIFY",
        description: "Retry Payment",
        order_id: res.orderId,
        handler: async (response) => {
          try {
            await paymentApi.updateOrderStatus({
              orderNumber: res.orderNumber,
              paymentId: response.razorpay_payment_id,
              razorpayOrderId: response.razorpay_order_id,
              razorpaySignature: response.razorpay_signature,
              items: order.items,
            });
            toast.success("Your payment has been processed successfully.");
            await refresh();
          } catch {
            toast.error("There was an issue updating your order status. Please try again later.");
          }
        },
        theme: { color: "#F37254" },
      });
      rzp.open();
    } catch (err) {
      toast.error("There was an issue processing your payment. Please try again later.");
    } finally {
      setRetrying(null);
    }
  };

  const orders = data?.orders || [];
  const currentPage = data?.currentPage || page;
  const totalPages = data?.totalPages || 1;
  const user = data?.user;

  // Without this a failed request falls through to "You have not ordered
  // anything yet", which wrongly suggests the order history was lost.
  if (isError) {
    return (
        <div className="col-md-9">
          <PageError title="Couldn't load your orders" message="We couldn't reach the server. Your order history is safe — please try again." onRetry={refetch} />
        </div>
    );
  }

  return (
      <div className="col-md-9">
        <div id="orderModal" className="modal" style={{ display: viewOrder ? "block" : "none" }}>
          <div className="modal-content">
            <span className="close" onClick={() => setViewOrder(null)}>
              &times;
            </span>
            <h2 className="mb-4">Order Details - {viewOrder?.orderNumber}</h2>
            {viewOrder && (
              <div id="orderDetails">
                <div className="order-info mb-4">
                  <p>
                    <strong>Name:</strong> {user?.name}
                  </p>
                  <p>
                    <strong>Order Date:</strong> {new Date(viewOrder.createdAt).toLocaleDateString()}
                  </p>
                  <p>
                    <strong>Payment Status:</strong> {viewOrder.paymentStatus}
                  </p>
                </div>
                <h3 className="mb-3">Items</h3>
                <div className="table-responsive">
                  <table className="table table-hover">
                    <thead className="table-light">
                      <tr>
                        <th>Product</th>
                        <th>Quantity</th>
                        <th>Price</th>
                        <th>Total</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewOrder.items.map((item, idx) => (
                        <tr key={idx}>
                          <td>{item.productId?.productName || "Product Name"}</td>
                          <td>{item.quantity}</td>
                          <td>₹{item.productId?.salePrice || item.productId?.regularPrice || 0}</td>
                          <td>₹{(item.productId?.salePrice || item.productId?.regularPrice || 0) * item.quantity}</td>
                          <td>{item.orderStatus || "Pending"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div id="orderSummary" className="mt-4">
                    <p>
                      <strong>Subtotal:</strong> ₹{viewOrder.subtotal || 0}
                    </p>
                    <p>
                      <strong>Discount:</strong> ₹{viewOrder.discount || 0}
                    </p>
                    <p>
                      <strong>Shipping:</strong> ₹40
                    </p>
                    <p className={viewOrder.financials?.hasVoidedItems ? "h6 text-muted mb-1" : "h5"}>
                      <strong>Order Total:</strong> ₹{viewOrder.financials?.orderTotal ?? viewOrder.grandTotal ?? 0}
                    </p>
                    {viewOrder.financials?.hasVoidedItems && (
                      <p className="h5">
                        <strong>Amount Payable:</strong> ₹{viewOrder.financials.amountPayable}
                        <span className="text-muted" style={{ fontSize: "0.75em", fontWeight: "normal" }}>
                          {" "}
                          (₹{viewOrder.financials.voidedAmount} cancelled/refunded)
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div id="cancelModal" className="modal" style={{ display: cancelTarget ? "block" : "none" }}>
          <div className="modal-content p-4">
            <h4>Cancel Item</h4>
            {cancelTarget && (
              <>
                <p>
                  <strong>Order ID:</strong> {cancelTarget.order.orderNumber}
                </p>
                <p style={{ marginBottom: 20 }}>
                  *Note: Refund amounts may vary based on the cancellation of items in your order. Shipping costs are calculated proportionately, which may affect the total refund.
                </p>
                <div className="d-flex align-items-start mb-3">
                  <img src={productImageUrl(cancelTarget.item.productImage)} alt="Product Image" className="me-3 rounded" width="100" height="100" />
                  <div>
                    <p>
                      <strong>Product Name:</strong> {cancelTarget.item.productId?.productName}
                    </p>
                    <p>
                      <strong>Size:</strong> {cancelTarget.item.variant?.size}
                    </p>
                    <p>
                      <strong>Color:</strong> {cancelTarget.item.variant?.color}
                    </p>
                    <p>
                      <strong>Price:</strong> ₹{cancelTarget.item.productId?.salePrice || cancelTarget.item.productId?.regularPrice || 0}
                    </p>
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="cancelComment">Reason for cancellation:</label>
                  <textarea id="cancelComment" className="form-control" rows={3} placeholder="Enter your reason" value={cancelComment} onChange={(e) => setCancelComment(e.target.value)}></textarea>
                </div>
                <div className="d-flex justify-content-between mt-3">
                  <button className="btn btn-primary" onClick={submitCancel}>
                    Submit
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      setCancelTarget(null);
                      setCancelComment("");
                    }}
                  >
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div id="returnModal" className="modal" style={{ display: returnTarget ? "block" : "none" }}>
          <div className="modal-content p-4">
            <h4>Return Item</h4>
            {returnTarget && (
              <>
                <p>
                  <strong>Order ID:</strong> {returnTarget.order.orderNumber}
                </p>
                <div className="d-flex align-items-start mb-3">
                  <img src={productImageUrl(returnTarget.item.productImage)} alt="Product Image" className="me-3 rounded" width="100" height="100" />
                  <div>
                    <p>
                      <strong>Product Name:</strong> {returnTarget.item.productId?.productName}
                    </p>
                    <p>
                      <strong>Size:</strong> {returnTarget.item.variant?.size}
                    </p>
                    <p>
                      <strong>Color:</strong> {returnTarget.item.variant?.color}
                    </p>
                    <p>
                      <strong>Price:</strong> ₹{returnTarget.item.productId?.salePrice || returnTarget.item.productId?.regularPrice || 0}
                    </p>
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="returnComment">Reason for return:</label>
                  <textarea id="returnComment" className="form-control" rows={3} placeholder="Enter your reason" value={returnComment} onChange={(e) => setReturnComment(e.target.value)}></textarea>
                </div>
                <div className="d-flex justify-content-between mt-3">
                  <button className="btn btn-primary" onClick={submitReturn}>
                    Submit
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      setReturnTarget(null);
                      setReturnComment("");
                    }}
                  >
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h5>Your Orders</h5>
          </div>
          <div className="card-body">
            <div className="order-list">
              {orders.length > 0 ? (
                orders.map((order) => {
                  const allDelivered = order.items.every((item) => item.orderStatus === "Delivered");
                  const anyFailed =
                    order.paymentStatus === "Failed" &&
                    order.items.some((item) => item.orderStatus === "Failed") &&
                    !order.items.some((item) => item.orderStatus === "canceled");
                  const paymentCompleted = order.paymentStatus === "Completed";
                  // A cancelled-out order has nothing left that was actually
                  // billed — without this an order every item of which was
                  // cancelled still offered a "Tax Invoice" download (its
                  // paymentStatus stays "Completed" even after cancellation,
                  // since the payment itself did go through; the refund is
                  // separate), which reads as proof of a live purchase.
                  const allCanceled = order.items.every((item) => item.orderStatus === "canceled");
                  const anyReturned = order.items.some((item) => item.orderStatus === "Returned");

                  return (
                    <div className="order-item" key={order._id}>
                      <div className="order-content">
                        <h6 className="order-id">Order ID: {order.orderNumber || "N/A"}</h6>
                        {order.items.map((item, idx) => (
                          <div key={idx}>
                            <div className="product-info row ">
                              <div className="col-3 col-md-2">
                                <img src={productImageUrl(item.productImage)} alt={item.productId?.productName || "Product Image"} className="product-image" />
                              </div>
                              <div className="col-9 col-md-10">
                                <div className="product-details">
                                  <h3>{item.productId?.productName || "Product Name"}</h3>
                                  <p>Color: {item.variant?.color || "N/A"}</p>
                                  <p>Size: {item.variant?.size || "N/A"}</p>
                                </div>
                              </div>
                            </div>
                            <div className="order-details row">
                              <div className="order-detail col-6 col-md-4">
                                <h4>Quantity</h4>
                                <p>{item.quantity}</p>
                              </div>
                              <div className="order-detail col-6 col-md-4">
                                <h4>Price</h4>
                                <p>₹{(item.productId?.salePrice || item.productId?.regularPrice || 0) * item.quantity}</p>
                              </div>
                              <div className="order-detail col-12 col-md-4">
                                <h4>Status</h4>
                                <span className={`badge ${item.badgeClass} ${item.orderStatus === "Failed" ? "text-danger bg-light" : ""}`}>{item.orderStatus || "Pending"}</span>
                                <div className="mt-2">
                                  {actionForStatus(
                                    item.orderStatus,
                                    order,
                                    item,
                                    (o, it) => setCancelTarget({ order: o, item: it }),
                                    (o, it) => setReturnTarget({ order: o, item: it }),
                                    handleCancelReturn
                                  )}
                                </div>
                              </div>
                            </div>
                            <hr />
                          </div>
                        ))}
                      </div>

                      <button className="btn btn-dark btn-outline-secondary btn w-100 mb-1 view-order" style={{ fontSize: "smaller" }} onClick={() => setViewOrder(order)}>
                        View <i className="bi bi-chevron-down ms-1"></i>
                      </button>

                      {anyFailed && (
                        <button className="btn btn-primary btn w-100 mb-2" disabled={retrying === order.orderNumber} onClick={() => handleRetryPayment(order)}>
                          {retrying === order.orderNumber ? "Processing..." : "Retry Payment"}
                        </button>
                      )}

                      {(allDelivered || paymentCompleted) && !allCanceled && (
                        <a className="btn btn-success btn w-100 mb-2" href={`/api/invoice/${order.orderNumber}`} target="_blank" rel="noreferrer">
                          Download Invoice
                        </a>
                      )}

                      {anyReturned && (
                        <a className="btn btn-outline-secondary btn w-100 mb-2" href={`/api/credit-note/${order.orderNumber}`} target="_blank" rel="noreferrer">
                          Download Credit Note
                        </a>
                      )}

                      <div className="order-summary">
                        <div className="summary-row">
                          <span>Subtotal:</span>
                          <span>₹{order.subtotal || 0}</span>
                        </div>
                        <div className="summary-row">
                          <span>Discount :</span>
                          <span>-₹{order.discount || 0}</span>
                        </div>
                        <div className="summary-row">
                          <span>Shipping:</span>
                          <span>₹40</span>
                        </div>
                        <div className="summary-row">
                          <span>{order.financials?.hasVoidedItems ? "Order Total:" : "Total:"}</span>
                          <span>₹{order.financials?.orderTotal ?? order.grandTotal ?? 0}</span>
                        </div>
                        {order.financials?.hasVoidedItems && (
                          <div className="summary-row">
                            <span>
                              <strong>Amount Payable:</strong>
                            </span>
                            <span>
                              <strong>₹{order.financials.amountPayable}</strong>
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="alert alert-warning" role="alert">
                  You have not ordered anything yet.
                </div>
              )}
            </div>
            <div className="pagination-controls">
              {currentPage > 1 && (
                <button className="btn btn-secondary" onClick={() => setSearchParams({ page: String(currentPage - 1) })}>
                  Previous
                </button>
              )}
              <span>
                Page {currentPage} of {totalPages}
              </span>
              {currentPage < totalPages && (
                <button className="btn btn-secondary" onClick={() => setSearchParams({ page: String(currentPage + 1) })}>
                  Next
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
  );
}
