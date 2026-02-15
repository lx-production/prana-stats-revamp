import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs/promises'
import path from 'node:path'

const DATA_JSON_CACHE_SECONDS = 60 * 60 // 1 hour

const ROOT_JSON_FILES = [
  'data_180_days.json',
  'data_30_days.json',
  'data_365_days.json',
  'data_90_days.json',
  'data_max.json',
  'data_sats.json',
]

function serveRootJsonFiles() {
  let rootDir = process.cwd()
  let outDir = null

  return {
    name: 'serve-root-json-files',
    configResolved(config) {
      rootDir = config.root
      outDir = path.resolve(rootDir, config.build.outDir)
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const rawUrl = req.url || ''
        const urlPath = rawUrl.split('?')[0] || ''
        const filename = urlPath.startsWith('/') ? urlPath.slice(1) : urlPath

        if (!ROOT_JSON_FILES.includes(filename)) return next()

        try {
          const fullPath = path.join(rootDir, filename)
          const data = await fs.readFile(fullPath)
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          if (filename.startsWith('data_')) {
            res.setHeader('Cache-Control', `public, max-age=${DATA_JSON_CACHE_SECONDS}`)
          } else {
            // For bonds JSON, always revalidate in dev.
            res.setHeader('Cache-Control', 'no-cache')
          }
          res.end(data)
        } catch (err) {
          res.statusCode = 404
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ error: 'Not found' }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), serveRootJsonFiles()],
  server: {
    // Proxy API + backend-served JSON to the Node server (localhost:4173).
    proxy: {
      '/api': 'http://localhost:4173',
      '/top_holding_addresses.json': 'http://localhost:4173',
      '/bonds_v2.json': 'http://localhost:4173',
    },
  },
})
