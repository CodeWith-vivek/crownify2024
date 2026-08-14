const Razorpay = require("razorpay");

/**
 * Razorpay's constructor throws `key_id is mandatory` if the env vars are
 * missing. Three controllers used to build their own client at module
 * scope, which meant simply REQUIRING any of them blew up when the keys
 * weren't set — so a test suite or script that never touches payments
 * still couldn't import the module. CI caught this: no .env there, so
 * placeOrder.controller.js failed at import.
 *
 * Built on first use instead, and cached. Importing is now always safe;
 * only actually calling a payment path needs credentials, and if they're
 * missing it fails there with Razorpay's own message rather than at
 * process start.
 */
let client = null;

function getRazorpay() {
  if (!client) {
    client = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return client;
}

module.exports = { getRazorpay };
