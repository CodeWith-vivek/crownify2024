import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminApi } from "../adminApi";
import { AdminError } from "@/components/admin/AdminError";

export function EditCategoryPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-edit-category", id],
    queryFn: () => adminApi.getEditCategory(id),
  });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data?.category) {
      setName(data.category.name || "");
      setDescription(data.category.description || "");
    }
  }, [data]);

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Please enter a name");
    if (!/^[a-zA-Z0-9\s]+$/.test(name.trim())) return toast.error("Category name may only contain letters and numbers");
    if (!description.trim()) return toast.error("Please enter a description");

    setSaving(true);
    try {
      const res = await adminApi.editCategory(id, { categoryName: name, description });
      if (res?.success !== false) {
        toast.success("Category updated");
        navigate("/admin/category");
      } else {
        toast.error(res?.error || "Could not update category");
      }
    } catch (err) {
      toast.error(err.message || "Could not update category");
    } finally {
      setSaving(false);
    }
  };

  // isError first — on a failed request data is undefined, so the
  // "not found" branch would otherwise claim the category was deleted.
  if (isError) return <AdminError onRetry={refetch} />;
  if (isLoading) return <p style={{ color: "var(--adm-text-muted)" }}>Loading…</p>;
  if (!data?.category) return <p style={{ color: "var(--adm-text-muted)" }}>Category not found.</p>;

  return (
    <form onSubmit={handleUpdate}>
      <div className="adm-page-head">
        <div>
          <h1>Edit category</h1>
          <p>Update the category name and description.</p>
        </div>
        <div className="adm-page-head__actions">
          <Link to="/admin/category" className="btn btn-secondary">
            Cancel
          </Link>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      <div className="adm-card" style={{ maxWidth: 620 }}>
        <div className="adm-card__body">
          <div className="adm-field">
            <label className="form-label" htmlFor="categoryName">
              Name
            </label>
            <input type="text" id="categoryName" className="form-control" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="adm-field" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="description">
              Description
            </label>
            <textarea id="description" className="form-control" rows={4} value={description} onChange={(e) => setDescription(e.target.value)}></textarea>
          </div>
        </div>
      </div>
    </form>
  );
}
