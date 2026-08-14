/**
 * How a service reports an expected, user-facing failure.
 *
 * Services must not know that HTTP exists — they can't call res.status()
 * or read req.session. But they still need to distinguish "the cart is
 * empty" (a 404 the user should see) from "Mongo fell over" (a 500 nobody
 * should see the details of). AppError carries that intent as data; the
 * controller is the only place that turns it into a status code.
 *
 * Anything thrown that is NOT an AppError is treated as a genuine bug and
 * mapped to a generic 500 by the controller.
 */
class AppError extends Error {
  /**
   * @param {string} message      safe to show the user
   * @param {object} [options]
   * @param {number} [options.status=400]
   * @param {object} [options.details]  merged INTO the JSON response
   * @param {object} [options.meta]     internal control data for the
   *   controller (e.g. "also clear the session coupon"). Never serialized
   *   — keeping it separate from `details` is what stops bookkeeping
   *   flags leaking into the API response.
   */
  constructor(message, { status = 400, details, meta } = {}) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.details = details;
    this.meta = meta || {};
    this.isAppError = true;
  }
}

const notFound = (message, meta) => new AppError(message, { status: 404, meta });
const badRequest = (message, meta) => new AppError(message, { status: 400, meta });

module.exports = { AppError, notFound, badRequest };
