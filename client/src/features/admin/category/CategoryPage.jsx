import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminApi } from "../adminApi";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { AdminError } from "@/components/admin/AdminError";
import { confirm } from "@/components/ui/ConfirmDialog";

export function CategoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parseInt(searchParams.get("page") || "1", 10);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-categories", page],
    queryFn: () => adminApi.categories(page),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-categories"] });

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Please enter a name");
    if (!/^[a-zA-Z0-9\s]+$/.test(name.trim())) return toast.error("Category name may only contain letters and numbers");
    if (!description.trim()) return toast.error("Please enter a description");

    setSaving(true);
    try {
      await adminApi.addCategory({ name, description });
      toast.success("Category created");
      setName("");
      setDescription("");
      await refresh();
    } catch (err) {
      toast.error(err.message || "An error occurred");
    } finally {
      setSaving(false);
    }
  };

  const toggleListed = async (cat) => {
    const msg = cat.isListed ? "Unlist this category? It will be hidden from the storefront." : "List this category?";
    if (!await confirm(msg)) return;
    try {
      const res = cat.isListed ? await adminApi.listCategory(cat._id) : await adminApi.unlistCategory(cat._id);
      if (res?.success !== false) await refresh();
    } catch (err) {
      toast.error(err.message || "Action failed");
    }
  };

  const handleAddOffer = async (categoryId) => {
    const amount = window.prompt("Offer percentage:");
    if (amount === null) return;
    if (amount === "" || Number(amount) <= 0) return toast.error("Enter a positive percentage.");
    try {
      const res = await adminApi.addCategoryOffer({ percentage: Number(amount), categoryId });
      if (res?.status) {
        toast.success("Offer added");
        await refresh();
      } else {
        toast.error(res?.message || "Adding offer failed");
      }
    } catch {
      toast.error("An error occurred while adding the offer");
    }
  };

  const handleRemoveOffer = async (categoryId) => {
    try {
      const res = await adminApi.removeCategoryOffer(categoryId);
      if (res?.status) {
        toast.success("Offer removed");
        await refresh();
      } else {
        toast.error(res?.message || "Removing offer failed");
      }
    } catch {
      toast.error("An error occurred while removing the offer");
    }
  };

  const categories = data?.cat ? [...data.cat].reverse() : [];
  const currentPage = data?.currentPage || page;
  const totalPages = data?.totalPages || 1;

  if (isError) return <AdminError onRetry={refetch} />;

  return (
    <>
      <div className="adm-page-head">
        <div>
          <h1>Categories</h1>
          <p>Organise your catalog and run category-wide offers.</p>
        </div>
      </div>

      <div className="adm-grid-side">
        <div className="adm-card">
          <div className="adm-card__head">New category</div>
          <div className="adm-card__body">
            <form onSubmit={handleAdd}>
              <div className="adm-field">
                <label className="form-label" htmlFor="cat-name">
                  Name
                </label>
                <input type="text" className="form-control" id="cat-name" placeholder="e.g. Snapbacks" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="adm-field">
                <label className="form-label" htmlFor="cat-desc">
                  Description
                </label>
                <textarea className="form-control" id="cat-desc" placeholder="Short description" value={description} onChange={(e) => setDescription(e.target.value)}></textarea>
              </div>
              <button className="btn btn-primary" type="submit" style={{ width: "100%" }} disabled={saving}>
                {saving ? "Creating…" : "Create category"}
              </button>
            </form>
          </div>
        </div>

        <div className="adm-card">
          <div className="adm-tablewrap">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 52 }}>#</th>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Offer</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="adm-empty">
                      Loading categories…
                    </td>
                  </tr>
                ) : categories.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="adm-empty">
                        <i className="material-icons">category</i>
                        <p style={{ margin: 0 }}>No categories yet.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  categories.map((category, index) => (
                    <tr key={category._id}>
                      <td>
                        <span className="adm-cell-sub">{index + 1}</span>
                      </td>
                      <td>
                        <span className="adm-cell-title">{category.name}</span>
                      </td>
                      <td>
                        <span className="adm-cell-sub">{category.description}</span>
                      </td>
                      <td>
                        {category.categoryOffer > 0 ? <span className="adm-badge adm-badge--success">{category.categoryOffer}%</span> : <span className="adm-cell-sub">—</span>}
                      </td>
                      <td>
                        <span className={`adm-badge ${category.isListed ? "adm-badge--success" : "adm-badge--danger"}`}>{category.isListed ? "Listed" : "Unlisted"}</span>
                      </td>
                      <td>
                        <div className="adm-btn-group" style={{ justifyContent: "flex-end" }}>
                          {category.categoryOffer === 0 ? (
                            <button className="btn btn-secondary btn-sm" onClick={() => handleAddOffer(category._id)}>
                              Add Offer
                            </button>
                          ) : (
                            <button className="btn btn-secondary btn-sm" onClick={() => handleRemoveOffer(category._id)}>
                              Remove Offer
                            </button>
                          )}
                          <button className={`btn btn-sm ${category.isListed ? "btn-danger" : "btn-success"}`} onClick={() => toggleListed(category)}>
                            {category.isListed ? "Unlist" : "List"}
                          </button>
                          <Link to={`/admin/editCategory/${category._id}`} className="btn btn-primary btn-sm">
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
      </div>

      <AdminPagination currentPage={currentPage} totalPages={totalPages} onChange={(p) => setSearchParams({ page: String(p) })} />
    </>
  );
}
