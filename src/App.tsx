import { Suspense, useState, useEffect, useMemo, useCallback, useRef } from 'react'
import Scene from './components/Scene'
import SearchBar from './components/UI/SearchBar'
import WeatherInfo from './components/UI/WeatherInfo'
import LocationQuickAccess from './components/UI/LocationQuickAccess'
import { useWeather } from './hooks/useWeather'
import type { Location } from './types/weather'

const HISTORY_STORAGE_KEY = 'weather-three-history'
const FAVORITES_STORAGE_KEY = 'weather-three-favorites'

function App() {
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null)
  const [locationHistory, setLocationHistory] = useState<Location[]>([])
  const [favoriteLocations, setFavoriteLocations] = useState<Location[]>([])
  const [isCompactLayout, setIsCompactLayout] = useState(false)
  const [activeMobilePanel, setActiveMobilePanel] = useState<'none' | 'locations' | 'weather'>(
    'none'
  )
  const [isChromeWithBottomBar, setIsChromeWithBottomBar] = useState(false)
  const { weather, forecast, loading, error } = useWeather(
    selectedLocation?.lat ?? null,
    selectedLocation?.lon ?? null
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

  useEffect(() => {
    if (typeof window === 'undefined') return

    const query = window.matchMedia('(max-width: 768px)')
    const updateLayout = () => setIsCompactLayout(query.matches)
    updateLayout()

    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', updateLayout)
      return () => query.removeEventListener('change', updateLayout)
    }

    query.addListener(updateLayout)
    return () => query.removeListener(updateLayout)
  }, [])

  useEffect(() => {
    if (!isCompactLayout) {
      setActiveMobilePanel('none')
    }
  }, [isCompactLayout])

  useEffect(() => {
    if (typeof navigator === 'undefined') {
      return
    }

    const ua = navigator.userAgent
    const platform = navigator.platform

    const isIOSDevice =
      /iPad|iPhone|iPod/.test(platform) || (platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    const isAndroidDevice = /Android/i.test(ua)
    const isChromeEngine = /CriOS|Chrome\//i.test(ua)

    const isOverlayChrome =
      (isIOSDevice && /CriOS/i.test(ua)) || (isAndroidDevice && isChromeEngine && !/Edg\//i.test(ua))

    setIsChromeWithBottomBar(isOverlayChrome)
  }, [])

  const activeLocation = selectedLocation
    ? { lat: selectedLocation.lat, lon: selectedLocation.lon }
    : null

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

  const handleRemoveFavorite = useCallback(
    (location: Location) => {
      setFavoriteLocations((prev) =>
        prev.filter((entry) => getLocationKey(entry) !== getLocationKey(location))
      )
    },
    [getLocationKey]
  )

  const handleClearFavorites = useCallback(() => {
    setFavoriteLocations([])
  }, [])

  const handleClearHistory = useCallback(() => {
    setLocationHistory([])
  }, [])

  const mobileButtonContainerPaddingClass = isChromeWithBottomBar
    ? 'pb-[calc(env(safe-area-inset-bottom,0)+4.5rem)]'
    : 'pb-[max(1.25rem,calc(env(safe-area-inset-bottom,0)+1rem))]'

  const mobileButtonGroupPaddingClass = isChromeWithBottomBar
    ? 'pb-[calc(env(safe-area-inset-bottom,0)+1.5rem)]'
    : 'pb-[max(0.75rem,calc(env(safe-area-inset-bottom,0)))]'

  const mobileModalBottomOffsetClass = isChromeWithBottomBar
    ? 'bottom-[calc(env(safe-area-inset-bottom,0)+3rem)]'
    : 'bottom-[max(1.25rem,calc(env(safe-area-inset-bottom,0)+1.5rem))]'

  const mobileModalScrollHeightClass = isChromeWithBottomBar ? 'max-h-[50vh]' : 'max-h-[55vh]'

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

      if (isCompactLayout) {
        setActiveMobilePanel('none')
      }
    },
    [getLocationKey, isCompactLayout]
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
      if (isCompactLayout) {
        setActiveMobilePanel('none')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedLocation, isCompactLayout])

  const shouldShowWeatherDetails = Boolean(!loading && !error && weather && selectedLocation)
  const mobileWeatherDisabled = !selectedLocation

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black">
      <Suspense
        fallback={
          <div className="flex h-full w-full items-center justify-center text-2xl text-white">
            Loading 3D Scene...
          </div>
        }
      >
        <Scene
          weatherLocation={activeLocation}
          focusLocation={selectedLocation}
          weatherCondition={weather?.condition}
          sunrise={weather?.sunrise}
          sunset={weather?.sunset}
          controlsLocked={Boolean(selectedLocation)}
        />
      </Suspense>

  <div className="pointer-events-none absolute inset-0">
        {isCompactLayout ? (
          <div className="flex h-full flex-col">
            <div className="pointer-events-auto px-4 pt-5">
              <SearchBar
                onLocationSelect={handleLocationSelect}
                history={quickAccessHistory}
                favorites={favoriteLocations}
                onToggleFavorite={handleToggleFavorite}
              />

              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/70">
                <a
                  href="https://visibleearth.nasa.gov/collection/1484/blue-marble"
                  target="_blank"
                  rel="noreferrer"
                  className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-black/45 px-3 py-1 backdrop-blur-sm transition hover:text-white"
                >
                  Earth imagery © NASA Blue Marble
                </a>
                <a
                  href="https://arasmehmet.com"
                  target="_blank"
                  rel="noreferrer"
                  className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-black/45 px-3 py-1 backdrop-blur-sm transition hover:text-white"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                  Developed by Aras Mehmet
                </a>
              </div>
            </div>

            <div className={`pointer-events-none mt-auto px-4 ${mobileButtonContainerPaddingClass}`}>
              <div
                className={`pointer-events-auto flex justify-center gap-3 ${mobileButtonGroupPaddingClass}`}
              >
                <button
                  onClick={() =>
                    setActiveMobilePanel((prev) => (prev === 'locations' ? 'none' : 'locations'))
                  }
                  className={`flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm text-white shadow-md transition-all ${activeMobilePanel === 'locations' ? 'bg-blue-500/40 backdrop-blur-md' : 'bg-black/45 hover:bg-black/60'}`}
                >
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 3h14M5 9h14M5 15h8M5 21h4" />
                  </svg>
                  <span>Locations</span>
                </button>

                <button
                  onClick={() =>
                    setActiveMobilePanel((prev) => (prev === 'weather' ? 'none' : 'weather'))
                  }
                  disabled={mobileWeatherDisabled}
                  className={`flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm text-white shadow-md transition-all ${mobileWeatherDisabled ? 'cursor-not-allowed bg-black/35 text-gray-500' : activeMobilePanel === 'weather' ? 'bg-blue-500/40 backdrop-blur-md' : 'bg-black/45 hover:bg-black/60'}`}
                >
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 3v3M6.6 5.1l2.1 2.1M3 12h3m12-7.9l-2.1 2.1M18 12h3m-9 6v3m5.4-2.1-2.1-2.1M6.6 18.9l2.1-2.1" />
                    <circle cx="12" cy="12" r="4" />
                  </svg>
                  <span>Weather</span>
                </button>
              </div>
            </div>

            {activeMobilePanel !== 'none' && (
              <div
                className={`pointer-events-auto fixed inset-x-0 ${mobileModalBottomOffsetClass} px-4`}
              >
                <div className="rounded-2xl border border-white/15 bg-black/80 p-4 text-white shadow-xl backdrop-blur-md">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                      {activeMobilePanel === 'locations' ? 'Quick Access' : 'Weather Details'}
                    </span>
                    <button
                      onClick={() => setActiveMobilePanel('none')}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-wide text-gray-300 transition-colors hover:border-white/30 hover:bg-white/10"
                    >
                      Close
                    </button>
                  </div>

                  <div className={`mt-3 ${mobileModalScrollHeightClass} overflow-y-auto pr-1`}>
                    {activeMobilePanel === 'locations' ? (
                      <LocationQuickAccess
                        favorites={favoriteLocations}
                        history={quickAccessHistory}
                        onSelect={handleLocationSelect}
                        onToggleFavorite={handleToggleFavorite}
                        onRemoveFavorite={handleRemoveFavorite}
                        onClearFavorites={handleClearFavorites}
                        onClearHistory={handleClearHistory}
                        variant="inline"
                        className="space-y-4"
                      />
                    ) : (
                      <div className="space-y-4">
                        {selectedLocation ? (
                          shouldShowWeatherDetails && weather ? (
                            <WeatherInfo
                              location={selectedLocation}
                              weather={weather}
                              forecast={forecast}
                              isFavorite={isFavoriteLocation(selectedLocation)}
                              onToggleFavorite={handleToggleFavorite}
                              className="rounded-xl border border-white/15 bg-white/5 p-5"
                            />
                          ) : !loading && !error ? (
                            <div className="rounded-xl border border-white/15 bg-white/5 p-5 text-sm text-gray-300">
                              Weather details will appear once data is available.
                            </div>
                          ) : null
                        ) : (
                          <div className="rounded-xl border border-white/15 bg-white/5 p-5 text-sm text-gray-300">
                            Select a location to view detailed weather data.
                          </div>
                        )}

                        {loading && (
                          <div className="rounded-xl border border-white/10 bg-black/40 p-4 text-sm text-gray-300">
                            Fetching latest weather data...
                          </div>
                        )}

                        {error && (
                          <div className="rounded-xl border border-red-500/50 bg-red-500/15 p-4 text-sm text-red-200">
                            {error}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-full flex-col">
            <div className="pointer-events-auto px-4 pt-6 sm:px-8 lg:px-12 xl:px-16">
              <div className="max-w-2xl">
                <SearchBar
                  onLocationSelect={handleLocationSelect}
                  history={quickAccessHistory}
                  favorites={favoriteLocations}
                  onToggleFavorite={handleToggleFavorite}
                />
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-white/60">
                <a
                  href="https://visibleearth.nasa.gov/collection/1484/blue-marble"
                  target="_blank"
                  rel="noreferrer"
                  className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-black/35 px-3 py-1 backdrop-blur-sm transition hover:text-white"
                >
                  Earth imagery © NASA Blue Marble
                </a>
                <a
                  href="https://arasmehmet.com"
                  target="_blank"
                  rel="noreferrer"
                  className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-black/35 px-3 py-1 backdrop-blur-sm transition hover:text-white"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                  Developed by Aras Mehmet
                </a>
              </div>
            </div>

            <div className="pointer-events-none mt-auto px-4 pb-6 sm:px-8 sm:pb-10 lg:px-12 xl:px-16">
              <div className="pointer-events-auto flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div className="w-full max-w-sm lg:max-w-xs">
                  <LocationQuickAccess
                    favorites={favoriteLocations}
                    history={quickAccessHistory}
                    onSelect={handleLocationSelect}
                    onToggleFavorite={handleToggleFavorite}
                    onRemoveFavorite={handleRemoveFavorite}
                    onClearFavorites={handleClearFavorites}
                    onClearHistory={handleClearHistory}
                  />
                </div>

                <div className="flex w-full flex-col gap-4 lg:w-auto lg:max-w-md">
                  {loading && (
                    <div className="rounded-lg border border-white/20 bg-black/50 p-6 text-white backdrop-blur-md">
                      <div className="flex items-center gap-3">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        <span>Loading weather data...</span>
                      </div>
                    </div>
                  )}

                  {error && (
                    <div className="rounded-lg border border-red-500/50 bg-red-500/20 p-6 text-white backdrop-blur-md">
                      <div className="mb-2 font-semibold">Error</div>
                      <div className="text-sm">{error}</div>
                    </div>
                  )}

                  {shouldShowWeatherDetails && weather && selectedLocation && (
                    <WeatherInfo
                      location={selectedLocation}
                      weather={weather}
                      forecast={forecast}
                      isFavorite={isFavoriteLocation(selectedLocation)}
                      onToggleFavorite={handleToggleFavorite}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
