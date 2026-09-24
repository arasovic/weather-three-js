import { defineConfig } from 'vite'

export default defineConfig({
  server: { port: 5181, strictPort: true },
  build: {
    // three's renderer alone is ~600 kB minified and cannot be trimmed further.
    chunkSizeWarningLimit: 700,
    rolldownOptions: {
      // three rarely changes, so keep it in its own long-cached file.
      output: { codeSplitting: { groups: [{ name: 'three', test: /node_modules[\\/]three[\\/]/ }] } },
    },
  },
})
