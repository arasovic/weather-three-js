import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface SnowParticlesProps {
  count?: number
  intensity?: 'light' | 'moderate' | 'heavy'
  opacity?: number
}

const pseudoRandom = (seed: number) => {
  const x = Math.sin(seed) * 43758.5453
  return x - Math.floor(x)
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

function SnowParticles({ count = 800, intensity = 'moderate', opacity = 0.9 }: SnowParticlesProps) {
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
      const baseSeed = i * 11 + 5
      // Random position in a box around the globe
      const x = (pseudoRandom(baseSeed) - 0.5) * settings.spread
      const y = pseudoRandom(baseSeed + 1) * settings.spread - settings.spread / 2
      const z = (pseudoRandom(baseSeed + 2) - 0.5) * settings.spread

      positions[i * 3] = x
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = z

      // Store base positions
      basePositions[i * 3] = x
      basePositions[i * 3 + 1] = y
      basePositions[i * 3 + 2] = z

      // Random velocity and phase for swaying motion
      velocities[i] = settings.speed * (0.5 + pseudoRandom(baseSeed + 3) * 0.5)
      phases[i] = pseudoRandom(baseSeed + 4) * Math.PI * 2
      swayAmplitudes[i] = 0.015 + pseudoRandom(baseSeed + 5) * 0.025

      // Random rotation speed for circular motion
      rotationSpeeds[i] = 0.15 + pseudoRandom(baseSeed + 6) * 0.25
    }

    return { positions, basePositions, velocities, phases, swayAmplitudes, rotationSpeeds }
  }, [count, settings])

  const particlesRef = useRef(particles)

  useEffect(() => {
    particlesRef.current = particles
  }, [particles])

  // Animate particles
  useFrame((state) => {
    const points = pointsRef.current
    const data = particlesRef.current
    if (!points || !data) return

    const positions = points.geometry.attributes.position.array as Float32Array
    const time = state.clock.elapsedTime

    for (let i = 0; i < count; i++) {
      // Update base Y position (falling - slower)
      data.basePositions[i * 3 + 1] -= data.velocities[i]

      // Circular swaying motion as offset from base position
      const angle = time * data.rotationSpeeds[i] + data.phases[i]
      const swayX = Math.sin(angle) * data.swayAmplitudes[i]
      const swayZ = Math.cos(angle) * data.swayAmplitudes[i]

      // Apply position = base + sway offset
      positions[i * 3] = data.basePositions[i * 3] + swayX
      positions[i * 3 + 1] = data.basePositions[i * 3 + 1]
      positions[i * 3 + 2] = data.basePositions[i * 3 + 2] + swayZ

      // Reset when below threshold
      if (data.basePositions[i * 3 + 1] < -settings.spread / 2) {
        data.basePositions[i * 3] = (Math.random() - 0.5) * settings.spread
        data.basePositions[i * 3 + 1] = settings.spread / 2 + Math.random() * 2
        data.basePositions[i * 3 + 2] = (Math.random() - 0.5) * settings.spread
      }
    }

    points.geometry.attributes.position.needsUpdate = true
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[particles.positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        map={texture}
        size={settings.size}
        color="#ffffff"
        transparent
        opacity={opacity}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

export default SnowParticles
