import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { productApi } from "./productApi";
import { ProductCard } from "./ProductCard";

const SORT_OPTIONS = [
  { value: "", label: "Newest" },
  { value: "priceLowHigh", label: "Price: Low to High" },
  { value: "priceHighLow", label: "Price: High to Low" },
  { value: "alphaAsc", label: "Name: A-Z" },
  { value: "alphaDesc", label: "Name: Z-A" },
  { value: "popularity", label: "Popularity" },
];

export function ShopPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const params = Object.fromEntries(searchParams.entries());

  const { data, isLoading, isError } = useQuery({
    queryKey: ["shop", params],
    queryFn: () => productApi.shop(params),
  });

  const updateParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    setSearchParams(next);
  };

  const toggleCategory = (id) => {
    const next = new URLSearchParams(searchParams);
    const current = next.getAll("categories");
    next.delete("categories");
    if (current.includes(id)) {
      current.filter((c) => c !== id).forEach((c) => next.append("categories", c));
    } else {
      [...current, id].forEach((c) => next.append("categories", c));
    }
    next.delete("page");
    setSearchParams(next);
  };

  const goToPage = (page) => {
    const next = new URLSearchParams(searchParams);
    next.set("page", page);
    setSearchParams(next);
  };

  const selectedCategories = searchParams.getAll("categories");

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="font-heading text-3xl font-bold text-primary">Shop</h1>

      <div className="mt-6 grid grid-cols-1 gap-8 md:grid-cols-[240px_1fr]">
        <aside className="space-y-6">
          <div>
            <Input
              placeholder="Search products..."
              defaultValue={params.search || ""}
              onKeyDown={(e) => {
                if (e.key === "Enter") updateParam("search", e.currentTarget.value);
              }}
            />
          </div>

          {data?.categories?.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold">Categories</h3>
              <div className="flex flex-wrap gap-2">
                {data.categories.map((cat) => (
                  <Badge
                    key={cat._id}
                    variant={selectedCategories.includes(cat._id) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleCategory(cat._id)}
                  >
                    {cat.name} ({cat.productCount})
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {data?.brands?.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold">Brands</h3>
              <div className="flex flex-wrap gap-2">
                {data.brands.map((brand) => (
                  <Badge
                    key={brand._id}
                    variant={params.brands === brand.brandName ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() =>
                      updateParam("brands", params.brands === brand.brandName ? "" : brand.brandName)
                    }
                  >
                    {brand.brandName}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </aside>

        <div>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {data?.totalProducts ?? "..."} products
            </p>
            <select
              className="rounded-md border bg-background px-3 py-1.5 text-sm"
              value={params.sort || ""}
              onChange={(e) => updateParam("sort", e.target.value)}
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {isLoading && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {Array.from({ length: 9 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square w-full" />
              ))}
            </div>
          )}

          {isError && <p className="text-muted-foreground">Could not load products.</p>}

          {data?.products?.length > 0 && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {data.products.map((product) => (
                <ProductCard key={product._id} product={product} />
              ))}
            </div>
          )}

          {data && data.products?.length === 0 && (
            <p className="text-muted-foreground">No products match your filters.</p>
          )}

          {data?.totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              {Array.from({ length: data.totalPages }).map((_, i) => (
                <Button
                  key={i}
                  size="sm"
                  variant={data.currentPage === i + 1 ? "default" : "outline"}
                  onClick={() => goToPage(i + 1)}
                >
                  {i + 1}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
