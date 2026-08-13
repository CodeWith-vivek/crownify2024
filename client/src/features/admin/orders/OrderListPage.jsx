import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminApi } from "../adminApi";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { AdminError } from "@/components/admin/AdminError";
import { confirm } from "@/components/ui/ConfirmDialog";

function nextStatusFor(status) {
  if (status === "Placed") return "Shipped";
  if (status === "Return requested") return "Returned";
  if (status === "Shipped") return "Delivered";
  return null;
}

function badgeTone(status) {
  if (status === "Delivered") return "adm-badge--success";
  if (status === "Shipped") return "adm-badge--info";
  if (status === "Returned" || status === "canceled" || status === "Failed") return "adm-badge--danger";
  return "adm-badge--warning";
}

export function OrderListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parseInt(searchParams.get("page") || "1", 10);
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-orders", page],
    queryFn: () => adminApi.orders(page),
  });

  const handleStatusChange = async (order, item, newStatus) => {
    if (!await confirm(`Update this item's status to "${newStatus}"?`)) return;
    try {
      const res = await adminApi.updateOrderStatus({
        orderId: order._id,
        productSize: item.variant?.size,
        productColor: item.variant?.color,
        newStatus,
      });
      if (res?.success) {
        toast.success("Order status updated");
        await queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      } else {
        toast.error(res?.message || "Failed to update status");
      }
    } catch (err) {
      toast.error(err.message || "An error occurred while updating the status.");
    }
  };

  const orders = data?.orders || [];
  const currentPage = data?.currentPage || page;
  const totalPages = data?.totalPages || 1;

  const rowCount = orders.reduce((n, o) => n + o.items.length, 0);

  if (isError) return <AdminError onRetry={refetch} />;

  return (
    <>
      <div className="adm-page-head">
        <div>
          <h1>Orders</h1>
          <p>{rowCount > 0 ? `${rowCount} item${rowCount === 1 ? "" : "s"} on this page` : "Track and fulfil customer orders."}</p>
        </div>
      </div>

      <div className="adm-card">
        <div className="adm-tablewrap">
          <table className="table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th className="product-detail-column">Product</th>
                <th>Total</th>
                <th>Status</th>
                <th>Date</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="adm-empty">
                    Loading orders…
                  </td>
                </tr>
              ) : rowCount === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="adm-empty">
                      <i className="material-icons">receipt_long</i>
                      <p style={{ margin: 0 }}>No orders yet.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                orders.map((order) =>
                  order.items.map((item) => {
                    const next = nextStatusFor(item.orderStatus);
                    return (
                      <tr key={`${order._id}-${item._id}`}>
                        <td>
                          <span className="adm-cell-title">#{order.orderNumber || order._id.toString().slice(-4)}</span>
                        </td>
                        <td>
                          <div className="adm-cell-title">{order.userId?.name}</div>
                          <div className="adm-cell-sub">{order.userId?.email}</div>
                        </td>
                        <td className="product-detail-column">
                          <div className="adm-cell-media">
                            <img className="adm-thumb" src={`/uploads/product-image/${item.productImage}`} alt="" />
                            <div style={{ minWidth: 0 }}>
                              <div className="adm-cell-title">{item.productName}</div>
                              <div className="adm-cell-sub">
                                {item.variant?.size || "—"} · {item.variant?.color || "—"} · Qty {item.quantity || 1}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="adm-cell-title">₹{item.totalPrice}</span>
                        </td>
                        <td>
                          <span className={`adm-badge ${badgeTone(item.orderStatus)}`}>{item.orderStatus}</span>
                        </td>
                        <td>
                          <span className="adm-cell-sub">{new Date(order.orderedAt).toLocaleDateString()}</span>
                        </td>
                        <td>
                          <div className="adm-btn-group" style={{ justifyContent: "flex-end" }}>
                            {next && (
                              <button className="btn btn-primary btn-sm" onClick={() => handleStatusChange(order, item, next)}>
                                Mark {next}
                              </button>
                            )}
                            <Link to={`/admin/orderDetails/${order._id}?itemId=${item._id}`} className="btn btn-secondary btn-sm">
                              Details
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AdminPagination currentPage={currentPage} totalPages={totalPages} onChange={(p) => setSearchParams({ page: String(p) })} />
    </>
  );
}
