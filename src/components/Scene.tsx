import { startTransition, useEffect, useMemo, useRef, useState } from 'react'
import type { MutableRefObject } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Stars } from '@react-three/drei'
import * as THREE from 'three'
import Earth from './Globe/Earth'
import LocationMarker from './Globe/LocationMarker'
import CameraController from './Globe/CameraController'
import RainParticles from './Particles/RainParticles'
import SnowParticles from './Particles/SnowParticles'
import DynamicLighting from './Scene/DynamicLighting'
import LightningFlash from './Scene/LightningFlash'
import { calculateDayNight } from '../utils/dayNightCalculator'
import { latLonToCartesian } from '../utils/coordinates'
import useSmoothValue from '../hooks/useSmoothValue'

interface SceneProps {
  weatherLocation?: { lat: number; lon: number } | null
  focusLocation?: { lat: number; lon: number } | null
  weatherCondition?: string | null
  sunrise?: number
  sunset?: number
  controlsLocked?: boolean
  onCameraAnimationComplete?: () => void
}

type GlobeConfig = {
  radius: number
  orbitMin: number
  orbitMax: number
  zoomDistance: number
}

const defaultGlobeConfig: GlobeConfig = {
  radius: 1,
  orbitMin: 2.1,
  orbitMax: 3.8,
  zoomDistance: 0.5,
}

const computeGlobeConfig = (width: number): GlobeConfig => {
  if (width < 420) {
    return { radius: 1, orbitMin: 2.1, orbitMax: 3.8, zoomDistance: 0.5 }
  }
  if (width < 640) {
    return { radius: 1.15, orbitMin: 2.25, orbitMax: 4.1, zoomDistance: 0.6 }
  }
  if (width < 768) {
    return { radius: 1.3, orbitMin: 2.4, orbitMax: 4.5, zoomDistance: 0.7 }
  }
  if (width < 1024) {
    return { radius: 1.4, orbitMin: 2.6, orbitMax: 5, zoomDistance: 0.75 }
  }
  if (width < 1440) {
    return { radius: 1.5, orbitMin: 3, orbitMax: 5.5, zoomDistance: 0.8 }
  }
  return { radius: 1.65, orbitMin: 3.2, orbitMax: 6.2, zoomDistance: 0.9 }
}

