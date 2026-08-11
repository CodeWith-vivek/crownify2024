import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

export function ProductCard({ product }) {
  const image = product.productImage?.[0];
  const hoverImage = product.productImage?.[1];

  return (
    <Link
      to={`/product/${product._id}`}
      className="group block overflow-hidden rounded-lg border bg-card transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-square overflow-hidden bg-muted">
        {image && (
          <img
            src={`/uploads/product-image/${image}`}
            alt={product.productName}
            className="h-full w-full object-cover transition-opacity group-hover:opacity-0"
          />
        )}
        {hoverImage && (
          <img
            src={`/uploads/product-image/${hoverImage}`}
            alt={product.productName}
            className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity group-hover:opacity-100"
          />
        )}
        {product.discountPercentage > 0 && (
          <Badge className="absolute left-2 top-2 bg-accent text-accent-foreground">
            -{product.discountPercentage}%
          </Badge>
        )}
      </div>
      <div className="p-3">
        <p className="truncate text-sm font-medium">{product.productName}</p>
        <div className="mt-1 flex items-center gap-2">
          <span className="font-semibold text-primary">₹{product.salePrice}</span>
          {product.regularPrice > product.salePrice && (
            <span className="text-xs text-muted-foreground line-through">
              ₹{product.regularPrice}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
