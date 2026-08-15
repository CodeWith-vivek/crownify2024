const { test, expect } = require("@playwright/test");
const SEED = require("./setup/fixtures");

// The one flow that actually matters for an e-commerce site: a shopper can
// find a product, buy it, and land on a real confirmation. This exists to
// catch what unit tests can't — a broken button, a page that white-screens,
// a form that silently fails to submit. Deliberately COD-only: Razorpay is
// a real external gateway and correctly out of scope for an automated
// smoke test.
test("browse -> cart -> checkout -> place order (COD)", async ({ page }) => {
  // domcontentloaded, not the default "load": the page pulls in external
  // CDN stylesheets/fonts (see usePageAssets/userProfiles), and waiting on
  // those to fully resolve made this flaky without adding anything —
  // every assertion below is locator-based and already auto-retries.
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.locator("#email").fill(SEED.userEmail);
  await page.locator("#password").fill(SEED.userPassword);
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page).toHaveURL("/");

  await page.goto("/shop", { waitUntil: "domcontentloaded" });
  await page.getByText(SEED.productName).first().click();
  await expect(page).toHaveURL(/\/product\//);

  await page.locator(".size-label", { hasText: SEED.size }).click();
  await page.locator(`.color-label[title="${SEED.color}"]`).click();
  await page.getByText("Add to Cart").click();
  await expect(page.getByText("Item added to cart successfully!")).toBeVisible();

  await page.goto("/cart", { waitUntil: "domcontentloaded" });
  await expect(page.getByText(SEED.productName)).toBeVisible();
  await page.getByText("Proceed to Checkout").click();
  await expect(page).toHaveURL("/checkout");

  await expect(page.getByText(SEED.productName)).toBeVisible();
  // The radio itself is visually hidden (display:none) behind a styled
  // <label>; clicking the label text is what a real shopper does, and it
  // triggers the associated input via native <label for> behavior.
  await page.getByText("Cash On Delivery").click();
  await page.getByRole("button", { name: "Proceed to Checkout" }).click();

  // Custom ConfirmDialog (not the native browser confirm()) — asks to
  // confirm payment method + total before actually placing the order.
  await page.getByRole("button", { name: "Confirm" }).click();

  // COD skips the Razorpay modal entirely and lands straight here.
  await expect(page).toHaveURL(/\/payment-Success/);
  await expect(page.getByRole("heading", { name: "Order Successfully Placed" })).toBeVisible();
});
