import { useEffect, useRef, useState } from 'react'
import { useThree } from '@react-three/fiber'
import { Sphere } from '@react-three/drei'
import * as THREE from 'three'

interface EarthProps {
  radius?: number
}

function Earth({ radius = 1 }: EarthProps) {
  const groupRef = useRef<THREE.Group>(null)
  const [earthTexture, setEarthTexture] = useState<THREE.Texture | null>(null)
  const { gl } = useThree()

  useEffect(() => {
    if (typeof window === 'undefined') return

    let disposed = false
    let generatedTexture: THREE.CanvasTexture | null = null
    let activeObjectUrl: string | null = null

    const loadTexture = async () => {
      let objectUrl: string | null = null

      try {
        const response = await fetch('/textures/land_ocean_ice_8192.png')
        if (!response.ok) {
          throw new Error(`Texture fetch failed: ${response.status}`)
        }

        if (disposed) {
          return
        }

        const blob = await response.blob()
        objectUrl = URL.createObjectURL(blob)

        const image = new Image()
        image.src = objectUrl

        if (typeof image.decode === 'function') {
          await image.decode()
        } else {
          await new Promise<void>((resolve, reject) => {
            const handleLoad = () => {
              image.removeEventListener('load', handleLoad)
              image.removeEventListener('error', handleError)
              resolve()
            }

            const handleError = (event: Event) => {
              image.removeEventListener('load', handleLoad)
              image.removeEventListener('error', handleError)
              reject(event)
            }

            image.addEventListener('load', handleLoad)
            image.addEventListener('error', handleError)
          })
        }

        if (disposed) {
          return
        }

        const rendererMaxTextureSize = gl.capabilities?.maxTextureSize ?? 4096
        const maxDimension = Math.min(8192, rendererMaxTextureSize, image.width)
        const width = Math.min(maxDimension, image.width)
        const height = Math.round((image.height / image.width) * width)
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const context = canvas.getContext('2d')

        if (!context) {
          throw new Error('Unable to acquire 2D context for Earth texture')
        }

        if ('imageSmoothingEnabled' in context) {
          context.imageSmoothingEnabled = false
        }
        if ('imageSmoothingQuality' in context) {
          context.imageSmoothingQuality = 'high'
        }
        context.drawImage(image, 0, 0, width, height)

        const texture = new THREE.CanvasTexture(canvas)
        texture.colorSpace = THREE.SRGBColorSpace
        const maxAnisotropy =
          typeof gl.capabilities?.getMaxAnisotropy === 'function'
            ? gl.capabilities.getMaxAnisotropy()
            : (gl.capabilities as { maxAnisotropy?: number })?.maxAnisotropy ?? 1
        texture.anisotropy = Math.min(16, maxAnisotropy)
        texture.generateMipmaps = true
        texture.minFilter = THREE.LinearMipmapLinearFilter
        texture.magFilter = THREE.LinearFilter
        texture.wrapS = THREE.ClampToEdgeWrapping
        texture.wrapT = THREE.ClampToEdgeWrapping
        texture.needsUpdate = true

        if (disposed) {
          texture.dispose()
        } else {
          generatedTexture = texture
          activeObjectUrl = objectUrl
          objectUrl = null
          setEarthTexture(texture)
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('Failed to load earth texture', error)
        }
      } finally {
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl)
        }

        if (!generatedTexture && import.meta.env.DEV && !disposed) {
          console.error('Earth texture failed to load - no fallback available')
        }
      }
    }

    loadTexture()

    return () => {
      disposed = true
      setEarthTexture(null)

      if (generatedTexture) {
        generatedTexture.dispose()
      }

      if (activeObjectUrl) {
        URL.revokeObjectURL(activeObjectUrl)
      }
    }
  }, [gl])

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
    </group>
  )
}

export default Earth
