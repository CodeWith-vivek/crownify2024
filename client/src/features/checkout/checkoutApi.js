import { apiClient } from "@/lib/apiClient";

export const checkoutApi = {
  get: () => apiClient.get("/api/checkout"),
  validate: () => apiClient.post("/api/checkout/validate", {}),
  placeOrder: (payload) => apiClient.post("/api/checkout", payload),
  addAddress: (payload) => apiClient.post("/api/addAddress", payload),
};
