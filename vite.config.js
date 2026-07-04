import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Proxy API + root JSON to the Node server so dev and prod share the same cache behavior.
    // Use 4174 in dev: Cursor's preview often binds localhost:4173 and returns HTML for /api/swap/quote.
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4174',
        changeOrigin: true,
      },
      // Root data JSON (price history, bonds, buy dips) — served from project root by Node.
      '^/[^/]+\\.json$': {
        target: 'http://127.0.0.1:4174',
        changeOrigin: true,
      },
    },
  },
})
