import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  server: { port: 5181, strictPort: true },
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
