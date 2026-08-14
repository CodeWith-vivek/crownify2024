// Plain functions (no hooks) wrapping the same per-profile CSS lookup
// usePageAssets.js uses — factored out so entry-server.jsx can resolve a
// route's <head> assets without a React render, and so the two paths can't
// drift apart into two different implementations of the same lookup.

const userStyleText = import.meta.glob("../styles/user/*.css", { query: "?raw", import: "default", eager: true });
const adminStyleText = import.meta.glob("../styles/admin/*.css", { query: "?raw", import: "default", eager: true });

function lookup(map, name) {
  const entry = Object.entries(map).find(([path]) => path.endsWith(`/${name}.css`));
  return entry ? entry[1] : "";
}

export function getHeadLinksForProfile(profileName, profiles) {
  return profiles[profileName]?.links || [];
}

export function getInlineStyleForProfile(kind, profileName) {
  return kind === "admin" ? lookup(adminStyleText, profileName) : lookup(userStyleText, profileName);
}
