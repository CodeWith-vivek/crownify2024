import { useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { paymentApi } from "./paymentApi";

export function PaymentSuccessPage() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("orderId");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["payment-success", orderId],
    queryFn: () => paymentApi.success(orderId),
    enabled: !!orderId,
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24">
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (isError || !data?.order) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center text-muted-foreground">
        Order not found.
      </div>
    );
  }

  const { order } = data;

  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <CheckCircle2 className="mx-auto h-16 w-16 text-green-600" />
      <h1 className="mt-4 font-heading text-2xl font-bold text-primary">Order Placed Successfully</h1>
      <p className="mt-2 text-muted-foreground">Order #{order.orderNumber}</p>
      <p className="mt-1 text-lg font-semibold">₹{order.grandTotal}</p>
      <div className="mt-8 flex justify-center gap-3">
        <Button asChild variant="outline">
          <Link to="/shop">Continue Shopping</Link>
        </Button>
        <Button asChild>
          <Link to="/orders">View Orders</Link>
        </Button>
      </div>
    </div>
  );
}
