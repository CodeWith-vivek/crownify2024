import { getCsrfToken } from "./csrf";

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Browser fetch() resolves a root-relative path ("/api/...") against
// location.href; Node's global fetch has no page origin and throws
// `TypeError: Failed to parse URL` on the same path. SSR (entry-server.jsx)
// calls this same apiClient to prefetch data, so on the server every
// request is made absolute via a loopback call to this same Express
// process — same port it binds to (see src/server.js's PORT handling).
const isServer = typeof window === "undefined";
const SSR_BASE_URL = isServer ? `http://127.0.0.1:${process.env.PORT || 3000}` : "";

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

async function request(path, { method = "GET", body, headers, isFormData } = {}) {
  const finalHeaders = { Accept: "application/json", ...headers };
  let finalBody = body;

  if (!isFormData) {
    finalHeaders["Content-Type"] = "application/json";
    if (body !== undefined) finalBody = JSON.stringify(body);
  }

  if (UNSAFE_METHODS.has(method)) {
    const token = getCsrfToken();
    if (token) finalHeaders["X-CSRF-Token"] = token;
  }

  const response = await fetch(isServer ? `${SSR_BASE_URL}${path}` : path, {
    method,
    headers: finalHeaders,
    body: finalBody,
    credentials: "include",
  });

  let parsed = null;
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    parsed = await response.json().catch(() => null);
  }

  if (!response.ok || response.redirected || !contentType.includes("application/json")) {
    // A 401 means the session expired or was never established. Broadcast it
    // so AuthProvider can clear local auth state and bounce the user to the
    // right login screen, instead of every page surfacing a generic error.
    // /auth/me is exempt — it 401s by design for anonymous visitors.
    if (!isServer && response.status === 401 && !path.includes("/auth/me")) {
      window.dispatchEvent(
        new CustomEvent("auth:unauthorized", { detail: { admin: path.startsWith("/api/admin") } })
      );
    }
    const message = parsed?.message || `Unexpected response (status ${response.status})`;
    throw new ApiError(message, response.status, parsed);
  }

  return parsed;
}

export const apiClient = {
  get: (path) => request(path),
  post: (path, body, opts) => request(path, { method: "POST", body, ...opts }),
  put: (path, body, opts) => request(path, { method: "PUT", body, ...opts }),
  patch: (path, body, opts) => request(path, { method: "PATCH", body, ...opts }),
  delete: (path, body, opts) => request(path, { method: "DELETE", body, ...opts }),
  uploadForm: (path, formData, method = "POST") =>
    request(path, { method, body: formData, isFormData: true }),
};
