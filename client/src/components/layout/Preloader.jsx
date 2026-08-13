import { useLayoutEffect, useState } from "react";
import { useStylesheetsLoading } from "@/lib/useStylesheets";

/**
 * Full-screen cover shown until this page's stylesheets have finished
 * loading, mirroring what a real MPA gets for free (the browser blocks
 * rendering on <link rel="stylesheet">). An SPA route change / hydration
 * doesn't, so without this a page can paint before its CSS arrives.
 *
 * Every style here is inline on purpose: the whole point is that the
 * page's own CSS may not have loaded yet, so the preloader can't depend
 * on it (an earlier version used the theme's #pre-loader class and showed
 * up unstyled itself).
 */
export function Preloader() {
  return (
    <div
      id="pre-loader"
      style={{
        backgroundColor: "#fff",
        height: "100%",
        width: "100%",
        position: "fixed",
        margin: 0,
        top: 0,
        left: 0,
        bottom: 0,
        right: 0,
        overflow: "hidden",
        zIndex: 999999,
      }}
    >
      <img
        src="/assets/images/loader.gif"
        alt="Loading..."
        style={{
          textAlign: "center",
          left: 0,
          right: 0,
          position: "absolute",
          top: "50%",
          transform: "translateY(-50%)",
          margin: "0 auto",
          zIndex: 99,
        }}
      />
    </div>
  );
}

/**
 * Shared gate used by every layout (storefront, profile, admin, payment).
 * Returns true while the preloader should cover the page: on the initial
 * mount, and on any later navigation whose stylesheets are still in flight.
 */
export function usePreloaderVisible() {
  const stylesLoading = useStylesheetsLoading();
  const [initialDone, setInitialDone] = useState(false);

  // Layout effect so the "styles finished" transition is applied before the
  // browser paints, rather than one frame late.
  useLayoutEffect(() => {
    if (!stylesLoading) setInitialDone(true);
  }, [stylesLoading]);

  const visible = !initialDone || stylesLoading;

  // Hand off from the static index.html preloader (which covers the blank
  // window before the app bundle boots) to this one. Removing it only once
  // we no longer need a preloader ourselves means there's never a frame
  // with neither on screen. Idempotent, so it's safe that several layouts
  // call this hook.
  useLayoutEffect(() => {
    if (visible) return;
    document.getElementById("initial-preloader")?.remove();
  }, [visible]);

  return visible;
}
