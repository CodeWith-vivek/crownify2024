import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { profileApi } from "@/features/profile/profileApi";
import { orderApi } from "./orderApi";

export function OrdersPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["orders"],
    queryFn: () => profileApi.orders(),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["orders"] });

  const handleCancel = async (orderNumber, item) => {
    const cancelComment = window.prompt("Reason for cancellation (optional):") || "";
    try {
      const res = await orderApi.cancelOrder({
        orderNumber,
        productSize: item.variant?.size,
        productColor: item.variant?.color,
        cancelComment,
      });
      if (res?.success) {
        toast.success("Item cancelled");
        await refresh();
      } else {
        toast.error(res?.message || "Could not cancel item");
      }
    } catch (err) {
      toast.error(err.message || "Could not cancel item");
    }
  };

  const handleReturn = async (orderNumber, item) => {
    const returnComment = window.prompt("Reason for return:");
    if (!returnComment) return;
    try {
      const res = await orderApi.returnItem({
        orderNumber,
        productSize: item.variant?.size,
        productColor: item.variant?.color,
        returnComment,
      });
      if (res?.success) {
        toast.success("Return requested");
        await refresh();
      } else {
        toast.error(res?.message || "Could not request return");
      }
    } catch (err) {
      toast.error(err.message || "Could not request return");
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center text-muted-foreground">
        Could not load your orders.
      </div>
    );
  }

  if (!data?.orders?.length) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-24 text-center">
        <h1 className="font-heading text-2xl font-bold text-primary">No orders yet</h1>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="font-heading text-3xl font-bold text-primary">Your Orders</h1>

      <div className="mt-6 space-y-6">
        {data.orders.map((order) => (
          <div key={order._id} className="rounded-lg border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
              <div>
                <p className="font-medium">Order #{order.orderNumber}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(order.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <p className="font-semibold text-primary">₹{order.grandTotal}</p>
                {order.items.some((i) => i.orderStatus === "Delivered") && (
                  <Button asChild size="sm" variant="outline">
                    <a href={`/api/invoice/${order.orderNumber}`} target="_blank" rel="noreferrer">
                      Invoice
                    </a>
                  </Button>
                )}
              </div>
            </div>

            <div className="mt-3 space-y-3">
              {order.items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-4">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
                    {item.productImage && (
                      <img
                        src={`/uploads/product-image/${item.productImage}`}
                        alt={item.productName}
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{item.productName}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.variant?.color} / {item.variant?.size} × {item.quantity}
                    </p>
                    <Badge variant="outline" className="mt-1">
                      {item.orderStatus}
                    </Badge>
                  </div>
                  <div className="flex flex-col gap-2">
                    {["Placed", "Confirmed"].includes(item.orderStatus) && (
                      <Button size="sm" variant="outline" onClick={() => handleCancel(order.orderNumber, item)}>
                        Cancel
                      </Button>
                    )}
                    {item.orderStatus === "Delivered" && (
                      <Button size="sm" variant="outline" onClick={() => handleReturn(order.orderNumber, item)}>
                        Return
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