function Scene({
  weatherLocation = null,
  focusLocation = null,
  weatherCondition,
  sunrise,
  sunset,
  controlsLocked = false,
  onCameraAnimationComplete,
}: SceneProps) {
  const globeRotationRef = useRef(0)
  const [displayWeather, setDisplayWeather] = useState<string | null>(null)
  const [targetEffectOpacity, setTargetEffectOpacity] = useState(0)
  const effectOpacity = useSmoothValue(targetEffectOpacity, {
    damping: 0.03,
    precision: 0.0005,
    initialValue: 0,
  })
  const [globeConfig, setGlobeConfig] = useState<GlobeConfig>(() =>
    typeof window === 'undefined' ? defaultGlobeConfig : computeGlobeConfig(window.innerWidth)
  )

  useEffect(() => {
    if (!weatherCondition) {
      if (targetEffectOpacity !== 0) {
        startTransition(() => setTargetEffectOpacity(0))
      }
      return
    }

    if (!displayWeather) {
      startTransition(() => {
        setDisplayWeather(weatherCondition)
        if (targetEffectOpacity !== 1) {
          setTargetEffectOpacity(1)
        }
      })
      return
    }

    if (weatherCondition === displayWeather) {
      if (targetEffectOpacity !== 1) {
        startTransition(() => setTargetEffectOpacity(1))
      }
    } else if (targetEffectOpacity !== 0) {
      startTransition(() => setTargetEffectOpacity(0))
    }
  }, [weatherCondition, displayWeather, targetEffectOpacity])

  useEffect(() => {
    if (effectOpacity < 0.01 && weatherCondition !== displayWeather) {
      if (displayWeather !== weatherCondition) {
        startTransition(() => setDisplayWeather(weatherCondition ?? null))
      }
      if (weatherCondition && targetEffectOpacity !== 1) {
        startTransition(() => setTargetEffectOpacity(1))
      }
    }
  }, [effectOpacity, weatherCondition, displayWeather, targetEffectOpacity])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleResize = () => setGlobeConfig(computeGlobeConfig(window.innerWidth))
    handleResize()

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  // Calculate day/night and lighting intensity
  const dayNightInfo = useMemo(() => {
    if (sunrise && sunset) {
      return calculateDayNight(sunrise, sunset)
    }
    return { isNight: false, progress: 1 }
  }, [sunrise, sunset])

  // Lighting configuration based on day/night
  const lightingConfig = useMemo(() => {
    const progress = dayNightInfo.progress
    const weatherDimmer =
      displayWeather === 'thunderstorm'
        ? 0.5
        : displayWeather === 'rain' || displayWeather === 'drizzle'
          ? 0.75
          : displayWeather === 'snow'
            ? 0.85
            : 1

    const ambientIntensity = (0.2 + progress * 0.4) * weatherDimmer
    const directionalIntensity =
      (0.3 + progress * 1.2) * (displayWeather === 'thunderstorm' ? 0.6 : weatherDimmer)

    const starsOpacity = dayNightInfo.isNight
      ? displayWeather === 'thunderstorm'
        ? 0.2
        : 1
      : displayWeather === 'thunderstorm' ||
          displayWeather === 'rain' ||
          displayWeather === 'drizzle'
        ? 0.1
        : 0.3

  return { ambientIntensity, directionalIntensity, starsOpacity }
  }, [dayNightInfo, displayWeather])

  const rainVisual = useMemo(() => {
    switch (displayWeather) {
      case 'thunderstorm':
        return { count: 1200, intensity: 'heavy' as const, opacityFactor: 0.6, isActive: true }
      case 'rain':
        return { count: 800, intensity: 'moderate' as const, opacityFactor: 0.45, isActive: true }
      case 'drizzle':
        return { count: 400, intensity: 'light' as const, opacityFactor: 0.3, isActive: true }
      default:
        return { count: 0, intensity: 'light' as const, opacityFactor: 0, isActive: false }
    }
  }, [displayWeather])

  const rainFocusPosition = useMemo<[number, number, number] | null>(() => {
    const anchor = focusLocation ?? weatherLocation
    if (!anchor) {
      return null
    }

    return latLonToCartesian(anchor.lat, anchor.lon, globeConfig.radius)
  }, [focusLocation, weatherLocation, globeConfig.radius])

  const snowOpacityTarget = displayWeather === 'snow' ? 0.9 : 0
  const isThunderstorm = displayWeather === 'thunderstorm'

  const shouldRenderRain = rainVisual.isActive && effectOpacity > 0
  const thunderPower = isThunderstorm ? effectOpacity : 0

  const snowOpacity = snowOpacityTarget * effectOpacity
  const starsCount = Math.floor(2500 + lightingConfig.starsOpacity * 3500)
  const starsFactor = 2.8 + lightingConfig.starsOpacity * 2.2
  const starsFade = lightingConfig.starsOpacity < 0.45

  return (
    <Canvas camera={{ position: [0, 0, 5], fov: 45 }} gl={{ antialias: true }}>
      {/* Dynamic Lighting with smooth transitions */}
      <DynamicLighting
        targetAmbient={lightingConfig.ambientIntensity}
        targetDirectional={lightingConfig.directionalIntensity}
      />

      {/* Background stars */}
      <Stars
        radius={100}
        depth={50}
        count={starsCount}
        factor={starsFactor}
        saturation={0}
        fade={starsFade}
        speed={1}
      />

      {/* Camera controls */}
      <OrbitControls
        enabled={!controlsLocked}
        enableZoom={!controlsLocked}
        enablePan={false}
        enableDamping
        dampingFactor={0.05}
        minDistance={globeConfig.orbitMin}
        maxDistance={globeConfig.orbitMax}
        zoomSpeed={0.5}
        touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }}
        makeDefault
      />

      {/* Camera animation */}
      <CameraController
        targetLocation={focusLocation}
        radius={globeConfig.radius}
        zoomDistance={globeConfig.zoomDistance}
        controlsLocked={controlsLocked}
        globeRotationRef={globeRotationRef}
        onAnimationComplete={onCameraAnimationComplete}
      />

      <GlobeLayer
        focusLocation={focusLocation}
        globeRadius={globeConfig.radius}
        shouldRenderRain={shouldRenderRain}
        rainVisual={rainVisual}
        effectOpacity={effectOpacity}
        rainFocusPosition={rainFocusPosition}
        isThunderstorm={isThunderstorm}
        thunderPower={thunderPower}
        displayWeather={displayWeather}
        snowOpacity={snowOpacity}
        rotationRef={globeRotationRef}
      />

      {/* Post-processing effects */}
      {/*<EffectComposer>
        <Bloom intensity={0.5} luminanceThreshold={0.8} luminanceSmoothing={0.9} mipmapBlur />
        <Vignette offset={0.3} darkness={0.5} />
      </EffectComposer>*/}
    </Canvas>
  )
}

type RainVisualConfig = {
  count: number
  intensity: 'light' | 'moderate' | 'heavy'
  opacityFactor: number
  isActive: boolean
}

interface GlobeLayerProps {
  focusLocation: { lat: number; lon: number } | null
  globeRadius: number
  shouldRenderRain: boolean
  rainVisual: RainVisualConfig
  effectOpacity: number
  rainFocusPosition: [number, number, number] | null
  isThunderstorm: boolean
  thunderPower: number
  displayWeather: string | null
  snowOpacity: number
  rotationRef: MutableRefObject<number>
}

function GlobeLayer({
  focusLocation,
  globeRadius,
  shouldRenderRain,
  rainVisual,
  effectOpacity,
  rainFocusPosition,
  isThunderstorm,
  thunderPower,
  displayWeather,
  snowOpacity,
  rotationRef,
}: GlobeLayerProps) {
  const globeGroupRef = useRef<THREE.Group>(null)

  useFrame((_, delta) => {
    if (!globeGroupRef.current) {
      return
    }

    if (!focusLocation) {
      globeGroupRef.current.rotation.y += delta * 0.1
    }

    rotationRef.current = globeGroupRef.current.rotation.y
  })

  return (
    <group ref={globeGroupRef}>
      <Earth radius={globeRadius} />

      {focusLocation && (
        <LocationMarker lat={focusLocation.lat} lon={focusLocation.lon} radius={globeRadius} />
      )}

      {shouldRenderRain && (
        <RainParticles
          key={`rain-${rainVisual.count}-${rainVisual.intensity}`}
          count={rainVisual.count}
          intensity={rainVisual.intensity}
          opacity={rainVisual.opacityFactor * effectOpacity}
          focusPosition={rainFocusPosition}
        />
      )}

      {isThunderstorm && effectOpacity > 0 && (
        <>
          <LightningFlash power={thunderPower} />
        </>
      )}

      {displayWeather === 'snow' && effectOpacity > 0 && (
        <SnowParticles count={1500} intensity="moderate" opacity={snowOpacity} />
      )}
    </group>
  )
}

export default Scene
