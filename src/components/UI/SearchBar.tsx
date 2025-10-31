import { useState, useRef, useEffect, useCallback } from 'react'
import type { Location } from '../../types/weather'
import { searchLocation } from '../../services/geocodingAPI'

interface SearchBarProps {
  onLocationSelect: (location: Location) => void
}

function SearchBar({ onLocationSelect }: SearchBarProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Location[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const searchRef = useRef<HTMLDivElement>(null)
  const debounceTimer = useRef<NodeJS.Timeout>()

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
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
    } catch (err) {
      console.error('Search failed:', err)
      setResults([])
      setError('Search failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleSearch = (searchQuery: string) => {
    setQuery(searchQuery)

    // Clear previous timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }

    // Debounce search by 500ms
    debounceTimer.current = setTimeout(() => {
      performSearch(searchQuery)
    }, 500)
  }

  const handleSelectLocation = (location: Location) => {
    setQuery(`${location.name}, ${location.country}`)
    setShowResults(false)
    onLocationSelect(location)
  }

  const clearSearch = () => {
    setQuery('')
    setResults([])
    setShowResults(false)
    setError(null)
  }

  return (
    <div ref={searchRef} className="relative w-full max-w-md">
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
          <svg
            className="w-5 h-5"
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
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search for a city..."
          className="w-full pl-10 pr-10 py-3 text-white bg-black/50 backdrop-blur-md border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 placeholder-gray-400 transition-all"
        />

        {query && !isLoading && (
          <button
            onClick={clearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
          >
            <svg
              className="w-5 h-5"
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
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Results dropdown */}
      {showResults && (
        <div className="absolute z-10 w-full mt-2 bg-black/90 backdrop-blur-md border border-white/20 rounded-lg shadow-xl max-h-60 overflow-y-auto">
          {results.length > 0 ? (
            results.map((location, index) => (
              <button
                key={`${location.lat}-${location.lon}-${index}`}
                onClick={() => handleSelectLocation(location)}
                className="w-full px-4 py-3 text-left text-white hover:bg-white/10 transition-colors border-b border-white/10 last:border-b-0 group"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium group-hover:text-blue-400 transition-colors">
                      {location.name}
                    </div>
                    <div className="text-sm text-gray-400">{location.country}</div>
                  </div>
                  <svg
                    className="w-4 h-4 text-gray-600 group-hover:text-blue-400 transition-colors"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M9 5l7 7-7 7"></path>
                  </svg>
                </div>
              </button>
            ))
          ) : (
            <div className="px-4 py-6 text-center text-gray-400">{error || 'No results found'}</div>
          )}
        </div>
      )}

      {/* Helper text */}
      {query.length > 0 && query.length < 2 && !isLoading && (
        <div className="absolute left-0 mt-1 text-xs text-gray-500">
          Type at least 2 characters to search
        </div>
      )}
    </div>
  )
}

export default SearchBar
