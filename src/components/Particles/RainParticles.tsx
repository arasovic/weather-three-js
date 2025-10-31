import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

const UINT32_MAX = 0xffffffff
const advanceSeed = (seed: number) => ((seed * 1664525 + 1013904223) >>> 0) >>> 0
const toUnit = (seed: number) => seed / UINT32_MAX

type RainParticleSettings = {
  speed: number
  length: number
  spread: number
  angle: number
}

type RainParticleData = {
  positions: Float32Array
  velocities: Float32Array
  angles: Float32Array
  seeds: Uint32Array
}

const createRainParticles = (
  count: number,
  settings: RainParticleSettings,
  seedOffset: number
): RainParticleData => {
  const positions = new Float32Array(count * 6)
  const velocities = new Float32Array(count)
  const angles = new Float32Array(count)
  const seeds = new Uint32Array(count)

  for (let i = 0; i < count; i++) {
    let seed = (seedOffset + i * 7919 + 1) >>> 0
    const idx = i * 6

    seed = advanceSeed(seed)
    const x = (toUnit(seed) - 0.5) * settings.spread
    seed = advanceSeed(seed)
    const y = toUnit(seed) * settings.spread - settings.spread / 2
    seed = advanceSeed(seed)
    const z = (toUnit(seed) - 0.5) * settings.spread

    positions[idx] = x
    positions[idx + 1] = y
    positions[idx + 2] = z
    positions[idx + 3] = x
    positions[idx + 4] = y - settings.length
    positions[idx + 5] = z

    seed = advanceSeed(seed)
    velocities[i] = settings.speed * (0.7 + toUnit(seed) * 0.6)
    seed = advanceSeed(seed)
    angles[i] = settings.angle * (toUnit(seed) - 0.5)

    seeds[i] = seed
  }

  return { positions, velocities, angles, seeds }
}

interface RainParticlesProps {
  count?: number
  intensity?: 'light' | 'moderate' | 'heavy'
  opacity?: number
  focusPosition?: [number, number, number] | null
}

function RainParticles({
  count = 1000,
  intensity = 'moderate',
  opacity = 0.4,
  focusPosition = null,
}: RainParticlesProps) {
  const { camera } = useThree()
  const linesRef = useRef<THREE.LineSegments>(null)
  const focusVector = useRef(new THREE.Vector3())
  const lodRef = useRef(1)
  const activeCountRef = useRef(count)

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
  const particleDataRef = useRef<RainParticleData>(particleData)

  useEffect(() => {
    particleDataRef.current = particleData
  }, [particleData])

  useEffect(() => {
    const lines = linesRef.current
    if (!lines) return

    lines.geometry.setDrawRange(0, count * 2)
    activeCountRef.current = count
    lodRef.current = 1
  }, [count, intensity])

  useFrame((_, delta) => {
  const lines = linesRef.current
  if (!lines) return

    const positionAttr = lines.geometry.attributes.position
  if (!positionAttr) return

  const positions = positionAttr.array as Float32Array
    const data = particleDataRef.current

    if (focusPosition) {
      focusVector.current.set(focusPosition[0], focusPosition[1], focusPosition[2])
    } else {
      focusVector.current.copy(camera.position)
    }

  lines.position.set(focusVector.current.x, focusVector.current.y, focusVector.current.z)

    const distance = camera.position.distanceTo(focusVector.current)
    const targetLod = focusPosition ? THREE.MathUtils.clamp(1 - distance / 120, 0.3, 1) : 1
    lodRef.current += (targetLod - lodRef.current) * 0.08

    const activeCount = Math.max(1, Math.min(count, Math.floor(count * lodRef.current)))
    if (activeCount !== activeCountRef.current) {
      lines.geometry.setDrawRange(0, activeCount * 2)
      activeCountRef.current = activeCount
    }

    const fallMultiplier = delta > 0 ? delta * 60 : 1

    for (let i = 0; i < activeCount; i++) {
      const idx = i * 6

      const fallDistance = data.velocities[i] * fallMultiplier
      positions[idx + 1] -= fallDistance
      positions[idx + 4] -= fallDistance

      const drift = data.angles[i] * 0.3 * fallMultiplier
      positions[idx] += drift
      positions[idx + 3] += drift
      positions[idx + 2] += drift * 0.2
      positions[idx + 5] += drift * 0.2

      if (positions[idx + 1] < -settings.spread / 2) {
        let seed = advanceSeed(data.seeds[i])
  const x = (toUnit(seed) - 0.5) * settings.spread
        seed = advanceSeed(seed)
  const z = (toUnit(seed) - 0.5) * settings.spread
        seed = advanceSeed(seed)
        const speedMultiplier = 0.7 + toUnit(seed) * 0.6
        data.velocities[i] = settings.speed * speedMultiplier
        seed = advanceSeed(seed)
        data.angles[i] = settings.angle * (toUnit(seed) - 0.5)
        data.seeds[i] = seed

        const yTop = settings.spread / 2
        positions[idx] = x
        positions[idx + 1] = yTop
        positions[idx + 2] = z
        positions[idx + 3] = x
        positions[idx + 4] = yTop - settings.length
        positions[idx + 5] = z
      }
    }

    positionAttr.needsUpdate = true
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
