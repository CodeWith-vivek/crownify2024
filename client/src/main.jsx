import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
          <Toaster />
          <ConfirmDialogHost />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
