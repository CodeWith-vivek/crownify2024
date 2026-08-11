import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/store/AuthContext";
import { cartApi } from "./cartApi";

export function CartPage() {
  const queryClient = useQueryClient();
  const { refreshMe } = useAuth();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["cart"],
    queryFn: cartApi.get,
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["cart"] });
    await refreshMe();
  };

  const handleQuantityChange = async (item, delta) => {
    const nextQuantity = item.quantity + delta;
    if (nextQuantity < 1) return;
    try {
      const res = await cartApi.update({
        productId: item.product._id,
        size: item.size,
        color: item.color,
        quantity: nextQuantity,
      });
      if (res?.success) {
        await refresh();
      } else {
        toast.error(res?.message || "Could not update quantity");
      }
    } catch (err) {
      toast.error(err.message || "Could not update quantity");
    }
  };

  const handleRemove = async (item) => {
    try {
      const res = await cartApi.remove({
        productId: item.product._id,
        size: item.size,
        color: item.color,
      });
      if (res?.success) {
        toast.success("Item removed");
        await refresh();
      } else {
        toast.error(res?.message || "Could not remove item");
      }
    } catch (err) {
      toast.error(err.message || "Could not remove item");
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center text-muted-foreground">
        Could not load your cart.
      </div>
    );
  }

  if (data?.isCartEmpty) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-24 text-center">
        <h1 className="font-heading text-2xl font-bold text-primary">Your cart is empty</h1>
        <Button asChild className="mt-6">
          <Link to="/shop">Continue Shopping</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="font-heading text-3xl font-bold text-primary">Your Cart</h1>

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {data.cartItems.map((item) => (
            <div key={`${item.product._id}-${item.size}-${item.color}`} className="flex gap-4 rounded-lg border p-4">
              <div className="h-24 w-24 shrink-0 overflow-hidden rounded-md bg-muted">
                {item.productImage && (
                  <img
                    src={`/uploads/product-image/${item.productImage}`}
                    alt={item.productName}
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <div className="flex flex-1 flex-col justify-between">
                <div>
                  <p className="font-medium">{item.productName}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.color} / {item.size}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => handleQuantityChange(item, -1)}>
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-6 text-center text-sm">{item.quantity}</span>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-7 w-7"
                    disabled={item.quantity >= item.selectedVariantStockLevel}
                    onClick={() => handleQuantityChange(item, 1)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="flex flex-col items-end justify-between">
                <p className="font-semibold text-primary">₹{item.itemTotal}</p>
                <Button size="icon" variant="ghost" onClick={() => handleRemove(item)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="h-fit rounded-lg border p-6">
          <h2 className="font-heading text-lg font-semibold text-primary">Order Summary</h2>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>₹{data.subtotal}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Shipping</span>
              <span>₹{data.shippingCharge}</span>
            </div>
            <div className="flex justify-between border-t pt-2 font-semibold">
              <span>Total</span>
              <span>₹{data.total}</span>
            </div>
          </div>
          <Button asChild className="mt-6 w-full">
            <Link to="/checkout">Proceed to Checkout</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
