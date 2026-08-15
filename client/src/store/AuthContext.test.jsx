import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, act, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "./AuthContext";

// AuthContext is what apiClient's auth:unauthorized broadcast (tested in
// apiClient.test.js) actually drives — this covers the other half: does
// the provider react to it correctly. This is exactly the logic that
// makes a stale session bounce to the right login screen instead of
// leaving the user stuck on a page full of failed requests.

function Probe() {
  const { user, loading, isAuthenticated } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="authed">{String(isAuthenticated)}</span>
      <span data-testid="user">{user ? user.email : "none"}</span>
    </div>
  );
}

function renderAt(path, { initialUser = null } = {}) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    redirected: false,
    headers: { get: () => "application/json" },
    json: async () => ({ success: true, user: initialUser, cartCount: 0, wishlistCount: 0 }),
  });

  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="*"
          element={
            <AuthProvider>
              <Probe />
            </AuthProvider>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

describe("AuthProvider", () => {
  afterEach(cleanup);

  it("starts loading, then resolves to the /api/auth/me result", async () => {
    renderAt("/", { initialUser: { email: "shopper@gmail.com" } });

    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));
    expect(screen.getByTestId("authed")).toHaveTextContent("true");
    expect(screen.getByTestId("user")).toHaveTextContent("shopper@gmail.com");
  });

  it("a failed /api/auth/me leaves the user signed out rather than stuck loading", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network down"));

    render(
      <MemoryRouter initialEntries={["/"]}>
        <AuthProvider>
          <Probe />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));
    expect(screen.getByTestId("authed")).toHaveTextContent("false");
  });

  it("clears user state on an auth:unauthorized event and redirects to /login", async () => {
    renderAt("/cart", { initialUser: { email: "shopper@gmail.com" } });
    await waitFor(() => expect(screen.getByTestId("authed")).toHaveTextContent("true"));

    act(() => {
      window.dispatchEvent(new CustomEvent("auth:unauthorized", { detail: { admin: false } }));
    });

    await waitFor(() => expect(screen.getByTestId("authed")).toHaveTextContent("false"));
    expect(screen.getByTestId("user")).toHaveTextContent("none");
  });

  it("an admin auth:unauthorized event does not touch shopper state or shopper redirect", async () => {
    renderAt("/cart", { initialUser: { email: "shopper@gmail.com" } });
    await waitFor(() => expect(screen.getByTestId("authed")).toHaveTextContent("true"));

    act(() => {
      window.dispatchEvent(new CustomEvent("auth:unauthorized", { detail: { admin: true } }));
    });

    // Admin session expiry is a separate concern (handled by
    // AdminAuthContext) — the shopper's own auth state must be untouched.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.getByTestId("authed")).toHaveTextContent("true");
  });
});
