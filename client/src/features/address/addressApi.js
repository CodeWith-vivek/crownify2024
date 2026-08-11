import { apiClient } from "@/lib/apiClient";

export const addressApi = {
  list: () => apiClient.get("/api/Address"),
  add: (payload) => apiClient.post("/api/addAddress", payload),
  update: (id, payload) => apiClient.post(`/api/update-address/${id}`, payload),
  delete: (id) => apiClient.post(`/api/delete-address/${id}`, {}),
  setPrimary: (id) => apiClient.post(`/api/set-primary-address/${id}`, {}),
};
