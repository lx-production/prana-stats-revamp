import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Proxy API + root JSON to the Node server so dev and prod share the same cache behavior.
    proxy: {
      '/api': 'http://localhost:4173',
      '^/data_.*\\.json$': 'http://localhost:4173',
      '/bonds_v2.json': 'http://localhost:4173',
      '/buy_dips.json': 'http://localhost:4173',
    },
  },
})
