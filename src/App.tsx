import { Suspense, useState, useEffect, useMemo, useCallback, useRef } from 'react'
import Scene from './components/Scene'
import SearchBar from './components/UI/SearchBar'
import WeatherInfo from './components/UI/WeatherInfo'
import LocationQuickAccess from './components/UI/LocationQuickAccess.tsx'

const HISTORY_STORAGE_KEY = 'weather-three-history'
const FAVORITES_STORAGE_KEY = 'weather-three-favorites'
import { useGeolocation } from './hooks/useGeolocation'
import { useWeather } from './hooks/useWeather'
import type { Location } from './types/weather'

function App() {
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null)
  const [locationHistory, setLocationHistory] = useState<Location[]>([])
  const [favoriteLocations, setFavoriteLocations] = useState<Location[]>([])
  const geolocation = useGeolocation()
  const { weather, forecast, loading, error } = useWeather(
    selectedLocation?.lat ?? geolocation.lat,
    selectedLocation?.lon ?? geolocation.lon
  )

  const hasLoadedStorage = useRef(false)
  const getLocationKey = useCallback((location: Location) => `${location.lat}:${location.lon}`, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      const storedHistory = window.localStorage.getItem(HISTORY_STORAGE_KEY)
      const storedFavorites = window.localStorage.getItem(FAVORITES_STORAGE_KEY)

      if (storedHistory) {
        setLocationHistory(JSON.parse(storedHistory) as Location[])
      }

      if (storedFavorites) {
        setFavoriteLocations(JSON.parse(storedFavorites) as Location[])
      }
    } catch (storageError) {
      console.warn('Failed to read stored locations', storageError)
    } finally {
      hasLoadedStorage.current = true
    }
  }, [])

  useEffect(() => {
    if (!hasLoadedStorage.current || typeof window === 'undefined') return
    try {
      window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(locationHistory))
    } catch (storageError) {
      console.warn('Failed to persist location history', storageError)
    }
  }, [locationHistory])

  useEffect(() => {
    if (!hasLoadedStorage.current || typeof window === 'undefined') return
    try {
      window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favoriteLocations))
    } catch (storageError) {
      console.warn('Failed to persist favorite locations', storageError)
    }
  }, [favoriteLocations])

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

  const handleToggleFavorite = useCallback(
    (location: Location) => {
      setFavoriteLocations((prev) => {
        const exists = prev.some((entry) => getLocationKey(entry) === getLocationKey(location))
        if (exists) {
          return prev.filter((entry) => getLocationKey(entry) !== getLocationKey(location))
        }
        return [location, ...prev].slice(0, 10)
      })

      setLocationHistory((prev) => {
        const withoutDuplicate = prev.filter(
          (entry) => getLocationKey(entry) !== getLocationKey(location)
        )
        return [location, ...withoutDuplicate].slice(0, 8)
      })
    },
    [getLocationKey]
  )

  const isFavoriteLocation = useCallback(
    (location: Location | null | undefined) => {
      if (!location) return false
      return favoriteLocations.some((entry) => getLocationKey(entry) === getLocationKey(location))
    },
    [favoriteLocations, getLocationKey]
  )

  const quickAccessHistory = useMemo(() => {
    const favoriteKeys = new Set(favoriteLocations.map((location) => getLocationKey(location)))
    return locationHistory.filter((location) => !favoriteKeys.has(getLocationKey(location)))
  }, [favoriteLocations, locationHistory, getLocationKey])

  const handleLocationSelect = useCallback(
    (location: Location) => {
      setSelectedLocation(location)

      setLocationHistory((prev) => {
        const existing = prev.filter((entry) => getLocationKey(entry) !== getLocationKey(location))
        const updated = [location, ...existing]
        return updated.slice(0, 8)
      })
    },
    [getLocationKey]
  )

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

      <div className="absolute inset-0 pointer-events-none">
        <div className="flex h-full flex-col">
          <div className="pointer-events-auto px-4 pt-6 sm:px-6">
            <SearchBar
              onLocationSelect={handleLocationSelect}
              history={quickAccessHistory}
              favorites={favoriteLocations}
              onToggleFavorite={handleToggleFavorite}
            />
          </div>

          <div className="mt-auto flex flex-col gap-4 px-4 pb-6 sm:pb-8 sm:px-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="pointer-events-auto w-full sm:w-auto sm:max-w-xs">
              <LocationQuickAccess
                favorites={favoriteLocations}
                history={quickAccessHistory}
                onSelect={handleLocationSelect}
                onToggleFavorite={handleToggleFavorite}
              />
            </div>

            <div className="flex w-full flex-col gap-4 sm:w-auto sm:max-w-md sm:items-end">
              {loading && (
                <div className="pointer-events-auto bg-black/50 backdrop-blur-md border border-white/20 rounded-lg p-6 text-white w-full sm:w-auto">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Loading weather data...</span>
                  </div>
                </div>
              )}

              {error && (
                <div className="pointer-events-auto bg-red-500/20 backdrop-blur-md border border-red-500/50 rounded-lg p-6 text-white w-full sm:w-auto">
                  <div className="font-semibold mb-2">Error</div>
                  <div className="text-sm">{error}</div>
                </div>
              )}

              {!loading && !error && weather && selectedLocation && (
                <div className="pointer-events-auto w-full">
                  <WeatherInfo
                    location={selectedLocation}
                    weather={weather}
                    forecast={forecast}
                    isFavorite={isFavoriteLocation(selectedLocation)}
                    onToggleFavorite={handleToggleFavorite}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
