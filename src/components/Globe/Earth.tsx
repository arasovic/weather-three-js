import { useRef } from 'react'
import { Html, Sphere } from '@react-three/drei'
import * as THREE from 'three'
import { useProgressiveTexture } from '../../hooks/useProgressiveTexture'

interface EarthProps {
  radius?: number
}

function Earth({ radius = 1 }: EarthProps) {
  const groupRef = useRef<THREE.Group>(null)

  // Progressive texture loading with hash-based cache busting
  const previewUrl = `/textures/earth_preview_1024.webp?v=${__EARTH_TEXTURE_PREVIEW_HASH__}`
  const fullUrl = `/textures/earth_4096.webp?v=${__EARTH_TEXTURE_FULL_HASH__}`

  const { texture: earthTexture, status: textureStatus, isHighQuality } = useProgressiveTexture({
    previewUrl,
    fullUrl,
    timeout: 15000,
    maxRetries: 2,
  })

  return (
    <group ref={groupRef}>
      {/* Main Earth sphere */}
  <Sphere args={[radius, 128, 128]}>
        <meshStandardMaterial
          key={earthTexture ? earthTexture.uuid : 'earth-solid'}
          map={earthTexture ?? undefined}
          color={earthTexture ? undefined : '#1e3a8a'}
          roughness={0.7}
          metalness={0.15}
          toneMapped
          onUpdate={(material) => {
            if (earthTexture) {
              material.needsUpdate = true
            }
          }}
        />
      </Sphere>

      {/* Atmosphere glow */}
      <Sphere args={[radius * 1.01, 64, 64]}>
        <meshBasicMaterial color="#4a9eff" transparent opacity={0.1} side={THREE.BackSide} />
      </Sphere>

      {textureStatus !== 'ready' && (
        <Html center transform={false} className="pointer-events-none select-none">
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/65 px-5 py-3 text-xs font-medium uppercase tracking-wide text-white shadow-2xl backdrop-blur-xl">
            <span
              className={`relative inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/30 ${textureStatus === 'loading-preview' || textureStatus === 'loading-full' ? 'animate-spin-slow border-t-white border-b-white/20' : 'border-white/20'}`}
            >
              <span className="absolute h-2 w-2 rounded-full bg-blue-400/80 shadow-[0_0_8px_rgba(96,165,250,0.7)]" />
            </span>
            <div className="flex flex-col text-[10px] leading-tight">
              <span className="text-white/80">
                {textureStatus === 'loading-preview' && 'Loading preview...'}
                {textureStatus === 'loading-full' && 'Loading high quality...'}
                {textureStatus === 'error' && 'Using fallback texture'}
              </span>
              <span className="text-white/45">
                {isHighQuality ? 'Full resolution' : 'Earth surface detail'}
              </span>
            </div>
          </div>
        </Html>
      )}
    </group>
  )
}

export default Earth
