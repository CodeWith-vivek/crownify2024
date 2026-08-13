import { useLayoutEffect } from "react";
import { useStylesheets } from "./useStylesheets";
import { useScripts } from "./useScripts";

// Eagerly bundled as raw CSS text (not applied as stylesheets on import) —
// each file is one page's unique inline <style> block from the original
// EJS app, keyed by profile name.
const userStyleText = import.meta.glob("../styles/user/*.css", { query: "?raw", import: "default", eager: true });
const adminStyleText = import.meta.glob("../styles/admin/*.css", { query: "?raw", import: "default", eager: true });

function lookup(map, name) {
  const entry = Object.entries(map).find(([path]) => path.endsWith(`/${name}.css`));
  return entry ? entry[1] : "";
}

// useLayoutEffect for the same reason as useStylesheets — this is the page's
// critical inline CSS, so it must land in <head> before the first paint.
function useInlineStyle(cssText) {
  useLayoutEffect(() => {
    if (!cssText) return;
    const style = document.createElement("style");
    style.setAttribute("data-page-style", "true");
    style.textContent = cssText;
    document.head.appendChild(style);
    return () => style.remove();
  }, [cssText]);
}

/**
 * Loads the exact CSS links, scripts, and inline <style> block the original
 * EJS app used for a given page (headProfile name), so styling stays
 * pixel-identical instead of a shared blanket approximation.
 */
export function usePageAssets(kind, profileName, profiles) {
  const profile = profiles[profileName] || { links: [], scripts: [] };
  useStylesheets(profile.links);
  useScripts(profile.scripts);
  const cssText = kind === "admin" ? lookup(adminStyleText, profileName) : lookup(userStyleText, profileName);
  useInlineStyle(cssText);
}
