import { Suspense, useState, useEffect } from 'react'
import Scene from './components/Scene'
import SearchBar from './components/UI/SearchBar'
import WeatherInfo from './components/UI/WeatherInfo'
import { useGeolocation } from './hooks/useGeolocation'
import { useWeather } from './hooks/useWeather'
import type { Location } from './types/weather'

function App() {
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null)
  const geolocation = useGeolocation()
  const { weather, forecast, loading, error } = useWeather(
    selectedLocation?.lat ?? geolocation.lat,
    selectedLocation?.lon ?? geolocation.lon
  )

  const activeLocation = selectedLocation
    ? { lat: selectedLocation.lat, lon: selectedLocation.lon }
    : geolocation.lat && geolocation.lon
      ? { lat: geolocation.lat, lon: geolocation.lon }
      : null

  // Use geolocation as default location when available
  useEffect(() => {
    if (geolocation.lat && geolocation.lon && !selectedLocation) {
      // Create a temporary location object for initial geolocation
      // The actual location name will be set when user searches
    }
  }, [geolocation.lat, geolocation.lon, selectedLocation])

  const handleLocationSelect = (location: Location) => {
    setSelectedLocation(location)
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !selectedLocation) {
        return
      }

      const target = event.target as HTMLElement | null
      if (target && (/input|textarea|select/i).test(target.tagName)) {
        return
      }

      setSelectedLocation(null)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedLocation])

  return (
    <div className="w-screen h-screen bg-black relative overflow-hidden">
      {/* 3D Scene */}
      <Suspense
        fallback={
          <div className="w-full h-full flex items-center justify-center text-white text-2xl">
            Loading 3D Scene...
          </div>
        }
      >
        <Scene
          selectedLocation={activeLocation}
          weatherCondition={weather?.condition}
          sunrise={weather?.sunrise}
          sunset={weather?.sunset}
          controlsLocked={Boolean(selectedLocation)}
        />
      </Suspense>

      {/* UI Overlay */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="container mx-auto h-full flex flex-col p-6">
          {/* Top: Search Bar */}
          <div className="pointer-events-auto w-fit">
            <SearchBar onLocationSelect={handleLocationSelect} />
          </div>

          {/* Bottom Right: Weather Info */}
          <div className="flex-1 flex items-end justify-end">
            {loading && (
              <div className="pointer-events-auto bg-black/50 backdrop-blur-md border border-white/20 rounded-lg p-6 text-white">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Loading weather data...</span>
                </div>
              </div>
            )}

            {error && (
              <div className="pointer-events-auto bg-red-500/20 backdrop-blur-md border border-red-500/50 rounded-lg p-6 text-white max-w-md">
                <div className="font-semibold mb-2">Error</div>
                <div className="text-sm">{error}</div>
              </div>
            )}

            {!loading && !error && weather && selectedLocation && (
              <div className="pointer-events-auto">
                <WeatherInfo location={selectedLocation} weather={weather} forecast={forecast} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
