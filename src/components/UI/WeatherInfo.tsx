import type { WeatherData, ForecastDay, Location } from '../../types/weather'

interface WeatherInfoProps {
  location: Location
  weather: WeatherData
  forecast: ForecastDay[]
  isFavorite: boolean
  onToggleFavorite: (location: Location) => void
}

function WeatherInfo({ location, weather, forecast, isFavorite, onToggleFavorite }: WeatherInfoProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  return (
    <div className="w-full rounded-lg border border-white/20 bg-black/55 p-6 text-white backdrop-blur-md">
      {/* Location */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">{location.name}</h2>
          <p className="text-gray-400">{location.country}</p>
        </div>
        <button
          onClick={() => onToggleFavorite(location)}
          className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white transition-colors hover:border-yellow-400/70 hover:bg-yellow-500/10"
        >
          <svg
            className={`h-5 w-5 ${isFavorite ? 'text-yellow-400' : 'text-gray-400'}`}
            viewBox="0 0 24 24"
            fill={isFavorite ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
          </svg>
          <span>{isFavorite ? 'Favorited' : 'Add to Favorites'}</span>
        </button>
      </div>

      {/* Current Weather */}
      <div className="mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-6xl font-bold">{weather.temperature}°</div>
            <div className="text-xl text-gray-300 capitalize mt-2">{weather.description}</div>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-400">Feels like</div>
            <div className="text-2xl font-semibold">{weather.feelsLike}°</div>
          </div>
        </div>

        {/* Weather Details Grid */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
          <div>
            <div className="text-sm text-gray-400">Humidity</div>
            <div className="text-lg font-semibold">{weather.humidity}%</div>
          </div>
          <div>
            <div className="text-sm text-gray-400">Wind Speed</div>
            <div className="text-lg font-semibold">{weather.windSpeed} km/h</div>
          </div>
          <div>
            <div className="text-sm text-gray-400">Pressure</div>
            <div className="text-lg font-semibold">{weather.pressure} hPa</div>
          </div>
          <div>
            <div className="text-sm text-gray-400">Visibility</div>
            <div className="text-lg font-semibold">{weather.visibility} km</div>
          </div>
        </div>
      </div>

      {/* Forecast */}
      {forecast.length > 0 && (
        <div className="pt-4 border-t border-white/10">
          <h3 className="text-lg font-semibold mb-3">5-Day Forecast</h3>
          <div className="space-y-2">
            {forecast.slice(0, 5).map((day, index) => (
              <div
                key={day.date}
                className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-white/5 transition-colors"
              >
                <div className="flex-1">
                  <div className="font-medium">{index === 0 ? 'Today' : formatDate(day.date)}</div>
                  <div className="text-sm text-gray-400 capitalize">{day.condition}</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-sm text-gray-400">{day.tempMin}°</div>
                  <div className="text-lg font-semibold">{day.tempMax}°</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default WeatherInfo
