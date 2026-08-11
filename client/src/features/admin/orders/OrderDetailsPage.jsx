import { useParams, useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { adminApi } from "../adminApi";

export function OrderDetailsPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const itemId = searchParams.get("itemId");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-order-details", id, itemId],
    queryFn: () => adminApi.orderDetails(id, itemId),
  });

  if (isLoading) {
    return (
      <div className="p-8">
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !data?.order) {
    return (
      <div className="p-8 text-muted-foreground">Order not found.</div>
    );
  }

  const { order, orderItem } = data;

  return (
    <div className="p-8">
      <Button asChild variant="outline" size="sm" className="mb-4">
        <Link to="/admin/orderlist">Back to Orders</Link>
      </Button>

      <h1 className="font-heading text-2xl font-bold text-primary">Order #{order.orderNumber}</h1>

      <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <h2 className="font-medium">Customer</h2>
          <p className="mt-1 text-sm text-muted-foreground">{order.userId?.name}</p>
          <p className="text-sm text-muted-foreground">{order.userId?.email}</p>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <h2 className="font-medium">Shipping Address</h2>
          {order.shippingAddress ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {order.shippingAddress.flatHouseCompany}, {order.shippingAddress.areaStreet},{" "}
              {order.shippingAddress.city}, {order.shippingAddress.state} - {order.shippingAddress.postalCode}
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">No address on file</p>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-lg border bg-card p-4">
        <h2 className="font-medium">Item</h2>
        <div className="mt-2 flex items-center gap-4">
          <div className="h-20 w-20 overflow-hidden rounded-md bg-muted">
            {orderItem.productImage && (
              <img
                src={`/uploads/product-image/${orderItem.productImage}`}
                alt={orderItem.productName}
                className="h-full w-full object-cover"
              />
            )}
          </div>
          <div>
            <p className="font-medium">{orderItem.productName}</p>
            <p className="text-sm text-muted-foreground">
              {orderItem.variant?.color} / {orderItem.variant?.size} × {orderItem.quantity}
            </p>
            <Badge variant="outline" className="mt-1">
              {orderItem.orderStatus}
            </Badge>
          </div>
          <p className="ml-auto font-semibold text-primary">₹{orderItem.totalPrice}</p>
        </div>
      </div>

      <div className="mt-6 rounded-lg border bg-card p-4">
        <h2 className="font-medium">Order Summary</h2>
        <div className="mt-2 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>₹{order.subtotal}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Shipping</span>
            <span>₹{order.shipping}</span>
          </div>
          {order.discount > 0 && (
            <div className="flex justify-between text-accent">
              <span>Discount</span>
              <span>-₹{order.discount}</span>
            </div>
          )}
          <div className="flex justify-between border-t pt-1 font-semibold">
            <span>Total</span>
            <span>₹{order.grandTotal}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
