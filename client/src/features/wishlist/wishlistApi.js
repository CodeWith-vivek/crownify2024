import { apiClient } from "@/lib/apiClient";

export const wishlistApi = {
  get: () => apiClient.get("/api/wishlist"),
  add: (productId) => apiClient.post("/api/wishlist/add", { productId }),
  remove: (productId) => apiClient.post("/api/wishlist/remove", { productId }),
  colorsBySize: (productId, size) =>
    apiClient.get(`/api/wishlist/colors?productId=${productId}&size=${encodeURIComponent(size)}`),
};
