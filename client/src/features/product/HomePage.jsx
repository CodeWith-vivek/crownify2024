import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { productApi } from "./productApi";
import { ProductCard } from "./ProductCard";

export function HomePage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["home"],
    queryFn: productApi.home,
  });

  return (
    <div>
      <section className="bg-primary py-20 text-primary-foreground">
        <div className="mx-auto max-w-7xl px-4 text-center">
          <h1 className="font-heading text-4xl font-bold md:text-6xl">CROWNIFY</h1>
          <p className="mt-4 text-primary-foreground/80">
            Premium headwear, blending style, comfort, and quality for every occasion.
          </p>
          <Button asChild size="lg" className="mt-6 bg-accent text-accent-foreground hover:bg-accent/90">
            <Link to="/shop">Shop Now</Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12">
        <h2 className="font-heading text-2xl font-bold text-primary">Featured Products</h2>

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
            {data.products.slice(0, 8).map((product) => (
              <ProductCard key={product._id} product={product} />
            ))}
          </div>
        )}

        {data && data.products?.length === 0 && (
          <p className="mt-6 text-muted-foreground">No products available right now.</p>
        )}
      </section>
    </div>
  );
}
