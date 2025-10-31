import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import type { Location } from '../../types/weather'
import { searchLocation } from '../../services/geocodingAPI'

interface SearchBarProps {
  onLocationSelect: (location: Location) => void
  history: Location[]
  favorites: Location[]
  onToggleFavorite: (location: Location) => void
}

const getLocationKey = (location: Location) => `${location.lat}:${location.lon}`
const getLocationLabel = (location: Location) => `${location.name}, ${location.country}`

function SearchBar({ onLocationSelect, history, favorites, onToggleFavorite }: SearchBarProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Location[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isFocused, setIsFocused] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const favoriteKeys = useMemo(
    () => new Set(favorites.map((location) => getLocationKey(location))),
    [favorites]
  )

  const historySuggestions = useMemo(() => {
    const ids = new Set<string>()
    const filtered: Location[] = []

    for (const location of history) {
      const key = getLocationKey(location)
      if (favoriteKeys.has(key) || ids.has(key)) {
        continue
      }

      ids.add(key)
      filtered.push(location)

      if (filtered.length === 6) {
        break
      }
    }

    return filtered
  }, [history, favoriteKeys])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false)
        setIsFocused(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
    }
  }, [])

  const performSearch = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setResults([])
      setShowResults(false)
      setError(null)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const locations = await searchLocation(searchQuery)
      setResults(locations)
      setShowResults(true)

      if (locations.length === 0) {
        setError('No locations found')
      }
    } catch (searchError) {
      console.error('Search failed:', searchError)
      setResults([])
      setError('Search failed. Please try again.')
      setShowResults(true)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleSearch = useCallback(
    (searchQuery: string) => {
      setQuery(searchQuery)

      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }

      if (searchQuery.length < 2) {
        setResults([])
        setShowResults(false)
        setError(null)
        return
      }

      debounceTimer.current = setTimeout(() => {
        performSearch(searchQuery)
      }, 400)
    },
    [performSearch]
  )

  const handleSelectLocation = useCallback(
    (location: Location) => {
      setQuery(getLocationLabel(location))
      setShowResults(false)
      setIsFocused(false)
      onLocationSelect(location)
    },
    [onLocationSelect]
  )

  const clearSearch = useCallback(() => {
    setQuery('')
    setResults([])
    setShowResults(false)
    setError(null)
  }, [])

  const handleToggleFavoriteClick = useCallback(
    (event: ReactMouseEvent<HTMLSpanElement>, location: Location) => {
      event.preventDefault()
      event.stopPropagation()
      onToggleFavorite(location)
    },
    [onToggleFavorite]
  )

  const shouldShowDropdown =
    isFocused &&
    (query.length >= 2
      ? showResults || isLoading || (error !== null && results.length === 0)
      : favorites.length > 0 || historySuggestions.length > 0)

  const renderStarIcon = (filled: boolean) => (
    <svg
      className={`h-4 w-4 transition-colors ${filled ? 'text-yellow-400' : 'text-gray-500 group-hover:text-yellow-300'}`}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
    </svg>
  )

  const renderSearchResults = () => {
    if (isLoading) {
      return <div className="px-4 py-6 text-center text-gray-400">Searching...</div>
    }

    if (results.length === 0) {
      return <div className="px-4 py-6 text-center text-gray-400">{error ?? 'No results found'}</div>
    }

    return results.map((location) => {
      const filled = favoriteKeys.has(getLocationKey(location))

      return (
        <button
          key={`${location.lat}-${location.lon}`}
          onClick={() => handleSelectLocation(location)}
          className="group w-full border-b border-white/10 px-4 py-3 text-left text-white transition-colors last:border-b-0 hover:bg-white/10"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium transition-colors group-hover:text-blue-400">
                {location.name}
              </div>
              <div className="text-sm text-gray-400">{location.country}</div>
            </div>
            <span
              role="button"
              tabIndex={-1}
              onClick={(event) => handleToggleFavoriteClick(event, location)}
              className="ml-3 rounded-full p-1 hover:bg-white/10"
            >
              {renderStarIcon(filled)}
            </span>
          </div>
        </button>
      )
    })
  }

  const renderSuggestionSection = (title: string, locations: Location[], highlightFavorites: boolean) => (
    <div className="px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-gray-500">{title}</div>
      <div className="mt-2 flex flex-col gap-2">
        {locations.map((location) => {
          const filled = highlightFavorites || favoriteKeys.has(getLocationKey(location))
          return (
            <button
              key={`${title}-${location.lat}-${location.lon}`}
              onClick={() => handleSelectLocation(location)}
              className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white transition-colors hover:border-blue-400/70 hover:bg-blue-500/10"
            >
              <span>{getLocationLabel(location)}</span>
              {renderStarIcon(filled)}
            </button>
          )
        })}
      </div>
    </div>
  )

  return (
    <div ref={searchRef} className="relative w-full sm:max-w-md">
      <div className="relative">
        <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
          <svg
            className="h-5 w-5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
          </svg>
        </div>

        <input
          type="text"
          value={query}
          onChange={(event) => handleSearch(event.target.value)}
          onFocus={() => setIsFocused(true)}
          placeholder="Search for a city..."
          className="w-full rounded-lg border border-white/20 bg-black/50 py-3 pl-10 pr-10 text-white outline-none transition-all backdrop-blur-md placeholder-gray-400 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/50"
        />

        {query && !isLoading && (
          <button
            onClick={clearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-white"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        )}

        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          </div>
        )}
      </div>

      {shouldShowDropdown && (
        <div className="absolute z-10 mt-2 max-h-60 w-full overflow-y-auto rounded-lg border border-white/20 bg-black/90 shadow-xl backdrop-blur-md">
          {query.length >= 2 ? (
            renderSearchResults()
          ) : (
            <>
              {favorites.length > 0 && renderSuggestionSection('Favorites', favorites, true)}
              {historySuggestions.length > 0 &&
                renderSuggestionSection('Recent Searches', historySuggestions, false)}
            </>
          )}
        </div>
      )}

      {query.length > 0 && query.length < 2 && !isLoading && (
        <div className="mt-2 text-xs text-gray-500">Type at least 2 characters to search</div>
      )}
    </div>
  )
}

export default SearchBar
