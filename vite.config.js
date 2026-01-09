import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs/promises'
import path from 'node:path'

const ROOT_JSON_FILES = [
  'bonds_v2.json',
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
          res.end(data)
        } catch (err) {
          res.statusCode = 404
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ error: 'Not found' }))
        }
      })
    },
    async closeBundle() {
      // Ensure the same JSON files exist in the production build output so
      // existing `fetch('/data_*.json')` calls keep working.
      if (!outDir) return

      await fs.mkdir(outDir, { recursive: true })

      await Promise.all(
        ROOT_JSON_FILES.map(async (filename) => {
          const src = path.join(rootDir, filename)
          const dest = path.join(outDir, filename)
          try {
            await fs.copyFile(src, dest)
          } catch (err) {
            // Don't fail the entire build if a file is missing.
            console.warn(`[serve-root-json-files] Failed to copy ${filename}`)
          }
        }),
      )
    },
  }
}

export default defineConfig({
  plugins: [react(), serveRootJsonFiles()],
})

