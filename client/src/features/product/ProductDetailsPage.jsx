import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { productApi } from "./productApi";
import { ProductCard } from "./ProductCard";

export function ProductDetailsPage() {
  const { id } = useParams();
  const [selectedColor, setSelectedColor] = useState(null);
  const [selectedSize, setSelectedSize] = useState(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["product", id],
    queryFn: () => productApi.detail(id),
  });

  const product = data?.product;
  const colors = [...new Set(product?.variants?.map((v) => v.color) || [])];
  const sizes = [...new Set(product?.variants?.map((v) => v.size) || [])];

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
              disabled={product.totalQuantity === 0}
              onClick={() => toast.info("Cart coming in the next update")}
            >
              {product.totalQuantity === 0 ? "Out of Stock" : "Add to Cart"}
            </Button>
            <Button variant="outline" onClick={() => toast.info("Wishlist coming in the next update")}>
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
