import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { latLonToVector3, surfaceOrientationFromPosition } from '../../utils/coordinates'

interface LocationMarkerProps {
  lat: number
  lon: number
  radius?: number
}

function LocationMarker({ lat, lon, radius = 1.5 }: LocationMarkerProps) {
  const markerGroupRef = useRef<THREE.Group>(null)
  const rippleRef = useRef<THREE.Mesh>(null)

  const position = useMemo(() => latLonToVector3(lat, lon, radius), [lat, lon, radius])
  const positionArray = useMemo<[number, number, number]>(
    () => [position.x, position.y, position.z],
    [position]
  )
  const orientation = useMemo(() => surfaceOrientationFromPosition(position), [position])

  // Pulse animation
  useFrame((state) => {
    const elapsed = state.clock.elapsedTime

    if (markerGroupRef.current) {
      const scale = 1 + Math.sin(elapsed * 2.2) * 0.12
      markerGroupRef.current.scale.setScalar(scale)
    }

    if (rippleRef.current) {
      const material = rippleRef.current.material as THREE.MeshBasicMaterial
      const rippleDuration = 2.2
      const ripplePhase = (elapsed % rippleDuration) / rippleDuration

      rippleRef.current.scale.setScalar(0.4 + ripplePhase * 1.2)
      material.opacity = THREE.MathUtils.lerp(0.4, 0, ripplePhase)
    }
  })

  return (
    <group position={positionArray} quaternion={orientation}>
      <group ref={markerGroupRef}>
        {/* Pin head */}
        <mesh position={[0, 0.08, 0]}>
          <sphereGeometry args={[0.045, 32, 32]} />
          <meshStandardMaterial
            color="#ff6b6b"
            emissive="#ff2d55"
            emissiveIntensity={0.6}
            roughness={0.3}
            metalness={0.1}
          />
        </mesh>

        {/* Pin stem */}
        <mesh position={[0, -0.02, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.035, 0.18, 24]} />
          <meshStandardMaterial
            color="#f87171"
            emissive="#ff2d55"
            emissiveIntensity={0.4}
            roughness={0.25}
            metalness={0.15}
          />
        </mesh>

        {/* Floating halo */}
        <mesh position={[0, 0.11, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.06, 0.11, 48]} />
          <meshBasicMaterial
            color="#ffd4d4"
            transparent
            opacity={0.35}
            depthWrite={false}
          />
        </mesh>

        {/* Surface ripple */}
        <mesh ref={rippleRef} position={[0, -0.001, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.07, 0.12, 64]} />
          <meshBasicMaterial color="#ff6b6b" transparent opacity={0.35} depthWrite={false} />
        </mesh>
      </group>

      {/* Local glow */}
      <pointLight position={[0, 0.2, 0]} intensity={1.2} distance={0.8} color="#ff6b6b" />
    </group>
  )
}

export default LocationMarker
