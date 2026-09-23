import { resolve } from 'node:path'
import type { Connect } from 'vite'
import { defineConfig } from 'vite'

// "/c?w=rain" would otherwise fall back to the root page; send it to "/c/?w=rain".
const trailingSlash: Connect.NextHandleFunction = (req, res, next) => {
  const m = req.url?.match(/^\/([abc])(\?.*)?$/)
  if (!m) return next()
  res.statusCode = 301
  res.setHeader('Location', `/${m[1]}/${m[2] ?? ''}`)
  res.end()
}

export default defineConfig({
  server: { port: 5181, strictPort: true },
  plugins: [
    {
      name: 'trailing-slash',
      configureServer: (server) => void server.middlewares.use(trailingSlash),
      configurePreviewServer: (server) => void server.middlewares.use(trailingSlash),
    },
  ],
  build: {
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, 'index.html'),
        a: resolve(import.meta.dirname, 'a/index.html'),
        b: resolve(import.meta.dirname, 'b/index.html'),
        c: resolve(import.meta.dirname, 'c/index.html'),
      },
    },
  },
})
