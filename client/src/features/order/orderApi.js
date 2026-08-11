import { apiClient } from "@/lib/apiClient";

export const orderApi = {
  verifyPayment: (payload) => apiClient.post("/api/verify-payment", payload),
  deletePreliminaryOrder: (orderId) =>
    apiClient.post("/api/delete-preliminary-order", { orderId }),
  cancelOrder: (payload) => apiClient.post("/api/cancel-item", payload),
  returnItem: (payload) => apiClient.post("/api/return-item", payload),
  cancelReturn: (payload) => apiClient.post("/api/cancel-return-request", payload),
};
