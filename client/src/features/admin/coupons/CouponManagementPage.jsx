import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminApi } from "../adminApi";
import { AdminError } from "@/components/admin/AdminError";
import { confirm } from "@/components/ui/ConfirmDialog";

const emptyForm = {
  code: "",
  discountType: "",
  discountAmount: "",
  maxDiscount: "",
  minPurchase: "",
  expiryDate: "",
  usageLimit: "",
  description: "",
};

function validate(form) {
  const errors = {};
  if (!form.code.trim()) errors.code = "Coupon code is required.";
  if (!form.discountType) errors.type = "Discount type is required.";

  const discountAmount = parseFloat(form.discountAmount);
  if (isNaN(discountAmount) || discountAmount < 0) {
    errors.amount = "Discount amount must be a positive number.";
  } else if (form.discountType === "percentage" && discountAmount > 80) {
    errors.amount = "Percentage discount cannot exceed 80.";
  }

  if (form.maxDiscount.trim() !== "") {
    const maxDiscount = parseFloat(form.maxDiscount);
    if (isNaN(maxDiscount) || maxDiscount < 0) errors.max = "Max discount must be zero or more.";
  }

  const minPurchase = parseFloat(form.minPurchase);
  if (isNaN(minPurchase) || minPurchase < 0) errors.min = "Min purchase must be a positive number.";

  if (!form.expiryDate) errors.expiry = "Expiry date is required.";

  const usageLimit = parseInt(form.usageLimit, 10);
  if (isNaN(usageLimit) || (usageLimit !== 0 && usageLimit < 1)) errors.usage = "Usage limit must be 1+ (or 0 for unlimited).";

  const description = form.description.trim();
  if (description.length === 0) errors.description = "Description is required.";
  else if (description.length > 500) errors.description = "Description cannot exceed 500 characters.";

  return errors;
}

export function CouponManagementPage() {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-coupons"],
    queryFn: () => adminApi.couponManagement(),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-coupons"] });

  const errors = validate(form);
  const isValid = Object.keys(errors).length === 0;
  const setField = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!isValid) return;
    setSaving(true);
    try {
      const res = await adminApi.addCoupon(form);
      if (res?.success !== false) {
        toast.success(res?.message || "Coupon created");
        setForm(emptyForm);
        await refresh();
      } else {
        toast.error(res?.message || "Failed to add coupon");
      }
    } catch (err) {
      toast.error("Error adding coupon: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!await confirm("Delete this coupon? This cannot be undone.")) return;
    try {
      const res = await adminApi.deleteCoupon(id);
      toast.success(res?.message || "Coupon deleted");
      await refresh();
    } catch (err) {
      toast.error("Error deleting coupon: " + err.message);
    }
  };

  const coupons = data?.coupons || [];

  if (isError) return <AdminError onRetry={refetch} />;

  return (
    <>
      <div className="adm-page-head">
        <div>
          <h1>Coupons</h1>
          <p>Create and manage promotional discount codes.</p>
        </div>
      </div>

      <div className="adm-grid-side">
        <div className="adm-card">
          <div className="adm-card__head">New coupon</div>
          <div className="adm-card__body">
            <form onSubmit={handleAdd}>
              <div className="adm-field">
                <label className="form-label">Coupon code</label>
                <input type="text" className="form-control" maxLength={20} placeholder="SUMMER20" value={form.code} onChange={(e) => setField("code", e.target.value)} />
                {form.code && errors.code && <span className="text-danger">{errors.code}</span>}
              </div>

              <div className="adm-field">
                <label className="form-label">Discount type</label>
                <select className="form-select" value={form.discountType} onChange={(e) => setField("discountType", e.target.value)}>
                  <option value="">Select type</option>
                  <option value="percentage">Percentage</option>
                  <option value="fixed">Fixed amount</option>
                </select>
              </div>

              <div className="adm-field">
                <label className="form-label">Discount amount</label>
                <input type="number" className="form-control" min="0" step="0.01" placeholder="0" value={form.discountAmount} onChange={(e) => setField("discountAmount", e.target.value)} />
                {form.discountAmount && errors.amount && <span className="text-danger">{errors.amount}</span>}
              </div>

              <div className="adm-field">
                <label className="form-label">Max discount</label>
                <input type="number" className="form-control" min="0" step="0.01" placeholder="Optional cap" value={form.maxDiscount} onChange={(e) => setField("maxDiscount", e.target.value)} />
                {form.maxDiscount && errors.max && <span className="text-danger">{errors.max}</span>}
              </div>

              <div className="adm-field">
                <label className="form-label">Min purchase</label>
                <input type="number" className="form-control" min="0" step="0.01" placeholder="0" value={form.minPurchase} onChange={(e) => setField("minPurchase", e.target.value)} />
                {form.minPurchase && errors.min && <span className="text-danger">{errors.min}</span>}
              </div>

              <div className="adm-field">
                <label className="form-label">Expiry date</label>
                <input type="date" className="form-control" value={form.expiryDate} onChange={(e) => setField("expiryDate", e.target.value)} />
              </div>

              <div className="adm-field">
                <label className="form-label">Usage limit</label>
                <input type="number" className="form-control" min="0" placeholder="0 = unlimited" value={form.usageLimit} onChange={(e) => setField("usageLimit", e.target.value)} />
                {form.usageLimit && errors.usage && <span className="text-danger">{errors.usage}</span>}
              </div>

              <div className="adm-field">
                <label className="form-label">Description</label>
                <textarea className="form-control" maxLength={500} placeholder="What this coupon offers" value={form.description} onChange={(e) => setField("description", e.target.value)}></textarea>
                {form.description && errors.description && <span className="text-danger">{errors.description}</span>}
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={!isValid || saving}>
                {saving ? "Creating…" : "Create coupon"}
              </button>
            </form>
          </div>
        </div>

        <div className="adm-card">
          <div className="adm-tablewrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Discount</th>
                  <th>Min purchase</th>
                  <th>Expiry</th>
                  <th>Limit</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="adm-empty">
                      Loading coupons…
                    </td>
                  </tr>
                ) : coupons.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="adm-empty">
                        <i className="material-icons">sell</i>
                        <p style={{ margin: 0 }}>No coupons yet.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  coupons.map((coupon) => (
                    <tr key={coupon._id}>
                      <td>
                        <div className="adm-cell-title" style={{ fontFamily: "ui-monospace, monospace" }}>
                          {coupon.code}
                        </div>
                        <div className="adm-cell-sub">{coupon.description}</div>
                      </td>
                      <td>
                        <span className="adm-badge adm-badge--success">{coupon.discountType === "percentage" ? `${coupon.discountAmount}%` : `₹${coupon.discountAmount}`}</span>
                        {coupon.maxDiscount ? <div className="adm-cell-sub">max ₹{coupon.maxDiscount}</div> : null}
                      </td>
                      <td>
                        <span className="adm-cell-sub">₹{coupon.minPurchase}</span>
                      </td>
                      <td>
                        <span className="adm-cell-sub">{new Date(coupon.expiryDate).toLocaleDateString()}</span>
                      </td>
                      <td>
                        <span className="adm-cell-sub">{coupon.usageLimit === 0 ? "Unlimited" : coupon.usageLimit}</span>
                      </td>
                      <td>
                        <div className="adm-btn-group" style={{ justifyContent: "flex-end" }}>
                          <Link to={`/admin/edit-coupon/${coupon._id}`} className="btn btn-secondary btn-sm">
                            Edit
                          </Link>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(coupon._id)}>
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
    </>
  );
}
