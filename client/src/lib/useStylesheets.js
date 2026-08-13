import { useLayoutEffect, useSyncExternalStore } from "react";

// Module-level so it survives across component mount/unmount cycles —
// tracks how many currently-mounted pages need each href.
const refCounts = new Map();

// Tracks stylesheets that have been inserted but haven't fired `load` yet,
// so MainLayout can hold the preloader up across a route change instead of
// showing a flash of unstyled content while a page-specific CSS bundle
// (e.g. the usershop/* theme, only used by a few profiles) is still in
// flight. A real MPA reload would block rendering until CSS loads; an SPA
// route change doesn't get that for free, so we simulate it.
const pendingHrefs = new Set();
const listeners = new Set();
function notify() {
  listeners.forEach((cb) => cb());
}

export function subscribeStylesheetLoading(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function isStylesheetLoading() {
  return pendingHrefs.size > 0;
}

export function useStylesheetsLoading() {
  return useSyncExternalStore(subscribeStylesheetLoading, isStylesheetLoading, isStylesheetLoading);
}

/**
 * Injects <link rel="stylesheet"> tags into <head> for the lifetime of the
 * calling component, matching the per-layout CSS the original EJS app
 * loaded per-page (public/assets/css/*, public/assets/admin2/css/*, Google
 * Fonts, Font Awesome). Many hrefs are shared across multiple page profiles
 * (bootstrap.min.css, style.css, etc.) — ref-counted so a link is only
 * physically removed once no mounted page needs it anymore, avoiding an
 * unstyled flash on every client-side navigation.
 *
 * Deliberately useLayoutEffect, not useEffect: passive effects run AFTER the
 * browser paints, so with useEffect the very first paint of a page happened
 * before any <link> existed — an intermittent flash of unstyled content on
 * refresh, and one the preloader couldn't cover because pendingHrefs was
 * still empty at that point. Layout effects run synchronously before paint,
 * so the links (and the pending count the preloader gates on) are always in
 * place first. No SSR here, so the usual useLayoutEffect caveat is moot.
 */
export function useStylesheets(hrefs) {
  useLayoutEffect(() => {
    hrefs.forEach((href) => {
      const count = refCounts.get(href) || 0;
      refCounts.set(href, count + 1);

      const existing = document.querySelector(`link[href="${href}"]`);
      if (existing) {
        // Re-append (moves, doesn't refetch) so cascade order always
        // matches THIS page's intended order — a link shared with a
        // previously-visited page would otherwise stay wherever that
        // page left it, scrambling the cascade for profiles that
        // deliberately load conflicting stylesheets in a specific order
        // (e.g. headercart's two Bootstrap builds).
        document.head.appendChild(existing);
        return;
      }

      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      pendingHrefs.add(href);
      notify();
      const settle = () => {
        pendingHrefs.delete(href);
        notify();
      };
      link.addEventListener("load", settle, { once: true });
      link.addEventListener("error", settle, { once: true });
      document.head.appendChild(link);
    });

    return () => {
      hrefs.forEach((href) => {
        const count = (refCounts.get(href) || 1) - 1;
        if (count <= 0) {
          refCounts.delete(href);
          pendingHrefs.delete(href);
          document.querySelector(`link[href="${href}"]`)?.remove();
        } else {
          refCounts.set(href, count);
        }
      });
      notify();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hrefs.join("|")]);
}
