const { defineConfig } = require("@playwright/test");

// End-to-end smoke coverage for the critical path (browse -> cart ->
// checkout -> order) and the 4 server-rendered routes. This is
// deliberately NOT full coverage — it exists to catch the class of bug
// unit tests can't: a broken button, a page that white-screens, a route
// that regresses from real SSR content back to an empty shell. Backend
// correctness is Jest's job (tests/integration/); this is "does clicking
// through the actual UI still work."
//
// webServer boots its own throwaway in-memory MongoDB and seeds fixed
// test data (see tests/e2e/setup/bootTestServer.js) — never touches the
// real database.
const PORT = process.env.E2E_PORT || 3100;

module.exports = defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  fullyParallel: false, // all specs share one seeded server/DB
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "line" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "node tests/e2e/setup/bootTestServer.js",
    url: `http://localhost:${PORT}`,
    timeout: 60_000,
    reuseExistingServer: !process.env.CI,
    env: { PORT: String(PORT) },
    stdout: "pipe",
    stderr: "pipe",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
