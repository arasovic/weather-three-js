import { useMemo, useCallback } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import type { Location } from '../../types/weather'

interface LocationQuickAccessProps {
  favorites: Location[]
  history: Location[]
  onSelect: (location: Location) => void
  onToggleFavorite: (location: Location) => void
  onRemoveFavorite?: (location: Location) => void
  onClearFavorites?: () => void
  onClearHistory?: () => void
  variant?: 'card' | 'inline'
  className?: string
}

const getLocationKey = (location: Location) => `${location.lat}:${location.lon}`
const getLocationLabel = (location: Location) => `${location.name}, ${location.country}`

function LocationQuickAccess({
  favorites,
  history,
  onSelect,
  onToggleFavorite,
  onRemoveFavorite,
  onClearFavorites,
  onClearHistory,
  variant = 'card',
  className,
}: LocationQuickAccessProps) {
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

  const handleFavoriteRemove = useCallback(
    (event: ReactMouseEvent<HTMLElement>, location: Location) => {
      if (!onRemoveFavorite) {
        return
      }
      event.preventDefault()
      event.stopPropagation()
      onRemoveFavorite(location)
    },
    [onRemoveFavorite]
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

  const containerClass =
    variant === 'inline'
      ? ['w-full text-white', className].filter(Boolean).join(' ')
      : [
          'w-full rounded-lg border border-white/15 bg-black/45 p-4 text-white shadow-lg backdrop-blur-md',
          className,
        ]
          .filter(Boolean)
          .join(' ')

  return (
    <div className={containerClass}>
      <div className="flex flex-col gap-4">
        {favorites.length > 0 && (
          <div>
            <div className="flex items-center justify-between text-xs uppercase tracking-wide text-gray-500">
              <span>Favorites</span>
              {onClearFavorites && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    onClearFavorites()
                  }}
                  className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-300 transition hover:border-red-400/60 hover:bg-red-500/10 hover:text-red-200"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="mt-2 flex flex-col gap-2">
              {favorites.map((location) => (
                <button
                  key={`favorite-${location.lat}-${location.lon}`}
                  onClick={() => onSelect(location)}
                  className="group flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-white transition-colors hover:border-yellow-400/70 hover:bg-yellow-500/10"
                >
                  <span>{getLocationLabel(location)}</span>
                  <span className="ml-3 flex items-center gap-2">
                    <span className="rounded-full border border-white/10 bg-white/10 p-1 text-yellow-400">
                      {renderStarIcon(true)}
                    </span>
                    {onRemoveFavorite && (
                      <span
                        role="button"
                        tabIndex={-1}
                        aria-label="Remove from favorites"
                        onClick={(event) => handleFavoriteRemove(event, location)}
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/10 text-gray-300 transition-colors hover:border-red-400/70 hover:bg-red-500/20 hover:text-red-200"
                      >
                        <svg
                          className="h-3.5 w-3.5"
                          viewBox="0 0 20 20"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M6 6l8 8M6 14L14 6" />
                        </svg>
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {recentHistory.length > 0 && (
          <div>
            <div className="flex items-center justify-between text-xs uppercase tracking-wide text-gray-500">
              <span>Recent Searches</span>
              {onClearHistory && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    onClearHistory()
                  }}
                  className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-300 transition hover:border-blue-400/60 hover:bg-blue-500/10 hover:text-blue-200"
                >
                  Clear
                </button>
              )}
            </div>
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
