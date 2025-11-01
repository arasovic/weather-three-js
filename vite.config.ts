import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const earthTexturePath = path.resolve(rootDir, 'public/textures/land_ocean_ice_8192.png')

let earthTextureHash = 'dev'

try {
  const buffer = fs.readFileSync(earthTexturePath)
  earthTextureHash = crypto.createHash('md5').update(buffer).digest('hex').slice(0, 10)
} catch (error) {
  console.warn('[vite] Unable to hash earth texture asset', error)
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5179,
  },
  define: {
    __EARTH_TEXTURE_HASH__: JSON.stringify(earthTextureHash),
  },
})
