import { useCallback, useEffect, useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

type OrbitControlsLike = {
  enabled: boolean
  target: THREE.Vector3
  update: () => void
}

interface CameraControllerProps {
  targetLocation: { lat: number; lon: number } | null
  radius?: number
  zoomDistance?: number
  controlsLocked?: boolean
}

// Easing function for smooth animation
const easeInOutCubic = (t: number): number => {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

function CameraController({
  targetLocation,
  radius = 1.5,
  zoomDistance = 4,
  controlsLocked = false,
}: CameraControllerProps) {
  const { camera, controls } = useThree()
  const controlsRef = useRef<OrbitControlsLike | null>(null)
  const targetPosition = useRef(new THREE.Vector3())
  const targetLookAt = useRef(new THREE.Vector3())
  const startPosition = useRef(new THREE.Vector3())
  const startLookAt = useRef(new THREE.Vector3())
  const animationProgress = useRef(0)
  const isAnimating = useRef(false)
  const previousCameraPosition = useRef(new THREE.Vector3())
  const previousLookAt = useRef(new THREE.Vector3())
  const hasPreviousView = useRef(false)
  const prevControlsLocked = useRef(controlsLocked)

  const startAnimation = useCallback(
    (destinationPosition: THREE.Vector3, destinationLookAt: THREE.Vector3) => {
    const orbitControls = controlsRef.current
    if (!orbitControls) return

    targetPosition.current.copy(destinationPosition)
    targetLookAt.current.copy(destinationLookAt)
    startPosition.current.copy(camera.position)
    startLookAt.current.copy(orbitControls.target)
    animationProgress.current = 0
    isAnimating.current = true
    orbitControls.enabled = false
    },
    [camera]
  )

  useEffect(() => {
    controlsRef.current = (controls as OrbitControlsLike | null) ?? null
    const orbitControls = controlsRef.current

    if (orbitControls && !hasPreviousView.current) {
      previousCameraPosition.current.copy(camera.position)
      previousLookAt.current.copy(orbitControls.target)
    }
  }, [controls, camera])

  useEffect(() => {
    const orbitControls = controlsRef.current
    if (!orbitControls) {
      prevControlsLocked.current = controlsLocked
      return
    }

    if (!prevControlsLocked.current && controlsLocked) {
      previousCameraPosition.current.copy(camera.position)
      previousLookAt.current.copy(orbitControls.target)
      hasPreviousView.current = true
    } else if (prevControlsLocked.current && !controlsLocked && hasPreviousView.current) {
      startAnimation(previousCameraPosition.current, previousLookAt.current)
    }

    prevControlsLocked.current = controlsLocked
  }, [controlsLocked, camera, startAnimation])

  useEffect(() => {
    const orbitControls = controlsRef.current

    if (!controlsLocked || !targetLocation || !orbitControls) {
      return
    }

    if (targetLocation && orbitControls) {
      // Convert lat/lon to 3D coordinates
      const phi = (90 - targetLocation.lat) * (Math.PI / 180)
      const theta = (targetLocation.lon + 180) * (Math.PI / 180)

      // Point on sphere surface
      const x = -(radius * Math.sin(phi) * Math.cos(theta))
      const y = radius * Math.cos(phi)
      const z = radius * Math.sin(phi) * Math.sin(theta)

      // Calculate camera position: target point + offset in direction from center
      const direction = new THREE.Vector3(x, y, z).normalize()
      const cameraOffset = direction.multiplyScalar(zoomDistance)
      const lookAt = new THREE.Vector3(x, y, z)

      startAnimation(cameraOffset, lookAt)
    }
  }, [targetLocation, radius, zoomDistance, controlsLocked, camera, startAnimation])

  useFrame((_, delta) => {
    const orbitControls = controlsRef.current

    if (isAnimating.current && orbitControls) {
      // Increment progress (adjust speed here - lower = slower/smoother)
      animationProgress.current += delta * 0.8

      if (animationProgress.current >= 1) {
        animationProgress.current = 1
        isAnimating.current = false

        // Re-enable controls after animation
        orbitControls.enabled = !controlsLocked
      }

      // Apply easing
      const t = easeInOutCubic(Math.min(animationProgress.current, 1))

      // Interpolate camera position
      camera.position.lerpVectors(startPosition.current, targetPosition.current, t)

      // Interpolate controls target
      const currentLookAt = new THREE.Vector3()
      currentLookAt.lerpVectors(startLookAt.current, targetLookAt.current, t)

      orbitControls.target.copy(currentLookAt)
      // Update controls to apply the new target
      orbitControls.update()
    }
  })

  useEffect(() => {
    const orbitControls = controlsRef.current

    if (!orbitControls || isAnimating.current) {
      return
    }

    orbitControls.enabled = !controlsLocked
  }, [controlsLocked])

  return null
}

export default CameraController
