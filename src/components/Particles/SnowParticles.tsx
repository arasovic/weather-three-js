import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface SnowParticlesProps {
  count?: number
  intensity?: 'light' | 'moderate' | 'heavy'
}

// Create a smooth circular texture for snow particles
const createSnowTexture = () => {
  const canvas = document.createElement('canvas')
  canvas.width = 32
  canvas.height = 32
  const ctx = canvas.getContext('2d')

  if (ctx) {
    // Create radial gradient for smooth circular shape
    const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16)
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.8)')
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')

    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 32, 32)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}

function SnowParticles({ count = 800, intensity = 'moderate' }: SnowParticlesProps) {
  const pointsRef = useRef<THREE.Points>(null)
  const texture = useMemo(() => createSnowTexture(), [])

  // Intensity settings
  const settings = useMemo(() => {
    switch (intensity) {
      case 'light':
        return { speed: 0.004, size: 0.025, spread: 15 }
      case 'heavy':
        return { speed: 0.012, size: 0.045, spread: 12 }
      default:
        return { speed: 0.007, size: 0.035, spread: 13 }
    }
  }, [intensity])

  // Create particle positions and properties
  const particles = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const basePositions = new Float32Array(count * 3) // Store base positions
    const velocities = new Float32Array(count)
    const phases = new Float32Array(count)
    const swayAmplitudes = new Float32Array(count)
    const rotationSpeeds = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      // Random position in a box around the globe
      const x = (Math.random() - 0.5) * settings.spread
      const y = Math.random() * settings.spread - settings.spread / 2
      const z = (Math.random() - 0.5) * settings.spread

      positions[i * 3] = x
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = z

      // Store base positions
      basePositions[i * 3] = x
      basePositions[i * 3 + 1] = y
      basePositions[i * 3 + 2] = z

      // Random velocity and phase for swaying motion
      velocities[i] = settings.speed * (0.5 + Math.random() * 0.5)
      phases[i] = Math.random() * Math.PI * 2
      swayAmplitudes[i] = 0.015 + Math.random() * 0.025

      // Random rotation speed for circular motion
      rotationSpeeds[i] = 0.15 + Math.random() * 0.25
    }

    return { positions, basePositions, velocities, phases, swayAmplitudes, rotationSpeeds }
  }, [count, settings])

  // Animate particles
  useFrame((state) => {
    if (!pointsRef.current) return

    const positions = pointsRef.current.geometry.attributes.position.array as Float32Array
    const time = state.clock.elapsedTime

    for (let i = 0; i < count; i++) {
      // Update base Y position (falling - slower)
      particles.basePositions[i * 3 + 1] -= particles.velocities[i]

      // Circular swaying motion as offset from base position
      const angle = time * particles.rotationSpeeds[i] + particles.phases[i]
      const swayX = Math.sin(angle) * particles.swayAmplitudes[i]
      const swayZ = Math.cos(angle) * particles.swayAmplitudes[i]

      // Apply position = base + sway offset
      positions[i * 3] = particles.basePositions[i * 3] + swayX
      positions[i * 3 + 1] = particles.basePositions[i * 3 + 1]
      positions[i * 3 + 2] = particles.basePositions[i * 3 + 2] + swayZ

      // Reset when below threshold
      if (particles.basePositions[i * 3 + 1] < -settings.spread / 2) {
        particles.basePositions[i * 3] = (Math.random() - 0.5) * settings.spread
        particles.basePositions[i * 3 + 1] = settings.spread / 2 + Math.random() * 2
        particles.basePositions[i * 3 + 2] = (Math.random() - 0.5) * settings.spread
      }
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={particles.positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        map={texture}
        size={settings.size}
        color="#ffffff"
        transparent
        opacity={0.9}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

export default SnowParticles
