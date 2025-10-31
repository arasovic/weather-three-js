import { useMemo, useCallback } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import type { Location } from '../../types/weather'

interface LocationQuickAccessProps {
  favorites: Location[]
  history: Location[]
  onSelect: (location: Location) => void
  onToggleFavorite: (location: Location) => void
}

const getLocationKey = (location: Location) => `${location.lat}:${location.lon}`
const getLocationLabel = (location: Location) => `${location.name}, ${location.country}`

function LocationQuickAccess({ favorites, history, onSelect, onToggleFavorite }: LocationQuickAccessProps) {
  const favoriteKeys = useMemo(
    () => new Set(favorites.map((location) => getLocationKey(location))),
    [favorites]
  )

  const recentHistory = useMemo(() => {
    const seen = new Set<string>()
    const items: Location[] = []

    for (const location of history) {
      const key = getLocationKey(location)
      if (favoriteKeys.has(key) || seen.has(key)) {
        continue
      }
      seen.add(key)
      items.push(location)
      if (items.length >= 6) {
        break
      }
    }

    return items
  }, [history, favoriteKeys])

  const handleFavoriteToggle = useCallback(
    (event: ReactMouseEvent<HTMLElement>, location: Location) => {
      event.preventDefault()
      event.stopPropagation()
      onToggleFavorite(location)
    },
    [onToggleFavorite]
  )

  const renderStarIcon = (filled: boolean) => (
    <svg
      className={`h-4 w-4 ${filled ? 'text-yellow-400' : 'text-gray-500 group-hover:text-yellow-300'}`}
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

  if (favorites.length === 0 && recentHistory.length === 0) {
    return null
  }

  return (
    <div className="w-full rounded-lg border border-white/15 bg-black/45 p-4 text-white shadow-lg backdrop-blur-md">
      <div className="flex flex-col gap-4">
        {favorites.length > 0 && (
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-500">Favorites</div>
            <div className="mt-2 flex flex-col gap-2">
              {favorites.map((location) => (
                <button
                  key={`favorite-${location.lat}-${location.lon}`}
                  onClick={() => onSelect(location)}
                  className="group flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-white transition-colors hover:border-yellow-400/70 hover:bg-yellow-500/10"
                >
                  <span>{getLocationLabel(location)}</span>
                  <span
                    role="button"
                    tabIndex={-1}
                    aria-label="Remove from favorites"
                    onClick={(event) => handleFavoriteToggle(event, location)}
                    className="ml-3 rounded-full border border-white/10 bg-white/10 p-1 text-yellow-400 transition-colors hover:border-yellow-300 hover:bg-yellow-400/10"
                  >
                    {renderStarIcon(true)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {recentHistory.length > 0 && (
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-500">Recent Searches</div>
            <div className="mt-2 flex flex-col gap-2">
              {recentHistory.map((location) => (
                <button
                  key={`history-${location.lat}-${location.lon}`}
                  onClick={() => onSelect(location)}
                  className="group flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-white transition-colors hover:border-blue-400/70 hover:bg-blue-500/10"
                >
                  <span>{getLocationLabel(location)}</span>
                  <span
                    role="button"
                    tabIndex={-1}
                    aria-label="Toggle favorite"
                    onClick={(event) => handleFavoriteToggle(event, location)}
                    className="ml-3 rounded-full border border-white/10 bg-white/10 p-1 text-gray-400 transition-colors hover:border-yellow-300 hover:bg-yellow-400/10 hover:text-yellow-300"
                  >
                    {renderStarIcon(favoriteKeys.has(getLocationKey(location)))}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default LocationQuickAccess
