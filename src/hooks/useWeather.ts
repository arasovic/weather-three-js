import { useState, useEffect, useCallback } from 'react'
import type { WeatherData, ForecastDay } from '../types/weather'
import { fetchWeatherData, fetchForecast } from '../services/weatherAPI'

interface UseWeatherResult {
  weather: WeatherData | null
  forecast: ForecastDay[]
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useWeather(lat: number | null, lon: number | null): UseWeatherResult {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [forecast, setForecast] = useState<ForecastDay[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (lat === null || lon === null) return

    setLoading(true)
    setError(null)

    try {
      const [weatherData, forecastData] = await Promise.all([
        fetchWeatherData(lat, lon),
        fetchForecast(lat, lon),
      ])

      setWeather(weatherData)
      setForecast(forecastData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch weather data')
    } finally {
      setLoading(false)
    }
  }, [lat, lon])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return {
    weather,
    forecast,
    loading,
    error,
    refetch: fetchData,
  }
}
