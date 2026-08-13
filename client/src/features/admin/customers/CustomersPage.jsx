import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminApi } from "../adminApi";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { AdminError } from "@/components/admin/AdminError";
import { confirm } from "@/components/ui/ConfirmDialog";

export function CustomersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parseInt(searchParams.get("page") || "1", 10);
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-customers", page],
    queryFn: () => adminApi.customers(page),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-customers"] });

  const toggleBlock = async (user) => {
    const msg = user.isBlocked
      ? "Unblock this customer? They will regain access to their account."
      : "Block this customer? They will not be able to access their account.";
    if (!await confirm(msg)) return;
    try {
      const res = user.isBlocked ? await adminApi.unblockCustomer(user._id) : await adminApi.blockCustomer(user._id);
      if (res?.success !== false) {
        toast.success(user.isBlocked ? "Customer unblocked" : "Customer blocked");
        await refresh();
      } else {
        toast.error(res?.message || "Action failed");
      }
    } catch (err) {
      toast.error(err.message || "Action failed");
    }
  };

  const users = data?.users || [];
  const currentPage = data?.currentPage || page;
  const totalPages = data?.totalPages || 1;

  if (isError) return <AdminError onRetry={refetch} />;

  return (
    <>
      <div className="adm-page-head">
        <div>
          <h1>Customers</h1>
          <p>Manage shopper accounts and access.</p>
        </div>
      </div>

      <div className="adm-card">
        <div className="adm-tablewrap">
          <table className="table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Email</th>
                <th>Status</th>
                <th>Registered</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="adm-empty">
                    Loading customers…
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="adm-empty">
                      <i className="material-icons">group</i>
                      <p style={{ margin: 0 }}>No customers found.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user._id}>
                    <td>
                      <div className="adm-cell-media">
                        {user.avatar ? (
                          <img className="adm-thumb" style={{ borderRadius: "50%" }} src={user.avatar} alt="" />
                        ) : (
                          <span
                            className="adm-thumb"
                            style={{
                              borderRadius: "50%",
                              background: "var(--adm-brand)",
                              color: "#fff",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 600,
                              fontSize: 15,
                            }}
                          >
                            {user.name ? user.name[0].toUpperCase() : "?"}
                          </span>
                        )}
                        <span className="adm-cell-title">{user.name}</span>
                      </div>
                    </td>
                    <td>
                      <span className="adm-cell-sub">{user.email}</span>
                    </td>
                    <td>
                      <span className={`adm-badge ${user.isBlocked ? "adm-badge--danger" : "adm-badge--success"}`}>{user.isBlocked ? "Blocked" : "Active"}</span>
                    </td>
                    <td>
                      <span className="adm-cell-sub">{user.createdOn ? new Date(user.createdOn).toLocaleDateString() : "—"}</span>
                    </td>
                    <td>
                      <div className="adm-btn-group" style={{ justifyContent: "flex-end" }}>
                        <button className={`btn btn-sm ${user.isBlocked ? "btn-success" : "btn-danger"}`} onClick={() => toggleBlock(user)}>
                          {user.isBlocked ? "Unblock" : "Block"}
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

      <AdminPagination currentPage={currentPage} totalPages={totalPages} onChange={(p) => setSearchParams({ page: String(p) })} />
    </>
  );
}
