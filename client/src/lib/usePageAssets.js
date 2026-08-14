import { useLayoutEffect } from "react";
import { useStylesheets } from "./useStylesheets";
import { useScripts } from "./useScripts";
import { getInlineStyleForProfile } from "./pageHeadAssets";

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
  useInlineStyle(getInlineStyleForProfile(kind, profileName));
}
