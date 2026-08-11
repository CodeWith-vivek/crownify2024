import { useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { paymentApi } from "./paymentApi";

export function PaymentFailurePage() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("orderId");

  const { data, isLoading } = useQuery({
    queryKey: ["payment-failure", orderId],
    queryFn: () => paymentApi.failure(orderId),
    enabled: !!orderId,
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24">
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <XCircle className="mx-auto h-16 w-16 text-destructive" />
      <h1 className="mt-4 font-heading text-2xl font-bold text-primary">Payment Failed</h1>
      {data?.order && <p className="mt-2 text-muted-foreground">Order #{data.order.orderNumber}</p>}
      <div className="mt-8 flex justify-center gap-3">
        <Button asChild variant="outline">
          <Link to="/cart">Back to Cart</Link>
        </Button>
        <Button asChild>
          <Link to="/orders">View Orders</Link>
        </Button>
      </div>
    </div>
  );
}
