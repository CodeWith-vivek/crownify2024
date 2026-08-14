import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryCache, QueryClient, QueryClientProvider, HydrationBoundary } from '@tanstack/react-query'
import { Toaster, toast } from 'sonner'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './store/AuthContext.jsx'
import { ConfirmDialogHost } from './components/ui/ConfirmDialog.jsx'

const queryClient = new QueryClient({
  // Global failure notice. Only some pages render a dedicated PageError /
  // AdminError block; the rest fall through to their empty state, so a
  // failed request silently reads as "there is no data" — on an admin list
  // that looks like the records were deleted. This guarantees every failed
  // query says so out loud, wherever it happens.
  queryCache: new QueryCache({
    onError: (error) => {
      // 401s are already handled by AuthContext, which clears the session
      // and redirects to the right login screen — a toast on top of that is
      // just noise.
      if (error?.status === 401) return
      toast.error(error?.message || "Couldn't load data. Please check your connection and try again.")
    },
  }),
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

// Present only on the 4 SSR'd routes (see entry-server.jsx / src/ssr/renderPage.js).
// `undefined` here — the case for every other route — is a documented no-op
// for HydrationBoundary, so this branch-free read is safe everywhere.
const ssrStateEl = document.getElementById('__RQ_STATE__')
const dehydratedState = ssrStateEl ? JSON.parse(ssrStateEl.textContent) : undefined

const rootContainer = document.getElementById('root')

// sonner's <Toaster/> reads `document` synchronously at render time, so it
// can't be part of a server-rendered tree (see entry-server.jsx). Mounted
// into its own always-present, always-client-only node instead of as a
// sibling of <App/> inside #root — keeps it fully outside the hydration
// diff for the SSR routes, with no behavior change on any other route.
createRoot(document.getElementById('toaster-root')).render(<Toaster />)

const tree = (
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <HydrationBoundary state={dehydratedState}>
        <BrowserRouter>
          <AuthProvider>
            <App />
            <ConfirmDialogHost />
          </AuthProvider>
        </BrowserRouter>
      </HydrationBoundary>
    </QueryClientProvider>
  </StrictMode>
)

// A non-empty #root means the server rendered real markup into it (one of
// the 4 SSR routes) and this must hydrate that markup, not discard and
// re-render it. Every other route still gets an empty #root from the
// static shell, exactly as before this file changed.
if (rootContainer.hasChildNodes()) {
  hydrateRoot(rootContainer, tree)
} else {
  createRoot(rootContainer).render(tree)
}
