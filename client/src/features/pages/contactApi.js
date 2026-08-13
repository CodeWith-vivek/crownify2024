import { apiClient } from "@/lib/apiClient";

export const contactApi = {
  submit: (payload) => apiClient.post("/api/contact", payload),
};
