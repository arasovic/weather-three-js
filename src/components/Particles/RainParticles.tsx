import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const pseudoRandom = (seed: number) => {
  const x = Math.sin(seed) * 43758.5453
  return x - Math.floor(x)
}

type RainParticleSettings = {
  speed: number
  length: number
  spread: number
  angle: number
}

const createRainParticles = (count: number, settings: RainParticleSettings, seedOffset: number) => {
  const positions = new Float32Array(count * 6)
  const velocities = new Float32Array(count)
  const angles = new Float32Array(count)

  for (let i = 0; i < count; i++) {
    const baseSeed = seedOffset + i * 7
    const idx = i * 6

    const x = (pseudoRandom(baseSeed) - 0.5) * settings.spread
    const y = pseudoRandom(baseSeed + 1) * settings.spread - settings.spread / 2
    const z = (pseudoRandom(baseSeed + 2) - 0.5) * settings.spread

    positions[idx] = x
    positions[idx + 1] = y
    positions[idx + 2] = z
    positions[idx + 3] = x
    positions[idx + 4] = y - settings.length
    positions[idx + 5] = z

    velocities[i] = settings.speed * (0.7 + pseudoRandom(baseSeed + 3) * 0.6)
    angles[i] = settings.angle * (pseudoRandom(baseSeed + 4) - 0.5)
  }

  return { positions, velocities, angles }
}

interface RainParticlesProps {
  count?: number
  intensity?: 'light' | 'moderate' | 'heavy'
  opacity?: number
}

function RainParticles({ count = 1000, intensity = 'moderate', opacity = 0.4 }: RainParticlesProps) {
  const linesRef = useRef<THREE.LineSegments>(null)

  // Intensity settings
  const settings = useMemo<RainParticleSettings>(() => {
    switch (intensity) {
      case 'light':
        return { speed: 0.02, length: 0.15, spread: 10, angle: 0.08 }
      case 'heavy':
        return { speed: 0.06, length: 0.3, spread: 8, angle: 0.15 }
      default:
        return { speed: 0.04, length: 0.2, spread: 9, angle: 0.12 }
    }
  }, [intensity])

  const seedBase = useMemo(() => {
    switch (intensity) {
      case 'light':
        return 11
      case 'heavy':
        return 29
      default:
        return 17
    }
  }, [intensity])

  const particleData = useMemo(
    () => createRainParticles(count, settings, seedBase),
    [count, settings, seedBase]
  )

  // Create line segments for rain streaks
  // Animate rain
  useFrame(() => {
    const lines = linesRef.current
    if (!lines) return

    const positions = lines.geometry.attributes.position.array as Float32Array

    for (let i = 0; i < count; i++) {
      const idx = i * 6

      // Update both points of the line (falling)
      positions[idx + 1] -= particleData.velocities[i]
      positions[idx + 4] -= particleData.velocities[i]

      // Diagonal movement (wind effect)
      const drift = particleData.angles[i] * 0.3
      positions[idx] += drift
      positions[idx + 3] += drift
      positions[idx + 2] += drift * 0.2
      positions[idx + 5] += drift * 0.2

      // Reset if below threshold
      if (positions[idx + 1] < -settings.spread / 2) {
        const x = (Math.random() - 0.5) * settings.spread
        const y = settings.spread / 2
        const z = (Math.random() - 0.5) * settings.spread

        positions[idx] = x
        positions[idx + 1] = y
        positions[idx + 2] = z
        positions[idx + 3] = x
        positions[idx + 4] = y - settings.length
        positions[idx + 5] = z
      }
    }

    lines.geometry.attributes.position.needsUpdate = true
  })

  return (
    <lineSegments ref={linesRef}>
      <bufferGeometry>
        <bufferAttribute
          key={`rain-positions-${count}-${intensity}`}
          attach="attributes-position"
          args={[particleData.positions, 3]}
        />
      </bufferGeometry>
      <lineBasicMaterial color="#9dc4ff" transparent opacity={opacity} />
    </lineSegments>
  )
}

export default RainParticles
