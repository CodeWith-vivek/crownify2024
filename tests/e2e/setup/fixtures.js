// Shared between bootTestServer.js (which seeds this data) and the spec
// files (which need to know it to log in / find the product) — one
// source of truth, no side effects, safe to require from either side.
module.exports = {
  productName: "E2E Test Snapback",
  size: "ONESIZE",
  color: "Black",
  // Login's client-side validator (client/src/lib/validators.js
  // emailStrict) only accepts a fixed whitelist of real providers — a
  // .test TLD fails before the form even submits. Never actually sent
  // anywhere; this account is pre-seeded and pre-verified, no email flow
  // is exercised.
  userEmail: "e2e.shopper@gmail.com",
  userPassword: "E2ePass@123",
};
