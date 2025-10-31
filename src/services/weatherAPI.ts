import type { WeatherData, ForecastDay } from '../types/weather'

const OPEN_METEO_BASE_URL = 'https://api.open-meteo.com/v1'

interface OpenMeteoResponse {
  current: {
    temperature_2m: number
    relative_humidity_2m: number
    weather_code: number
    wind_speed_10m: number
    surface_pressure: number
    apparent_temperature: number
  }
  daily: {
    time: string[]
    temperature_2m_max: number[]
    temperature_2m_min: number[]
    weather_code: number[]
    sunrise: string[]
    sunset: string[]
  }
  timezone: string
  utc_offset_seconds: number
}

// Weather code mapping to descriptions
// Based on WMO Weather interpretation codes
const getWeatherDescription = (code: number): { condition: string; description: string } => {
  if (code === 0) return { condition: 'clear', description: 'Clear sky' }
  if (code <= 3) return { condition: 'clouds', description: 'Partly cloudy' }
  if (code <= 48) return { condition: 'fog', description: 'Foggy' }
  if (code <= 57) return { condition: 'drizzle', description: 'Drizzle' }
  if (code <= 67) return { condition: 'rain', description: 'Rain' }
  if (code <= 77) return { condition: 'snow', description: 'Snow' }
  if (code <= 82) return { condition: 'rain', description: 'Rain showers' }
  if (code <= 86) return { condition: 'snow', description: 'Snow showers' }
  if (code <= 99) return { condition: 'thunderstorm', description: 'Thunderstorm' }
  return { condition: 'clear', description: 'Unknown' }
}

export async function fetchWeatherData(lat: number, lon: number): Promise<WeatherData> {
  try {
    const params = new URLSearchParams({
      latitude: lat.toString(),
      longitude: lon.toString(),
      current:
        'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,surface_pressure,apparent_temperature',
      daily: 'temperature_2m_max,temperature_2m_min,weather_code,sunrise,sunset',
      timezone: 'auto',
      forecast_days: '1',
    })

    const response = await fetch(`${OPEN_METEO_BASE_URL}/forecast?${params}`)

    if (!response.ok) {
      throw new Error(`Weather API error: ${response.status}`)
    }

    const data: OpenMeteoResponse = await response.json()
    const weather = getWeatherDescription(data.current.weather_code)

    // Parse sunrise and sunset times (ISO 8601 format)
    const sunriseTime = new Date(data.daily.sunrise[0]).getTime()
    const sunsetTime = new Date(data.daily.sunset[0]).getTime()

    return {
      temperature: Math.round(data.current.temperature_2m),
      condition: weather.condition,
      conditionCode: data.current.weather_code,
      description: weather.description,
      humidity: data.current.relative_humidity_2m,
      windSpeed: Math.round(data.current.wind_speed_10m),
      visibility: 10, // Open-Meteo doesn't provide visibility
      pressure: Math.round(data.current.surface_pressure),
      feelsLike: Math.round(data.current.apparent_temperature),
      sunrise: sunriseTime,
      sunset: sunsetTime,
      timezone: data.utc_offset_seconds,
    }
  } catch (error) {
    console.error('Failed to fetch weather data:', error)
    throw error
  }
}

export async function fetchForecast(lat: number, lon: number): Promise<ForecastDay[]> {
  try {
    const params = new URLSearchParams({
      latitude: lat.toString(),
      longitude: lon.toString(),
      daily: 'temperature_2m_max,temperature_2m_min,weather_code',
      timezone: 'auto',
      forecast_days: '5',
    })

    const response = await fetch(`${OPEN_METEO_BASE_URL}/forecast?${params}`)

    if (!response.ok) {
      throw new Error(`Forecast API error: ${response.status}`)
    }

    const data: OpenMeteoResponse = await response.json()

    return data.daily.time.map((date, index) => {
      const weather = getWeatherDescription(data.daily.weather_code[index])
      return {
        date,
        tempMax: Math.round(data.daily.temperature_2m_max[index]),
        tempMin: Math.round(data.daily.temperature_2m_min[index]),
        condition: weather.condition,
        conditionCode: data.daily.weather_code[index],
      }
    })
  } catch (error) {
    console.error('Failed to fetch forecast data:', error)
    throw error
  }
}
