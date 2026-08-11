import { apiClient } from "@/lib/apiClient";

export const couponApi = {
  apply: (couponCode, cartTotal) =>
    apiClient.post("/api/apply-coupon", { couponCode, cartTotal }),
  remove: (cartTotal) => apiClient.post("/api/remove-coupon", { cartTotal }),
};
