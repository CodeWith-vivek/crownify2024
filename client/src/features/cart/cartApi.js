import { apiClient } from "@/lib/apiClient";

export const cartApi = {
  get: () => apiClient.get("/api/cart"),
  add: ({ productId, size, color, quantity }) =>
    apiClient.post("/api/cart/add", { productId, size, color, quantity }),
  update: ({ productId, size, color, quantity }) =>
    apiClient.post("/api/cart/update", { productId, size, color, quantity }),
  remove: ({ productId, size, color }) =>
    apiClient.delete("/api/cart/remove", { productId, size, color }),
  stock: (productId, size, color) =>
    apiClient.get(`/api/product/${productId}/stock?size=${encodeURIComponent(size)}&color=${encodeURIComponent(color)}`),
};
