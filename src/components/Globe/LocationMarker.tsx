import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface LocationMarkerProps {
  lat: number
  lon: number
  radius?: number
}

function LocationMarker({ lat, lon, radius = 1.5 }: LocationMarkerProps) {
  const markerRef = useRef<THREE.Mesh>(null)

  // Convert lat/lon to 3D coordinates on sphere
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lon + 180) * (Math.PI / 180)

  const x = -(radius * Math.sin(phi) * Math.cos(theta))
  const y = radius * Math.cos(phi)
  const z = radius * Math.sin(phi) * Math.sin(theta)

  // Pulse animation
  useFrame((state) => {
    if (markerRef.current) {
      const scale = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.2
      markerRef.current.scale.setScalar(scale)
    }
  })

  return (
    <group>
      {/* Marker pin */}
      <mesh ref={markerRef} position={[x, y, z]}>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshBasicMaterial color="#ff3b3b" />
      </mesh>

      {/* Glow ring */}
      <mesh position={[x, y, z]}>
        <ringGeometry args={[0.06, 0.1, 32]} />
        <meshBasicMaterial color="#ff3b3b" transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>

      {/* Light at location */}
      <pointLight position={[x, y, z]} intensity={1} distance={0.5} color="#ff3b3b" />
    </group>
  )
}

export default LocationMarker
