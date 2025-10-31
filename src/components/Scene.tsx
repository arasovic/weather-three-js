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
    const config = {
      ambientIntensity: 0.2 + progress * 0.4, // 0.2-0.6 (gece daha karanlık)
      directionalIntensity: 0.3 + progress * 1.2, // 0.3-1.5 (gündüz çok daha parlak)
      starsOpacity: dayNightInfo.isNight ? 1 : 0.3,
    }
    console.log('Lighting Config:', config)
    return config
  }, [dayNightInfo])

  const showWeatherEffect = Boolean(displayWeather)

  return (
    <Canvas camera={{ position: [0, 0, 5], fov: 45 }} gl={{ antialias: true }}>
      {/* Dynamic Lighting with smooth transitions */}
      <DynamicLighting
        targetAmbient={lightingConfig.ambientIntensity}
        targetDirectional={lightingConfig.directionalIntensity}
      />

      {/* Background stars */}
      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />

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

      {/* Weather particles */}
      {showWeatherEffect && displayWeather === 'rain' && effectOpacity > 0 && (
        <RainParticles count={800} intensity="moderate" opacity={0.4 * effectOpacity} />
      )}
      {showWeatherEffect && displayWeather === 'drizzle' && effectOpacity > 0 && (
        <RainParticles count={400} intensity="light" opacity={0.35 * effectOpacity} />
      )}
      {showWeatherEffect && displayWeather === 'snow' && effectOpacity > 0 && (
        <SnowParticles count={1500} intensity="moderate" opacity={0.9 * effectOpacity} />
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
