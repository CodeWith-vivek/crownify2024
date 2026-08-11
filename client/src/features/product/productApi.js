import { apiClient } from "@/lib/apiClient";

export const productApi = {
  home: () => apiClient.get("/api"),
  shop: (params) => apiClient.get(`/api/shop?${new URLSearchParams(params).toString()}`),
  detail: (id) => apiClient.get(`/api/product/${id}`),
  brand: () => apiClient.get("/api/brand"),
};
