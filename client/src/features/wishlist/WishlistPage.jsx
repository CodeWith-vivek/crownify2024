import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/store/AuthContext";
import { wishlistApi } from "./wishlistApi";

export function WishlistPage() {
  const queryClient = useQueryClient();
  const { refreshMe } = useAuth();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["wishlist"],
    queryFn: wishlistApi.get,
  });

  const handleRemove = async (productId) => {
    try {
      const res = await wishlistApi.remove(productId);
      if (res?.success) {
        toast.success("Removed from wishlist");
        await queryClient.invalidateQueries({ queryKey: ["wishlist"] });
        await refreshMe();
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
        Could not load your wishlist.
      </div>
    );
  }

  if (data?.isWishlistEmpty) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-24 text-center">
        <h1 className="font-heading text-2xl font-bold text-primary">Your wishlist is empty</h1>
        <Button asChild className="mt-6">
          <Link to="/shop">Continue Shopping</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="font-heading text-3xl font-bold text-primary">Your Wishlist</h1>

      <div className="mt-6 space-y-4">
        {data.wishlistItems.map((item) => (
          <div key={item.productId} className="flex gap-4 rounded-lg border p-4">
            <Link to={`/product/${item.productId}`} className="h-24 w-24 shrink-0 overflow-hidden rounded-md bg-muted">
              {item.productImage && (
                <img src={`/uploads/product-image/${item.productImage}`} alt={item.productName} className="h-full w-full object-cover" />
              )}
            </Link>
            <div className="flex flex-1 flex-col justify-between">
              <div>
                <Link to={`/product/${item.productId}`} className="font-medium hover:underline">
                  {item.productName}
                </Link>
                <p className="text-sm text-muted-foreground">{item.brand}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-primary">₹{item.salePrice}</span>
                {item.regularPrice > item.salePrice && (
                  <span className="text-xs text-muted-foreground line-through">₹{item.regularPrice}</span>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end justify-between">
              <Button size="icon" variant="ghost" onClick={() => handleRemove(item.productId)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
              <Button asChild size="sm">
                <Link to={`/product/${item.productId}`}>View</Link>
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
