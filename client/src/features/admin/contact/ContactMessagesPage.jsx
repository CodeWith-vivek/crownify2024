import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "../adminApi";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { AdminError } from "@/components/admin/AdminError";

export function ContactMessagesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parseInt(searchParams.get("page") || "1", 10);
  const search = searchParams.get("search") || "";

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-contact-messages", page, search],
    queryFn: () => adminApi.contactMessages(page, search),
  });

  const handleSearch = (e) => {
    e.preventDefault();
    const value = new FormData(e.target).get("search") || "";
    setSearchParams({ search: value, page: "1" });
  };

  const messages = data?.messages || [];
  const currentPage = data?.currentPage || page;
  const totalPages = data?.totalPages || 1;

  if (isError) return <AdminError onRetry={refetch} />;

  return (
    <>
      <div className="adm-page-head">
        <div>
          <h1>Enquiries</h1>
          <p>Messages submitted through the contact form.</p>
        </div>
        <div className="adm-page-head__actions">
          <form onSubmit={handleSearch}>
            <div className="adm-searchbar">
              <i className="material-icons">search</i>
              <input type="text" className="form-control" placeholder="Search messages" name="search" defaultValue={search} />
            </div>
          </form>
        </div>
      </div>

      <div className="adm-card">
        <div className="adm-tablewrap">
          <table className="table">
            <thead>
              <tr>
                <th>From</th>
                <th>Phone</th>
                <th>Message</th>
                <th>Received</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="adm-empty">
                    Loading messages…
                  </td>
                </tr>
              ) : messages.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <div className="adm-empty">
                      <i className="material-icons">forum</i>
                      <p style={{ margin: 0 }}>No messages found.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                messages.map((msg) => (
                  <tr key={msg._id}>
                    <td>
                      <div className="adm-cell-title">{msg.name}</div>
                      <div className="adm-cell-sub">{msg.email}</div>
                    </td>
                    <td>
                      <span className="adm-cell-sub">{msg.phone}</span>
                    </td>
                    <td style={{ maxWidth: 460 }}>
                      <span className="adm-cell-sub">{msg.message}</span>
                    </td>
                    <td>
                      <span className="adm-cell-sub">{msg.submittedOn ? new Date(msg.submittedOn).toLocaleDateString() : "—"}</span>
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
