import { Outlet } from "react-router-dom";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { Preloader, usePreloaderVisible } from "./Preloader";
// Additive control polish (radius/easing/hover/focus only) layered on top of
// the original theme — see styles/user-polish.css. Scoped to .pageWrapper so
// it never reaches the admin panel.
import "@/styles/user-polish.css";

// CSS/JS loading is per-page now (see usePageAssets) since the original EJS
// app used a different combination of stylesheets per page (17 distinct
// profiles) rather than one shared bundle — each page component calls
// usePageAssets("user", "<profile>") to load exactly what it needs.
//
// A real MPA reload blocks rendering until <link rel="stylesheet"> finishes
// loading, so the original site never showed an unstyled flash on
// navigation. An SPA route change doesn't get that for free, so the shared
// Preloader gate simulates it — see components/layout/Preloader.jsx.
export function MainLayout() {
  const showPreloader = usePreloaderVisible();

  return (
    <div className="pageWrapper" style={{ backgroundColor: "white" }}>
      {showPreloader && <Preloader />}
      <Header />
      <Outlet />
      <Footer />
    </div>
  );
}
