import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ isSsrBuild }) => ({
  plugins: [react()],
  // Vitest's own esbuild pass (separate from @vitejs/plugin-react's babel
  // transform, which handles app source, and from the real `vite build`,
  // which uses oxc) falls back to the classic JSX runtime by default —
  // every .test.jsx file would need `import React from 'react'` just to
  // satisfy the transform, unlike every other component in this codebase.
  // Scoped to process.env.VITEST only: oxc already defaults to automatic
  // for the production build, and setting esbuild.jsx unconditionally
  // just produced a "both esbuild and oxc options were set" build warning
  // for no effect.
  ...(process.env.VITEST ? { esbuild: { jsx: 'automatic' } } : {}),
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.js'],
    // Explicit imports (describe/it/expect from 'vitest'), not injected
    // globals — matches the rest of the codebase's no-implicit-globals
    // convention.
    globals: false,
    css: false,
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/uploads': 'http://localhost:3000',
      '/invoices': 'http://localhost:3000',
      '/auth': 'http://localhost:3000',
      // Original Bootstrap CSS/JS/image assets — served by Express from
      // public/, reused as-is for pixel-perfect fidelity instead of
      // duplicating them into client/public/.
      '/assets': 'http://localhost:3000',
      '/js': 'http://localhost:3000',
    },
  },
  build: isSsrBuild
    ? {
        // src/ssr/renderPage.js on the Express side loads this file by an
        // exact, hardcoded name. Forcing an explicit .mjs extension makes
        // Node parse it as ESM off the extension alone, rather than only
        // via the directory-walk to client/package.json's "type": "module"
        // — cheap insurance against this breaking if the output ever moves.
        rollupOptions: {
          output: { entryFileNames: 'entry-server.mjs' },
        },
      }
    : undefined,
}))
