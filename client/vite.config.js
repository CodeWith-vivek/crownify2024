import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
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
})
