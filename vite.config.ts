import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const earthTexturePreviewPath = path.resolve(rootDir, 'public/textures/earth_preview_1024.webp')
const earthTextureFullPath = path.resolve(rootDir, 'public/textures/earth_4096.webp')

let earthTexturePreviewHash = 'dev'
let earthTextureFullHash = 'dev'

// Hash preview texture
try {
  const buffer = fs.readFileSync(earthTexturePreviewPath)
  earthTexturePreviewHash = crypto.createHash('md5').update(buffer).digest('hex').slice(0, 10)
} catch (error) {
  console.warn('[vite] Unable to hash earth preview texture', error)
}

// Hash full texture
try {
  const buffer = fs.readFileSync(earthTextureFullPath)
  earthTextureFullHash = crypto.createHash('md5').update(buffer).digest('hex').slice(0, 10)
} catch (error) {
  console.warn('[vite] Unable to hash earth full texture', error)
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5179,
  },
  define: {
    __EARTH_TEXTURE_PREVIEW_HASH__: JSON.stringify(earthTexturePreviewHash),
    __EARTH_TEXTURE_FULL_HASH__: JSON.stringify(earthTextureFullHash),
  },
})
