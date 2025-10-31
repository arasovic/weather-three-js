import { startTransition, useEffect, useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Stars } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import Earth from './Globe/Earth'
import LocationMarker from './Globe/LocationMarker'
import CameraController from './Globe/CameraController'
import RainParticles from './Particles/RainParticles'
import SnowParticles from './Particles/SnowParticles'
import DynamicLighting from './Scene/DynamicLighting'
import LightningFlash from './Scene/LightningFlash'
import StormClouds from './Scene/StormClouds'
import { calculateDayNight } from '../utils/dayNightCalculator'
import useSmoothValue from '../hooks/useSmoothValue'

interface SceneProps {
  selectedLocation?: { lat: number; lon: number } | null
  weatherCondition?: string | null
  sunrise?: number
  sunset?: number
  controlsLocked?: boolean
}

function Scene({
  selectedLocation = null,
  weatherCondition,
  sunrise,
  sunset,
  controlsLocked = false,
}: SceneProps) {
  const [displayWeather, setDisplayWeather] = useState<string | null>(null)
  const [targetEffectOpacity, setTargetEffectOpacity] = useState(0)
  const effectOpacity = useSmoothValue(targetEffectOpacity, {
    damping: 0.03,
    precision: 0.0005,
    initialValue: 0,
  })

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
  // Calculate day/night and lighting intensity
  const dayNightInfo = useMemo(() => {
    if (sunrise && sunset) {
      const info = calculateDayNight(sunrise, sunset)
      console.log('Day/Night Info:', {
        isNight: info.isNight,
        progress: info.progress,
        sunrise: new Date(sunrise).toLocaleTimeString(),
        sunset: new Date(sunset).toLocaleTimeString(),
        currentTime: new Date().toLocaleTimeString(),
      })
      return info
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
    const directionalIntensity = (0.3 + progress * 1.2) *
      (displayWeather === 'thunderstorm' ? 0.6 : weatherDimmer)

    const starsOpacity = dayNightInfo.isNight
      ? displayWeather === 'thunderstorm'
        ? 0.2
        : 1
      : displayWeather === 'thunderstorm' || displayWeather === 'rain' || displayWeather === 'drizzle'
        ? 0.1
        : 0.3

    const config = { ambientIntensity, directionalIntensity, starsOpacity }
    console.log('Lighting Config:', config)
    return config
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
    if (!selectedLocation) {
      return null
    }

    const radius = 1.5
    const phi = (90 - selectedLocation.lat) * (Math.PI / 180)
    const theta = (selectedLocation.lon + 180) * (Math.PI / 180)

    const x = -(radius * Math.sin(phi) * Math.cos(theta))
    const y = radius * Math.cos(phi)
    const z = radius * Math.sin(phi) * Math.sin(theta)

    return [x, y, z]
  }, [selectedLocation])

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
        enableZoom={false}
        enablePan={false}
        enableDamping
        dampingFactor={0.05}
        makeDefault
      />

      {/* Camera animation */}
      <CameraController
        targetLocation={selectedLocation}
        radius={1.5}
        zoomDistance={4}
        controlsLocked={controlsLocked}
      />

      {/* Earth globe */}
      <Earth radius={1.5} rotate={!selectedLocation} />

      {/* Location marker */}
      {selectedLocation && (
        <LocationMarker lat={selectedLocation.lat} lon={selectedLocation.lon} radius={1.5} />
      )}

      {/* Weather visuals */}
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
          {selectedLocation && (
            <StormClouds
              lat={selectedLocation.lat}
              lon={selectedLocation.lon}
              radius={1.5}
              opacity={Math.min(1, thunderPower)}
            />
          )}
        </>
      )}

      {displayWeather === 'snow' && effectOpacity > 0 && (
        <SnowParticles count={1500} intensity="moderate" opacity={snowOpacity} />
      )}

      {/* Post-processing effects */}
      <EffectComposer>
        <Bloom
          intensity={0.5}
          luminanceThreshold={0.8}
          luminanceSmoothing={0.9}
          mipmapBlur
        />
        <Vignette offset={0.3} darkness={0.5} />
      </EffectComposer>
    </Canvas>
  )
}

export default Scene
