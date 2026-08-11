import { apiClient } from "@/lib/apiClient";

export const walletApi = {
  get: (page = 1, limit = 5) => apiClient.get(`/api/wallet?page=${page}&limit=${limit}`),
  balance: () => apiClient.get("/api/wallet/balance"),
  addMoney: (amount) => apiClient.post("/api/wallet/add-money", { amount }),
  confirmPayment: (payload) => apiClient.post("/api/confirm-payment", payload),
};
