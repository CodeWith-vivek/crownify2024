// Admin panel runs its own modern design system (styles/admin-modern.css,
// imported by AdminLayout and scoped under .admin-shell) instead of the old
// Evara admin theme. Only Bootstrap's grid/reset layer and the icon font are
// loaded here — everything visual is overridden by admin-modern.css.
//
// The customer-facing pages are untouched by this and still load their
// original per-page theme bundles via userProfiles.js.
const SHARED_LINKS = [
  "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css",
  "https://fonts.googleapis.com/icon?family=Material+Icons",
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
];

const SHARED_SCRIPTS = ["https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"];

export const adminProfiles = {
  minimal: { links: SHARED_LINKS, scripts: SHARED_SCRIPTS },
  header2: { links: SHARED_LINKS, scripts: SHARED_SCRIPTS },
  headerdashboard: { links: SHARED_LINKS, scripts: SHARED_SCRIPTS },
};
