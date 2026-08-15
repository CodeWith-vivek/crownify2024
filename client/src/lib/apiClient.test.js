import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiClient, ApiError } from "./apiClient";

// apiClient is the one chokepoint every network call in the app goes
// through — CSRF attachment, 401 broadcast, and error shaping all happen
// here exactly once. A regression is invisible in any single feature's
// tests (they'd just see "the request failed") but breaks the whole app.

function mockFetchOnce({ status = 200, json = null, redirected = false } = {}) {
  const isJson = json !== null;
  global.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    redirected,
    headers: { get: (name) => (name === "content-type" && isJson ? "application/json" : "") },
    json: async () => json,
  });
}

describe("apiClient", () => {
  beforeEach(() => {
    // jsdom (like a real browser) never clears document.cookie via `=""`
    // — that just sets a cookie with an empty name, which is a no-op.
    // Expiring it in the past is the actual way to clear it, and it must
    // happen here, not just once at file load: jsdom's document persists
    // across tests within a file, so a cookie set in one test would
    // otherwise leak into the next.
    document.cookie = "XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("GET does not attach a CSRF header", async () => {
    mockFetchOnce({ json: { success: true } });
    await apiClient.get("/api/cart");

    const [, options] = global.fetch.mock.calls[0];
    expect(options.headers["X-CSRF-Token"]).toBeUndefined();
  });

  it("POST attaches the CSRF token read from the XSRF-TOKEN cookie", async () => {
    document.cookie = "XSRF-TOKEN=abc123";
    mockFetchOnce({ json: { success: true } });

    await apiClient.post("/api/cart/add", { productId: "x" });

    const [, options] = global.fetch.mock.calls[0];
    expect(options.headers["X-CSRF-Token"]).toBe("abc123");
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body)).toEqual({ productId: "x" });
  });

  it("POST with no cookie present sends no CSRF header at all, not an empty one", async () => {
    mockFetchOnce({ json: { success: true } });
    await apiClient.post("/api/cart/add", {});

    const [, options] = global.fetch.mock.calls[0];
    expect("X-CSRF-Token" in options.headers).toBe(false);
  });

  it("always sends credentials so the session cookie rides along", async () => {
    mockFetchOnce({ json: { success: true } });
    await apiClient.get("/api/cart");

    expect(global.fetch.mock.calls[0][1].credentials).toBe("include");
  });

  it("uploadForm skips JSON-encoding and the Content-Type header", async () => {
    mockFetchOnce({ json: { success: true } });
    const formData = new FormData();
    formData.append("image", new Blob(["x"]));

    await apiClient.uploadForm("/api/admin/addBrand", formData);

    const [, options] = global.fetch.mock.calls[0];
    expect(options.body).toBe(formData);
    expect(options.headers["Content-Type"]).toBeUndefined();
  });

  it("a non-2xx JSON response throws an ApiError carrying the parsed body", async () => {
    mockFetchOnce({ status: 400, json: { success: false, message: "Invalid amount" } });

    await expect(apiClient.get("/api/wallet/balance")).rejects.toMatchObject({
      message: "Invalid amount",
      status: 400,
    });
  });

  it("a non-JSON response (e.g. an HTML error page) still throws, with a generic message", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      redirected: false,
      headers: { get: () => "text/html" },
      json: async () => null,
    });

    await expect(apiClient.get("/api/cart")).rejects.toThrow(/Unexpected response/);
  });

  it("broadcasts auth:unauthorized on a 401 for a non-auth-check endpoint", async () => {
    mockFetchOnce({ status: 401, json: { success: false, message: "Not authenticated" } });
    const onUnauthorized = vi.fn();
    window.addEventListener("auth:unauthorized", onUnauthorized);

    await expect(apiClient.get("/api/cart")).rejects.toBeInstanceOf(ApiError);

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(onUnauthorized.mock.calls[0][0].detail).toEqual({ admin: false });
    window.removeEventListener("auth:unauthorized", onUnauthorized);
  });

  it("flags admin: true when the 401 came from an /api/admin path", async () => {
    mockFetchOnce({ status: 401, json: { success: false } });
    const onUnauthorized = vi.fn();
    window.addEventListener("auth:unauthorized", onUnauthorized);

    await expect(apiClient.get("/api/admin/products")).rejects.toBeInstanceOf(ApiError);

    expect(onUnauthorized.mock.calls[0][0].detail).toEqual({ admin: true });
    window.removeEventListener("auth:unauthorized", onUnauthorized);
  });

  it("does NOT broadcast on a 401 from /api/auth/me — that endpoint 401s by design for guests", async () => {
    mockFetchOnce({ status: 401, json: { success: true, user: null } });
    const onUnauthorized = vi.fn();
    window.addEventListener("auth:unauthorized", onUnauthorized);

    // /api/auth/me's own 401 body is actually a success payload with
    // user:null in real usage, but the broadcast-skip is keyed on the path
    // alone, so this proves that regardless of status/body shape.
    await apiClient.get("/api/auth/me").catch(() => {});

    expect(onUnauthorized).not.toHaveBeenCalled();
    window.removeEventListener("auth:unauthorized", onUnauthorized);
  });
});
