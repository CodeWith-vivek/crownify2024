import { useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminApi } from "../adminApi";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { AdminError } from "@/components/admin/AdminError";
import { confirm } from "@/components/ui/ConfirmDialog";

export function BrandPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parseInt(searchParams.get("page") || "1", 10);
  const [name, setName] = useState("");
  const [preview, setPreview] = useState(null);
  const fileRef = useRef(null);
  const [submitting, setSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-brands", page],
    queryFn: () => adminApi.brands(page),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-brands"] });

  const handleAdd = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return toast.error("Brand name is required.");
    if (trimmed.length < 3) return toast.error("Brand name must be at least 3 characters.");

    const file = fileRef.current?.files?.[0];
    if (!file) return toast.error("Brand image is required.");
    if (!["image/jpeg", "image/png", "image/jpg"].includes(file.type)) return toast.error("Only JPEG or PNG images are allowed.");

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("name", name);
      formData.append("image", file);
      const res = await adminApi.addBrand(formData);
      if (res?.success !== false) {
        toast.success("Brand added");
        setName("");
        setPreview(null);
        if (fileRef.current) fileRef.current.value = "";
        await refresh();
      } else {
        toast.error(res?.message || "Could not add brand");
      }
    } catch (err) {
      toast.error(err.message || "Could not add brand");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleBlock = async (brand) => {
    const msg = brand.isBlocked ? "Unblock this brand?" : "Block this brand? Its products will be hidden.";
    if (!await confirm(msg)) return;
    try {
      const res = brand.isBlocked ? await adminApi.unblockBrand(brand._id) : await adminApi.blockBrand(brand._id);
      if (res?.success !== false) await refresh();
    } catch (err) {
      toast.error(err.message || "Action failed");
    }
  };

  const handleDelete = async (id) => {
    if (!await confirm("Delete this brand? This cannot be undone.")) return;
    try {
      await adminApi.deleteBrand(id);
      toast.success("Brand deleted");
      await refresh();
    } catch (err) {
      toast.error(err.message || "Could not delete brand");
    }
  };

  const brands = data?.data ? [...data.data].reverse() : [];
  const currentPage = data?.currentPage || page;
  const totalPages = data?.totalPages || 1;

  if (isError) return <AdminError onRetry={refetch} />;

  return (
    <>
      <div className="adm-page-head">
        <div>
          <h1>Brands</h1>
          <p>Curate the brands featured across the store.</p>
        </div>
      </div>

      <div className="adm-grid-side">
        <div className="adm-card">
          <div className="adm-card__head">New brand</div>
          <div className="adm-card__body">
            <form onSubmit={handleAdd}>
              <div className="adm-field">
                <label className="form-label" htmlFor="brand-name">
                  Brand name
                </label>
                <input type="text" className="form-control" id="brand-name" placeholder="e.g. New Era" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="adm-field">
                <label className="form-label" htmlFor="brand-image">
                  Logo
                </label>
                <input
                  className="form-control"
                  id="brand-image"
                  ref={fileRef}
                  type="file"
                  accept="image/png, image/jpeg, image/jpg"
                  onChange={(e) => setPreview(e.target.files[0] ? URL.createObjectURL(e.target.files[0]) : null)}
                />
                <p className="adm-help">JPEG or PNG.</p>
                {preview && <img src={preview} alt="" style={{ marginTop: 10, width: 72, height: 72, objectFit: "cover", borderRadius: 10, border: "1px solid var(--adm-border)" }} />}
              </div>
              <button className="btn btn-primary" type="submit" style={{ width: "100%" }} disabled={submitting}>
                {submitting ? "Adding…" : "Add brand"}
              </button>
            </form>
          </div>
        </div>

        <div className="adm-card">
          <div className="adm-tablewrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Brand</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={3} className="adm-empty">
                      Loading brands…
                    </td>
                  </tr>
                ) : brands.length === 0 ? (
                  <tr>
                    <td colSpan={3}>
                      <div className="adm-empty">
                        <i className="material-icons">loyalty</i>
                        <p style={{ margin: 0 }}>No brands yet.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  brands.map((brand) => (
                    <tr key={brand._id}>
                      <td>
                        <div className="adm-cell-media">
                          <img className="adm-thumb" style={{ borderRadius: "50%", background: "#111" }} src={`/uploads/re-image/${brand.brandImage[0]}`} alt="" />
                          <span className="adm-cell-title">{brand.brandName}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`adm-badge ${brand.isBlocked ? "adm-badge--danger" : "adm-badge--success"}`}>{brand.isBlocked ? "Blocked" : "Active"}</span>
                      </td>
                      <td>
                        <div className="adm-btn-group" style={{ justifyContent: "flex-end" }}>
                          <button className={`btn btn-sm ${brand.isBlocked ? "btn-success" : "btn-secondary"}`} onClick={() => toggleBlock(brand)}>
                            {brand.isBlocked ? "Unblock" : "Block"}
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(brand._id)}>
                            Delete
                          </button>
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
