const wantsJson = (req) =>
  req.originalUrl.startsWith("/api") || req.xhr || req.get("accept")?.includes("json");

module.exports = { wantsJson };
