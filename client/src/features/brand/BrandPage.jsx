import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { productApi } from "@/features/product/productApi";
import { ProductCard } from "@/features/product/ProductCard";

export function BrandPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["brand"],
    queryFn: productApi.brand,
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="font-heading text-3xl font-bold text-primary">Brand</h1>

      {isLoading && (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square w-full" />
          ))}
        </div>
      )}

      {isError && <p className="mt-6 text-muted-foreground">Could not load products.</p>}

      {data?.products?.length > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {data.products.map((product) => (
            <ProductCard key={product._id} product={product} />
          ))}
        </div>
      )}

      {data && data.products?.length === 0 && (
        <p className="mt-6 text-muted-foreground">No products available.</p>
      )}
    </div>
  );
}
