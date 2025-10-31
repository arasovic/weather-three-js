import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface StormCloudsProps {
  lat: number
  lon: number
  radius: number
  opacity: number
}

const spinAxis = new THREE.Vector3(0, 1, 0)
const pseudoRandom = (seed: number) => {
  const x = Math.sin(seed) * 43758.5453
  return x - Math.floor(x)
}

function StormClouds({ lat, lon, radius, opacity }: StormCloudsProps) {
  const groupRef = useRef<THREE.Group>(null)

  const cloudData = useMemo(() => {
    const phi = (90 - lat) * (Math.PI / 180)
    const theta = (lon + 180) * (Math.PI / 180)

    const base = new THREE.Vector3(
      -(Math.sin(phi) * Math.cos(theta)),
      Math.cos(phi),
      Math.sin(phi) * Math.sin(theta)
    ).normalize()

    const groupPosition = base.clone().multiplyScalar(radius * 1.08)
    const orientation = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      base
    )

    const seedBase = Math.floor((lat + 90) * 1000) * 17 + Math.floor((lon + 180) * 1000)

    const cloudInstances = Array.from({ length: 6 }, (_, index) => {
      const angle = (index / 6) * Math.PI * 2
      const radialDistance = 0.35 + pseudoRandom(seedBase + index * 7 + 1) * 0.18
      const heightOffset = (pseudoRandom(seedBase + index * 7 + 2) - 0.5) * 0.18

      return {
        position: [
          Math.cos(angle) * radialDistance,
          heightOffset,
          Math.sin(angle) * radialDistance * 0.85,
        ] as [number, number, number],
        scale: 0.45 + pseudoRandom(seedBase + index * 7 + 3) * 0.25,
      }
    })

    return {
      groupPosition: groupPosition.toArray() as [number, number, number],
      orientation,
      cloudInstances,
    }
  }, [lat, lon, radius])

  useEffect(() => {
    if (!groupRef.current) {
      return
    }

    groupRef.current.position.set(...cloudData.groupPosition)
    groupRef.current.quaternion.copy(cloudData.orientation)
  }, [cloudData])

  useFrame((_, delta) => {
    if (!groupRef.current) {
      return
    }

    groupRef.current.rotateOnAxis(spinAxis, delta * 0.18)
  })

  return (
    <group ref={groupRef}>
      {cloudData.cloudInstances.map((cloud, index) => (
        <mesh key={index} position={cloud.position} scale={cloud.scale} castShadow={false}
>          <sphereGeometry args={[0.45, 24, 24]} />
          <meshStandardMaterial
            color="#1a1d24"
            transparent
            opacity={Math.min(0.8, opacity * 0.85)}
            roughness={1}
            metalness={0}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  )
}

export default StormClouds
