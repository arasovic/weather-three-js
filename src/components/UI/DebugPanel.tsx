import type { WeatherCondition } from '../../types/weather'

interface DebugPanelProps {
  currentWeather: WeatherCondition
  onWeatherChange: (weather: WeatherCondition) => void
}

const weatherOptions: { value: WeatherCondition; label: string }[] = [
  { value: 'clear', label: 'Clear' },
  { value: 'clouds', label: 'Clouds' },
  { value: 'fog', label: 'Fog/Mist' },
  { value: 'drizzle', label: 'Drizzle' },
  { value: 'rain', label: 'Rain' },
  { value: 'thunderstorm', label: 'Thunderstorm' },
  { value: 'snow', label: 'Snow' },
]

function DebugPanel({ currentWeather, onWeatherChange }: DebugPanelProps) {
  return (
    <div className="pointer-events-auto fixed right-4 top-4 z-50 max-w-xs rounded-lg border border-white/20 bg-white/10 p-4 backdrop-blur-md">
      <h3 className="mb-3 text-sm font-semibold text-white">Debug Mode</h3>
      <div className="space-y-2">
        {weatherOptions.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-center gap-2 text-sm text-white/90 transition-colors hover:text-white"
          >
            <input
              type="radio"
              name="weather"
              value={option.value}
              checked={currentWeather === option.value}
              onChange={(e) => onWeatherChange(e.target.value as WeatherCondition)}
              className="h-4 w-4 cursor-pointer accent-blue-400"
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

export default DebugPanel
