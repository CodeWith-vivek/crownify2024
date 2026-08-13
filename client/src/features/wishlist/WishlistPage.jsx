import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { usePageAssets } from "@/lib/usePageAssets";
import { userProfiles } from "@/styles/userProfiles";
import { useAuth } from "@/store/AuthContext";
import { PageError } from "@/components/layout/PageError";
import { wishlistApi } from "./wishlistApi";
import { cartApi } from "@/features/cart/cartApi";
import { productImageUrl } from "@/lib/imageUrl";

function WishlistRow({ item, onRemoved }) {
  const [size, setSize] = useState("");
  const [color, setColor] = useState("");
  const [colorOptions, setColorOptions] = useState([]);
  const [adding, setAdding] = useState(false);
  const { refreshMe } = useAuth();

  const selectedColorOption = colorOptions.find((c) => c.color === color);
  const quantity = selectedColorOption ? selectedColorOption.quantity : null;

  const handleSizeChange = async (e) => {
    const nextSize = e.target.value;
    setSize(nextSize);
    setColor("");
    setColorOptions([]);
    if (!nextSize) return;
    try {
      const res = await wishlistApi.colorsBySize(item.productId, nextSize);
      setColorOptions(res?.colors || []);
    } catch (err) {
      toast.error("Failed to load colors. Please try again.");
    }
  };

  const handleAddToCart = async () => {
    if (!size || !color) return;
    setAdding(true);
    try {
      const res = await cartApi.add({ productId: item.productId, size, color, quantity: 1 });
      if (res?.success) {
        await wishlistApi.remove(item.productId);
        toast.success("The product has been added to your cart.");
        await refreshMe();
        onRemoved();
      } else {
        toast.error(res?.message || "Failed to add product to cart");
      }
    } catch (err) {
      toast.error(err.message || "An error occurred while adding product to cart");
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async () => {
    try {
      const res = await wishlistApi.remove(item.productId);
      toast.success(res?.message || "Product removed from wishlist.");
      onRemoved();
    } catch (err) {
      toast.error("Unable to remove the item. Please try again later.");
    }
  };

  let stockLabel = "Select Size & Color";
  let stockColor = "inherit";
  if (color) {
    if (quantity === 0) {
      stockLabel = "Out of Stock";
      stockColor = "red";
    } else if (quantity > 0 && quantity <= 10) {
      stockLabel = `${quantity} Left`;
      stockColor = "orange";
    } else {
      stockLabel = "In Stock";
      stockColor = "green";
    }
  }

  return (
    <tr className="wishlist-item">
      <td className="product-remove text-center">
        <a href="#" className="remove-btn" onClick={(e) => { e.preventDefault(); handleRemove(); }}>
          <i className="icon icon anm anm-times-l" style={{ color: "black" }}></i>
        </a>
      </td>
      <td className="product-thumbnail text-center">
        <Link to={`/product/${item.productId}`}>
          <img
            src={item.productImage ? productImageUrl(item.productImage) : "/assets/images/default-product.jpg"}
            alt={item.productName || "Product"}
            title={item.productName || "Product"}
          />
        </Link>
      </td>
      <td className="product-name">
        <h4 className="no-margin">
          <b>{item.productName}</b>
        </h4>
        <h5 className="no-margin">{item.brand}</h5>
        <h6 className="no-margin">{item.category}</h6>
      </td>
      <td className="product-size alt-font">
        <select className="form-control size-dropdown" value={size} onChange={handleSizeChange}>
          <option value="">Select Size</option>
          {item.availableSizes.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </td>
      <td className="product-color alt-font">
        <select className="form-control color-dropdown" value={color} disabled={colorOptions.length === 0} onChange={(e) => setColor(e.target.value)}>
          <option value="">{colorOptions.length === 0 ? "Select Color" : "Select Color"}</option>
          {colorOptions.map((c) => (
            <option key={c.color} value={c.color}>
              {c.color}
            </option>
          ))}
        </select>
      </td>
      <td className="product-price text-center">
        <span className="amount">₹{item.salePrice}</span>
      </td>
      <td className="stock text-center">
        <span className="stock-status" style={{ color: stockColor }}>
          {stockLabel}
        </span>
      </td>
      <td className="product-subtotal text-center">
        <button
          type="button"
          className="btn btn-small btn-add-to-cart add-to-cart-btn"
          style={{ backgroundColor: "black", color: "white" }}
          disabled={!size || !color || adding}
          onClick={handleAddToCart}
        >
          {adding ? "Adding..." : "Add To Cart"}
        </button>
      </td>
    </tr>
  );
}

export function WishlistPage() {
  usePageAssets("user", "header", userProfiles);

  const queryClient = useQueryClient();
  const { data, isError, refetch } = useQuery({
    queryKey: ["wishlist"],
    queryFn: wishlistApi.get,
  });

  const onRemoved = () => queryClient.invalidateQueries({ queryKey: ["wishlist"] });

  const wishlistItems = data?.wishlistItems || [];

  if (isError) {
    return <PageError title="Couldn't load your wishlist" message="We couldn't reach the server. Your saved items are safe — please try again." onRetry={refetch} />;
  }

  return (
    <div id="page-content">
      <div className="page section-header text-center">
        <div className="page-title">
          <div className="wrapper">
            <h1 className="page-width">Wish List</h1>
          </div>
        </div>
      </div>

      <div className="container">
        <div className="row justify-content-center">
          <div className="col-lg-12">
            {wishlistItems.length === 0 ? (
              <div className="empty-cart-section text-center">
                <div className="empty-cart-content">
                  <img src="/assets/images/empty-wishlist.webp" alt="Empty Wishlist" className="empty-cart-image mb-4" />
                  <div className="empty-cart-actions" style={{ marginBottom: 40 }}>
                    <Link to="/" className="btn btn-primary" style={{ backgroundColor: "black" }}>
                      Continue Shopping
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <div className="wishlist-table table-content table-responsive">
                <table className="table table-bordered">
                  <thead>
                    <tr>
                      <th className="product-name text-center alt-font">Remove</th>
                      <th className="product-price text-center alt-font">Images</th>
                      <th className="product-name alt-font">Product</th>
                      <th className="product-size alt-font" style={{ width: 100 }}>
                        Size
                      </th>
                      <th className="product-name alt-font" style={{ width: 100 }}>
                        Color
                      </th>
                      <th className="product-price text-center alt-font">Unit Price</th>
                      <th className="stock-status text-center alt-font">Stock Status</th>
                      <th className="product-subtotal text-center alt-font">Add to Cart</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wishlistItems.map((item) => (
                      <WishlistRow key={item.productId} item={item} onRemoved={onRemoved} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
