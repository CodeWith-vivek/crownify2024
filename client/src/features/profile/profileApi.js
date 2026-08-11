import { apiClient } from "@/lib/apiClient";

export const profileApi = {
  get: () => apiClient.get("/api/profile"),
  orders: (page = 1, limit = 10) => apiClient.get(`/api/orders?page=${page}&limit=${limit}`),
  accountDetails: () => apiClient.get("/api/AccountDetails"),
  updateUser: (payload) => apiClient.post("/api/update-user", payload),
  validateCurrentPassword: (password) =>
    apiClient.post("/api/validate-current-password", { password }),
};
