import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { productApi } from "./productApi";
import { ProductCard } from "./ProductCard";
import { cartApi } from "@/features/cart/cartApi";
import { wishlistApi } from "@/features/wishlist/wishlistApi";
import { useAuth } from "@/store/AuthContext";

export function ProductDetailsPage() {
  const { id } = useParams();
  const [selectedColor, setSelectedColor] = useState(null);
  const [selectedSize, setSelectedSize] = useState(null);
  const [adding, setAdding] = useState(false);
  const { user, refreshMe } = useAuth();
  const navigate = useNavigate();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["product", id],
    queryFn: () => productApi.detail(id),
  });

  const product = data?.product;
  const colors = [...new Set(product?.variants?.map((v) => v.color) || [])];
  const sizes = [...new Set(product?.variants?.map((v) => v.size) || [])];

  const handleAddToCart = async () => {
    if (!user) {
      toast.error("Please sign in to add items to your cart");
      navigate("/login");
      return;
    }
    if (!selectedColor || !selectedSize) {
      toast.error("Please select a color and size");
      return;
    }
    setAdding(true);
    try {
      const res = await cartApi.add({
        productId: id,
        size: selectedSize,
        color: selectedColor,
        quantity: 1,
      });
      if (res?.success) {
        toast.success(res.message || "Added to cart");
        await refreshMe();
      } else {
        toast.error(res?.message || "Could not add to cart");
      }
    } catch (err) {
      toast.error(err.message || "Could not add to cart");
    } finally {
      setAdding(false);
    }
  };

  const handleAddToWishlist = async () => {
    if (!user) {
      toast.error("Please sign in to use your wishlist");
      navigate("/login");
      return;
    }
    try {
      const res = await wishlistApi.add(id);
      if (res?.success) {
        toast.success(res.message || "Added to wishlist");
        await refreshMe();
      } else {
        toast.error(res?.message || "Could not add to wishlist");
      }
    } catch (err) {
      toast.error(err.message || "Could not add to wishlist");
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8">
        <Skeleton className="aspect-square w-full max-w-md" />
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center text-muted-foreground">
        Product not found.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
        <div className="grid grid-cols-4 gap-3">
          <div className="col-span-4 aspect-square overflow-hidden rounded-lg bg-muted">
            {product.productImage?.[0] && (
              <img
                src={`/uploads/product-image/${product.productImage[0]}`}
                alt={product.productName}
                className="h-full w-full object-cover"
              />
            )}
          </div>
          {product.productImage?.slice(1).map((img) => (
            <div key={img} className="aspect-square overflow-hidden rounded-lg bg-muted">
              <img src={`/uploads/product-image/${img}`} alt={product.productName} className="h-full w-full object-cover" />
            </div>
          ))}
        </div>

        <div>
          <h1 className="font-heading text-2xl font-bold text-primary">{product.productName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{product.brand}</p>

          <div className="mt-4 flex items-center gap-3">
            <span className="text-2xl font-semibold text-primary">₹{product.salePrice}</span>
            {product.regularPrice > product.salePrice && (
              <>
                <span className="text-muted-foreground line-through">₹{product.regularPrice}</span>
                <Badge className="bg-accent text-accent-foreground">-{product.discountPercentage}%</Badge>
              </>
            )}
          </div>

          <p className="mt-4 text-sm text-muted-foreground">{product.description}</p>

          {colors.length > 0 && (
            <div className="mt-6">
              <p className="mb-2 text-sm font-semibold">Color</p>
              <div className="flex flex-wrap gap-2">
                {colors.map((c) => (
                  <Badge
                    key={c}
                    variant={selectedColor === c ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => setSelectedColor(c)}
                  >
                    {c}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {sizes.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-sm font-semibold">Size</p>
              <div className="flex flex-wrap gap-2">
                {sizes.map((s) => (
                  <Badge
                    key={s}
                    variant={selectedSize === s ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => setSelectedSize(s)}
                  >
                    {s}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8 flex gap-3">
            <Button
              className="flex-1"
              disabled={product.totalQuantity === 0 || adding}
              onClick={handleAddToCart}
            >
              {product.totalQuantity === 0 ? "Out of Stock" : adding ? "Adding..." : "Add to Cart"}
            </Button>
            <Button variant="outline" onClick={handleAddToWishlist}>
              Wishlist
            </Button>
          </div>
        </div>
      </div>

      {data?.relatedProducts?.length > 0 && (
        <section className="mt-16">
          <h2 className="font-heading text-xl font-bold text-primary">Related Products</h2>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {data.relatedProducts.map((p) => (
              <ProductCard key={p._id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
