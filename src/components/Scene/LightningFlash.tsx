import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard } from '@react-three/drei'
import * as THREE from 'three'

interface LightningFlashProps {
  power?: number
}

const randomBetween = (min: number, max: number) => min + Math.random() * (max - min)

function LightningFlash({ power = 1 }: LightningFlashProps) {
  const lightRef = useRef<THREE.PointLight>(null)
  const overlayMaterialRef = useRef<THREE.MeshBasicMaterial>(null)
  const flashStrength = useRef(0)
  const timerRef = useRef(randomBetween(1.5, 4))

  useFrame((_, delta) => {
    const clampedPower = Math.max(0, Math.min(1, power))

    timerRef.current -= delta * (0.6 + clampedPower * 1.4)

    if (timerRef.current <= 0 && clampedPower > 0.05) {
      flashStrength.current = randomBetween(4, 7)
      timerRef.current = randomBetween(2.5, 5) / (0.4 + clampedPower)
    }

    flashStrength.current = Math.max(flashStrength.current - delta * 6, 0)
    const currentIntensity = flashStrength.current * clampedPower

    if (lightRef.current) {
      lightRef.current.intensity = currentIntensity
      lightRef.current.distance = 20
    }

    if (overlayMaterialRef.current) {
      overlayMaterialRef.current.opacity = Math.min(currentIntensity / 8, 0.45 * clampedPower)
    }
  })

  return (
    <>
      <pointLight
        ref={lightRef}
        position={[0, 5, 3]}
        color="#d6f0ff"
        intensity={0}
        decay={2}
        castShadow={false}
      />
      <Billboard position={[0, 0, 0]} follow>
        <mesh renderOrder={10}>
          <planeGeometry args={[12, 12]} />
          <meshBasicMaterial
            ref={overlayMaterialRef}
            color="#e6f7ff"
            transparent
            opacity={0}
            depthWrite={false}
            depthTest={false}
          />
        </mesh>
      </Billboard>
    </>
  )
}

export default LightningFlash
