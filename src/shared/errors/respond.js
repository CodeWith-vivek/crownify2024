/**
 * The one place that turns a service outcome into an HTTP response.
 *
 * Services throw AppError for expected, user-facing failures and anything
 * else for genuine bugs. Without a shared adapter every controller
 * re-implements that split by hand, and they drift — which is how error
 * paths in this codebase ended up returning a 500 with an internal
 * message where a clean 4xx was intended.
 *
 * @param {object} res
 * @param {Error} error
 * @param {string} logLabel  context for the server log
 */
function sendError(res, error, logLabel) {
  if (error && error.isAppError) {
    return res.status(error.status).json({
      success: false,
      message: error.message,
      ...(error.details || {}),
    });
  }

  // Not an AppError: a real bug. Log it in full, tell the client nothing.
  console.error(`${logLabel}:`, error);
  return res.status(500).json({
    success: false,
    message: "Something went wrong. Please try again.",
  });
}

module.exports = { sendError };
