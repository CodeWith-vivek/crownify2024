import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminApi } from "../adminApi";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { AdminError } from "@/components/admin/AdminError";
import { confirm } from "@/components/ui/ConfirmDialog";
import { productImageUrl } from "@/lib/imageUrl";

export function ProductListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parseInt(searchParams.get("page") || "1", 10);
  const search = searchParams.get("search") || "";
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-products", page, search],
    queryFn: () => adminApi.products(page, search),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-products"] });

  const handleSearch = (e) => {
    e.preventDefault();
    const value = new FormData(e.target).get("search") || "";
    setSearchParams({ search: value, page: "1" });
  };

  const toggleBlock = async (product) => {
    const msg = product.isBlocked ? "Unblock this product?" : "Block this product? It will be hidden from the storefront.";
    if (!await confirm(msg)) return;
    try {
      const res = product.isBlocked ? await adminApi.unblockProduct(product._id) : await adminApi.blockProduct(product._id);
      if (res?.success !== false) {
        toast.success(product.isBlocked ? "Product unblocked" : "Product blocked");
        await refresh();
      }
    } catch (err) {
      toast.error(err.message || "Action failed");
    }
  };

  const handleAddOffer = async (productId) => {
    const amount = window.prompt("Offer percentage (0–100):");
    if (amount === null) return;
    if (amount === "" || isNaN(amount) || amount < 0 || amount > 100) {
      toast.error("Enter a valid percentage between 0 and 100.");
      return;
    }
    try {
      const res = await adminApi.addProductOffer({ productId, percentage: Number(amount) });
      if (res?.status) {
        toast.success("Offer added");
        await refresh();
      } else {
        toast.error(res?.message || "Unable to add offer");
      }
    } catch {
      toast.error("An error occurred while adding the offer");
    }
  };

  const handleRemoveOffer = async (productId) => {
    if (!await confirm("Remove this offer?")) return;
    try {
      const res = await adminApi.removeProductOffer(productId);
      if (res?.status) {
        toast.success("Offer removed");
        await refresh();
      } else {
        toast.error("Failed to remove offer");
      }
    } catch {
      toast.error("Failed to remove offer");
    }
  };

  const products = data?.data ? [...data.data].reverse() : [];
  const currentPage = data?.currentPage || page;
  const totalPages = data?.totalPages || 1;

  if (isError) return <AdminError onRetry={refetch} />;

  return (
    <>
      <div className="adm-page-head">
        <div>
          <h1>Products</h1>
          <p>Manage catalog, pricing, stock, and offers.</p>
        </div>
        <div className="adm-page-head__actions">
          <form onSubmit={handleSearch}>
            <div className="adm-searchbar">
              <i className="material-icons">search</i>
              <input type="text" className="form-control" placeholder="Search products or brands" name="search" defaultValue={search} />
            </div>
          </form>
          <Link to="/admin/addProducts" className="btn btn-primary">
            <i className="material-icons">add</i>
            Add Product
          </Link>
        </div>
      </div>

      <div className="adm-card">
        <div className="adm-tablewrap">
          <table className="table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>Price</th>
                <th>Offer</th>
                <th>Stock</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="adm-empty">
                    Loading products…
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="adm-empty">
                      <i className="material-icons">inventory_2</i>
                      <p style={{ margin: 0 }}>No products found.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr key={product._id}>
                    <td>
                      <div className="adm-cell-media">
                        {product.productImage?.[0] && <img className="adm-thumb" src={productImageUrl(product.productImage[0])} alt="" />}
                        <div style={{ minWidth: 0 }}>
                          <div className="adm-cell-title">{product.productName}</div>
                          <div className="adm-cell-sub">{product.brand}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="adm-cell-sub">{product.category ? product.category.name : "No category"}</span>
                    </td>
                    <td>
                      <span className="adm-cell-title">₹{product.salePrice}</span>
                    </td>
                    <td>
                      {product.productOffer ? (
                        <span className="adm-badge adm-badge--success">{product.productOffer}%</span>
                      ) : (
                        <span className="adm-cell-sub">—</span>
                      )}
                    </td>
                    <td>
                      <span className={`adm-badge ${product.totalQuantity > 10 ? "adm-badge--success" : product.totalQuantity > 0 ? "adm-badge--warning" : "adm-badge--danger"}`}>
                        {product.totalQuantity}
                      </span>
                    </td>
                    <td>
                      <span className={`adm-badge ${product.isBlocked ? "adm-badge--danger" : "adm-badge--success"}`}>{product.isBlocked ? "Blocked" : "Active"}</span>
                    </td>
                    <td>
                      <div className="adm-btn-group" style={{ justifyContent: "flex-end" }}>
                        {product.productOffer ? (
                          <button className="btn btn-secondary btn-sm" onClick={() => handleRemoveOffer(product._id)}>
                            Remove Offer
                          </button>
                        ) : (
                          <button className="btn btn-secondary btn-sm" onClick={() => handleAddOffer(product._id)}>
                            Add Offer
                          </button>
                        )}
                        <button className={`btn btn-sm ${product.isBlocked ? "btn-success" : "btn-danger"}`} onClick={() => toggleBlock(product)}>
                          {product.isBlocked ? "Unblock" : "Block"}
                        </button>
                        <Link to={`/admin/editProduct/${product._id}`} className="btn btn-primary btn-sm">
                          Edit
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AdminPagination currentPage={currentPage} totalPages={totalPages} onChange={(p) => setSearchParams({ search, page: String(p) })} />
    </>
  );
}
