import { useEffect } from "react";

/**
 * Loads <script> tags sequentially (each waits for the previous to finish,
 * since jQuery/Bootstrap/plugins.js/main.js all depend on load order) and
 * only once per src across the app's lifetime — MainLayout/AdminLayout stay
 * mounted across client-side route changes (React Router doesn't remount
 * them), so this runs once on first load, same as the original site's
 * single full-page load, not once per navigation.
 */
export function useScripts(srcs) {
  useEffect(() => {
    let cancelled = false;

    async function loadSequentially() {
      for (const src of srcs) {
        if (cancelled) return;
        if (document.querySelector(`script[src="${src}"]`)) continue;
        await new Promise((resolve) => {
          const script = document.createElement("script");
          script.src = src;
          script.async = false;
          script.onload = resolve;
          script.onerror = resolve;
          document.body.appendChild(script);
        });
      }
    }

    loadSequentially();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [srcs.join("|")]);
}
