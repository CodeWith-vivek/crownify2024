const fs = require("fs");
const path = require("path");

// Express-facing glue between the 4 SSR routes and the Vite-built React SSR
// bundle. Deliberately conservative: any failure anywhere in this file
// (bundle not built, render throws, template missing) must never surface as
// a 500 — the caller (src/app.js) falls back to the plain static shell on
// a null return, so a broken SSR path can only ever degrade to today's
// pure-CSR behavior, never take the page down.

const CLIENT_DIST = path.join(__dirname, "..", "..", "client", "dist");
const SSR_ENTRY_PATH = path.join(CLIENT_DIST, "server", "entry-server.mjs");
const TEMPLATE_PATH = path.join(CLIENT_DIST, "client", "index.html");

// Loaded once and reused across requests. Deliberately lazy — never
// imported/read at module load time — so requiring this file (or booting
// the server) never fails just because `npm run build` hasn't produced
// client/dist/server yet; the failure is instead contained to individual
// SSR requests, which fall back gracefully.
let ssrModulePromise = null;
function loadSsrModule() {
  if (!ssrModulePromise) {
    // Dynamic import from this CommonJS file into the ESM bundle Vite's
    // SSR build produces — Node has supported this direction since v12.
    ssrModulePromise = import(pathToFileUrl(SSR_ENTRY_PATH));
  }
  return ssrModulePromise;
}

function pathToFileUrl(absolutePath) {
  // import() needs a file:// URL on Windows (a bare drive-letter path like
  // "D:\..." is not a valid module specifier); require("url").pathToFileURL
  // handles the platform-specific escaping correctly either way.
  return require("url").pathToFileURL(absolutePath).href;
}

let templateCache = null;
function loadTemplate() {
  if (!templateCache) {
    templateCache = fs.readFileSync(TEMPLATE_PATH, "utf-8");
  }
  return templateCache;
}

// Embeds as non-executable JSON (`type="application/json"`, never run as
// script regardless of content), so the only escaping actually needed is
// neutralizing a literal `</script` sequence that could appear inside
// product names/descriptions in the dehydrated data.
function serializeState(dehydratedState) {
  const json = JSON.stringify(dehydratedState ?? null).replace(/</g, "\\u003c");
  return `<script id="__RQ_STATE__" type="application/json">${json}</script>`;
}

function injectIntoTemplate(template, { html, dehydratedState, title, description, headLinks, headStyleText }) {
  const headExtras = [
    ...headLinks.map((href) => `<link rel="stylesheet" href="${href}">`),
    headStyleText ? `<style data-page-style="true">${headStyleText}</style>` : "",
  ].join("\n    ");

  return template
    .replace("<title>CROWNIFY</title>", `<title>${title}</title>`)
    .replace('<meta name="description" content="description" />', `<meta name="description" content="${description}" />`)
    .replace("<!--app-head-->", headExtras)
    .replace("<!--app-html-->", html)
    .replace("<!--app-state-->", serializeState(dehydratedState));
}

/**
 * @param {import("express").Request} req
 * @returns {Promise<string|null>} the full HTML document, or null if this
 *   request doesn't match an SSR route or SSR failed for any reason —
 *   either way the caller should serve the static shell instead.
 */
async function renderPage(req) {
  try {
    const { render } = await loadSsrModule();
    const result = await render(req.originalUrl);
    if (!result) return null;

    return injectIntoTemplate(loadTemplate(), result);
  } catch (error) {
    console.error("SSR render failed, falling back to CSR shell:", error);
    return null;
  }
}

module.exports = { renderPage };
