import { apiClient } from "@/lib/apiClient";

export const paymentApi = {
  success: (orderId) => apiClient.get(`/api/payment-Success?orderId=${orderId}`),
  failure: (orderId) => apiClient.get(`/api/payment-Failure?orderId=${orderId}`),
  recordFailure: (payload) => apiClient.post("/api/payment-failure", payload),
  retryPayment: (orderId) => apiClient.post("/api/retry-payment", { orderId }),
  updateOrderStatus: (payload) => apiClient.post("/api/update-order-status", payload),
  orderDetails: (orderNumber) => apiClient.get(`/api/get-order-details/${orderNumber}`),
};
