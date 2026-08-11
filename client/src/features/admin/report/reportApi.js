import { apiClient } from "@/lib/apiClient";
import { getCsrfToken } from "@/lib/csrf";

async function downloadBlob(path, body, fallbackFilename) {
  const res = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": getCsrfToken() || "",
    },
    body: JSON.stringify(body),
    credentials: "include",
  });

  if (!res.ok) {
    let message = `Download failed (status ${res.status})`;
    try {
      const errBody = await res.json();
      message = errBody.message || message;
    } catch {
      // response wasn't JSON, keep default message
    }
    throw new Error(message);
  }

  const disposition = res.headers.get("content-disposition") || "";
  const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
  const filename = match ? match[1].replace(/['"]/g, "") : fallbackFilename;

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const reportApi = {
  overallRevenue: () => apiClient.get("/api/admin/overall-revenue"),
  totalOrders: () => apiClient.get("/api/admin/total-orders"),
  totalProducts: () => apiClient.get("/api/admin/total-products"),
  totalCategories: () => apiClient.get("/api/admin/total-categories"),
  topSellingStats: () => apiClient.get("/api/admin/top-selling-stats"),
  salesReport: (payload) => apiClient.post("/api/admin/sales-report", payload),
  salesChart: (payload) => apiClient.post("/api/admin/sales-chart", payload),
  downloadPdf: (payload) => downloadBlob("/api/admin/sales-report/pdf", payload, "sales-report.pdf"),
  downloadExcel: (payload) => downloadBlob("/api/admin/sales-report/excel", payload, "sales-report.xlsx"),
  invoiceUrl: (orderNumber) => `/api/invoice/${orderNumber}`,
};
