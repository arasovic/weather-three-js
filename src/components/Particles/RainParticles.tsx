import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface RainParticlesProps {
  count?: number
  intensity?: 'light' | 'moderate' | 'heavy'
}

function RainParticles({ count = 1000, intensity = 'moderate' }: RainParticlesProps) {
  const linesRef = useRef<THREE.LineSegments>(null)

  // Intensity settings
  const settings = useMemo(() => {
    switch (intensity) {
      case 'light':
        return { speed: 0.02, length: 0.15, spread: 10, angle: 0.08 }
      case 'heavy':
        return { speed: 0.06, length: 0.3, spread: 8, angle: 0.15 }
      default:
        return { speed: 0.04, length: 0.2, spread: 9, angle: 0.12 }
    }
  }, [intensity])

  // Create line segments for rain streaks
  const particles = useMemo(() => {
    const positions = new Float32Array(count * 6) // 2 points per line, 3 coords per point
    const velocities = new Float32Array(count)
    const angles = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      const idx = i * 6

      // Start position
      const x = (Math.random() - 0.5) * settings.spread
      const y = Math.random() * settings.spread - settings.spread / 2
      const z = (Math.random() - 0.5) * settings.spread

      // Line start point
      positions[idx] = x
      positions[idx + 1] = y
      positions[idx + 2] = z

      // Line end point (creating the streak)
      positions[idx + 3] = x
      positions[idx + 4] = y - settings.length
      positions[idx + 5] = z

      // Random velocity and angle
      velocities[i] = settings.speed * (0.7 + Math.random() * 0.6)
      angles[i] = settings.angle * (Math.random() - 0.5)
    }

    return { positions, velocities, angles }
  }, [count, settings])

  // Animate rain
  useFrame(() => {
    if (!linesRef.current) return

    const positions = linesRef.current.geometry.attributes.position.array as Float32Array

    for (let i = 0; i < count; i++) {
      const idx = i * 6

      // Update both points of the line (falling)
      positions[idx + 1] -= particles.velocities[i]
      positions[idx + 4] -= particles.velocities[i]

      // Diagonal movement (wind effect)
      const drift = particles.angles[i] * 0.3
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

    linesRef.current.geometry.attributes.position.needsUpdate = true
  })

  return (
    <lineSegments ref={linesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count * 2}
          array={particles.positions}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial color="#9dc4ff" transparent opacity={0.4} />
    </lineSegments>
  )
}

export default RainParticles
