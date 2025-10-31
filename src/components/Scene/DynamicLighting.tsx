import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface DynamicLightingProps {
  targetAmbient: number
  targetDirectional: number
}

function DynamicLighting({ targetAmbient, targetDirectional }: DynamicLightingProps) {
  const ambientRef = useRef<THREE.AmbientLight>(null)
  const directionalRef = useRef<THREE.DirectionalLight>(null)

  // Smooth transition using lerp
  useFrame(() => {
    if (ambientRef.current) {
      ambientRef.current.intensity = THREE.MathUtils.lerp(
        ambientRef.current.intensity,
        targetAmbient,
        0.02 // Slow smooth transition
      )
    }

    if (directionalRef.current) {
      directionalRef.current.intensity = THREE.MathUtils.lerp(
        directionalRef.current.intensity,
        targetDirectional,
        0.02
      )
    }
  })

  return (
    <>
      <ambientLight ref={ambientRef} intensity={targetAmbient} />
      <directionalLight ref={directionalRef} position={[10, 10, 5]} intensity={targetDirectional} />
    </>
  )
}

export default DynamicLighting
