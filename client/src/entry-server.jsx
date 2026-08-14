import { renderToString } from "react-dom/server";
import { StaticRouter, matchPath } from "react-router-dom";
import { QueryClient, QueryClientProvider, dehydrate } from "@tanstack/react-query";
import App from "./App.jsx";
import { AuthProvider } from "./store/AuthContext.jsx";
import { ConfirmDialogHost } from "./components/ui/ConfirmDialog.jsx";
import { productApi } from "./features/product/productApi";
import { userProfiles } from "./styles/userProfiles";
import { getHeadLinksForProfile, getInlineStyleForProfile } from "./lib/pageHeadAssets";

// Server-rendering for exactly the 4 public storefront routes. Everything
// else is served the plain CSR shell (see src/ssr/renderPage.js on the
// Express side, and src/app.js's route registration) — this file only ever
// runs for those 4 paths.
//
// Deliberately excludes <Toaster/> from the tree: sonner reads
// `document.hidden` synchronously in a useState initializer, which throws
// under renderToString. It's mounted separately, client-only, in
// main.jsx. <ConfirmDialogHost/> is SSR-safe (useSyncExternalStore with a
// real getServerSnapshot) and is included to keep the hydrated tree shape
// matching main.jsx's.

const DEFAULT_DESCRIPTION =
  "Crownify — premium branded caps and hats. Shop the latest arrivals with secure checkout.";

function truncate(text, max = 160) {
  if (!text) return DEFAULT_DESCRIPTION;
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

// One entry per SSR'd route: which profile's <head> assets it needs, how to
// prefetch its data into a given QueryClient (same queryKey/queryFn each
// page component already uses, so the client's own useQuery finds a warm
// cache after hydration), and how to derive <title>/<meta description> from
// what was fetched.
const ROUTES = [
  {
    path: "/",
    profile: "header",
    prefetch: (queryClient) => queryClient.prefetchQuery({ queryKey: ["home"], queryFn: productApi.home }),
    meta: () => ({ title: "CROWNIFY — Premium Caps & Hats", description: DEFAULT_DESCRIPTION }),
  },
  {
    path: "/shop",
    profile: "headershop",
    // `search` is taken verbatim from the incoming URL, not re-derived, so
    // it matches ShopPage's `useSearchParams().toString()` character for
    // character — otherwise the query key wouldn't line up and the
    // prefetch would be silently wasted (a fresh client-side refetch, not
    // a crash) rather than actually warming the cache.
    prefetch: (queryClient, url) => {
      const search = new URLSearchParams(url.search);
      return queryClient.prefetchQuery({
        queryKey: ["shop", search.toString()],
        queryFn: () => productApi.shop(search),
      });
    },
    meta: () => ({
      title: "Shop All Caps & Hats — CROWNIFY",
      description: "Browse the full Crownify collection of branded caps and hats.",
    }),
  },
  {
    path: "/product/:id",
    profile: "headershopdetails",
    prefetch: (queryClient, url, params) =>
      queryClient.prefetchQuery({ queryKey: ["product", params.id], queryFn: () => productApi.detail(params.id) }),
    meta: (queryClient, params) => {
      const data = queryClient.getQueryData(["product", params.id]);
      const product = data?.product;
      if (!product) return { title: "CROWNIFY", description: DEFAULT_DESCRIPTION };
      return { title: `${product.productName} — CROWNIFY`, description: truncate(product.description) };
    },
  },
  {
    path: "/brand",
    profile: "header",
    prefetch: (queryClient) => queryClient.prefetchQuery({ queryKey: ["brand"], queryFn: productApi.brand }),
    meta: () => ({
      title: "Shop by Brand — CROWNIFY",
      description: "Explore Crownify's caps and hats by brand.",
    }),
  },
];

function matchRoute(pathname) {
  for (const route of ROUTES) {
    const match = matchPath({ path: route.path, end: true }, pathname);
    if (match) return { route, params: match.params };
  }
  return null;
}

/**
 * @param {string} rawUrl  req.originalUrl — path + query string
 * @returns {Promise<{html, dehydratedState, title, description, headLinks, headStyleText} | null>}
 *   null when rawUrl doesn't match one of the 4 SSR routes — caller falls
 *   back to the static shell.
 */
export async function render(rawUrl) {
  const url = new URL(rawUrl, "http://internal");
  const matched = matchRoute(url.pathname);
  if (!matched) return null;

  const { route, params } = matched;
  // retryOnMount:false is required here — retry:false alone is NOT enough
  // and was tried first; it only governs retrying a failed fetch attempt,
  // a different option from what actually bit us.
  //
  // A freshly-constructed QueryObserver for an ALREADY errored query (e.g.
  // an unknown product id) fetches again as a synchronous side effect of
  // being observed for the first time — shouldLoadOnMount in TanStack
  // Query's own source returns true whenever data is undefined and the
  // query is errored, UNLESS retryOnMount is explicitly false (it defaults
  // to true). That flips the query back to status:'pending' mid
  // renderToString, so the page renders its loading state instead of the
  // real error state — and there's no second render pass to recover on
  // the server, unlike the client. Confirmed by direct inspection: with
  // this left at its default, the live cache read status:'error' right up
  // until render, and status:'pending' *during* render, for the exact
  // same query key.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, retryOnMount: false } },
  });

  await route.prefetch(queryClient, url, params);

  const { title, description } = route.meta(queryClient, params);
  const headLinks = getHeadLinksForProfile(route.profile, userProfiles);
  const headStyleText = getInlineStyleForProfile("user", route.profile);

  const tree = (
    <StaticRouter location={rawUrl}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <App />
          <ConfirmDialogHost />
        </AuthProvider>
      </QueryClientProvider>
    </StaticRouter>
  );

  const html = renderToString(tree);

  return { html, dehydratedState: dehydrate(queryClient), title, description, headLinks, headStyleText };
}
