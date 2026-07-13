import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolveBuildInfo } from '../utils/resolveBuildInfo.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Bake git identity into the client bundle at build/dev-server start.
const appBuildInfo = resolveBuildInfo()

const rootDataJsonFiles = [
  'active_stakes.json',
  'bonds_v2.json',
  'bonds_v2_details.json',
  'buy_dips.json',
  'data_7_days.json',
  'data_30_days.json',
  'data_90_days.json',
  'data_180_days.json',
  'data_365_days.json',
  'data_730_days.json',
  'data_max.json',
  'data_sats.json',
  'top_holding_addresses.json',
];

export default defineConfig({
  // Keep project root at repo root even though this config lives in config/
  root: path.resolve(__dirname, '..'),
  plugins: [react()],
  // Frontend footer reads this constant; must stay JSON-serializable.
  define: {
    __APP_BUILD_INFO__: JSON.stringify(appBuildInfo),
  },
  css: {
    postcss: path.join(__dirname, 'postcss.config.js'),
  },
  server: {
    watch: {
      ignored: rootDataJsonFiles.map((filename) => `**/${filename}`),
      usePolling: true,
      interval: 1000,
    },
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
