import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Sphere } from '@react-three/drei'
import * as THREE from 'three'

interface EarthProps {
  radius?: number
  rotate?: boolean
}

function Earth({ radius = 1, rotate = true }: EarthProps) {
  const groupRef = useRef<THREE.Group>(null)

  // Slow rotation animation (only if not paused)
  useFrame((_state, delta) => {
    if (groupRef.current && rotate) {
      groupRef.current.rotation.y += delta * 0.1
    }
  })

  return (
    <group ref={groupRef}>
      {/* Main Earth sphere */}
      <Sphere args={[radius, 64, 64]}>
        <meshStandardMaterial color="#1e3a8a" roughness={0.7} metalness={0.2} />
      </Sphere>

      {/* Atmosphere glow */}
      <Sphere args={[radius * 1.01, 64, 64]}>
        <meshBasicMaterial color="#4a9eff" transparent opacity={0.1} side={THREE.BackSide} />
      </Sphere>
    </group>
  )
}

export default Earth
