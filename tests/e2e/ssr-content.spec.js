const { test, expect } = require("@playwright/test");
const SEED = require("./setup/fixtures");

// Guards the actual point of doing SSR: these 4 routes must return real
// content in the raw HTML response, before any JS runs — not just the
// empty <div id="root"></div> shell every other route gets. Uses
// Playwright's `request` fixture (a plain HTTP client, no browser, no JS
// execution) specifically so this can't be fooled by client-side
// rendering filling the page in after the fact.
test("home page SSR includes real product content", async ({ request }) => {
  const res = await request.get("/");
  expect(res.status()).toBe(200);
  const body = await res.text();
  expect(body).toContain(SEED.productName);
});

test("shop page SSR includes real product content", async ({ request }) => {
  const res = await request.get("/shop");
  const body = await res.text();
  expect(body).toContain(SEED.productName);
});

test("brand page SSR includes real product content", async ({ request }) => {
  const res = await request.get("/brand");
  const body = await res.text();
  expect(body).toContain(SEED.productName);
});

test("product detail page SSR includes the product and a page-specific title", async ({
  request,
}) => {
  const shopRes = await request.get("/shop");
  const shopBody = await shopRes.text();
  const match = shopBody.match(/\/product\/([a-f0-9]{24})/);
  expect(match, "expected to find a /product/<id> link in the SSR'd shop page").not.toBeNull();

  const res = await request.get(`/product/${match[1]}`);
  const body = await res.text();
  expect(body).toContain(SEED.productName);
  // Not the generic placeholder — proves the server resolved real
  // per-page metadata rather than passing the static shell through.
  expect(body).toContain(`<title>${SEED.productName}`);
  expect(body).not.toContain("<title>CROWNIFY</title>");
});

// Every OTHER route must still be the plain CSR shell — SSR is scoped to
// exactly 4 routes, this proves the scoping actually holds.
test("non-SSR routes still serve the empty CSR shell", async ({ request }) => {
  const res = await request.get("/cart");
  const body = await res.text();
  expect(body).toContain('<div id="root">');
  expect(body).not.toContain(SEED.productName);
});
