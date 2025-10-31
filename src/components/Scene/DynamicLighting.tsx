import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface DynamicLightingProps {
  targetAmbient: number
  targetDirectional: number
}

function DynamicLighting({ targetAmbient, targetDirectional }: DynamicLightingProps) {
  const ambientRef = useRef<THREE.AmbientLight>(null)
  const directionalRef = useRef<THREE.DirectionalLight>(null)
  const ambientTarget = useRef(targetAmbient)
  const directionalTarget = useRef(targetDirectional)
  const hasInitialized = useRef(false)
  const [initialAmbient] = useState(targetAmbient)
  const [initialDirectional] = useState(targetDirectional)

  useEffect(() => {
    ambientTarget.current = targetAmbient
  }, [targetAmbient])

  useEffect(() => {
    directionalTarget.current = targetDirectional
  }, [targetDirectional])

  // Smooth transition using lerp
  useFrame(() => {
    const ambient = ambientRef.current
    const directional = directionalRef.current
    if (!ambient || !directional) {
      return
    }

    if (!hasInitialized.current) {
      ambient.intensity = ambientTarget.current
      directional.intensity = directionalTarget.current
      hasInitialized.current = true
      return
    }

    ambient.intensity = THREE.MathUtils.lerp(ambient.intensity, ambientTarget.current, 0.08)
    directional.intensity = THREE.MathUtils.lerp(
      directional.intensity,
      directionalTarget.current,
      0.08
    )
  })

  return (
    <>
      <ambientLight ref={ambientRef} intensity={initialAmbient} />
      <directionalLight ref={directionalRef} position={[10, 10, 5]} intensity={initialDirectional} />
    </>
  )
}

export default DynamicLighting
