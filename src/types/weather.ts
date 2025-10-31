export interface WeatherData {
  temperature: number
  condition: string
  conditionCode: number
  description: string
  humidity: number
  windSpeed: number
  visibility: number
  pressure: number
  feelsLike: number
  sunrise: number
  sunset: number
  timezone: number
}

export interface Location {
  name: string
  country: string
  lat: number
  lon: number
}

export interface ForecastDay {
  date: string
  tempMax: number
  tempMin: number
  condition: string
  conditionCode: number
}

export type WeatherCondition =
  | 'clear'
  | 'clouds'
  | 'rain'
  | 'drizzle'
  | 'snow'
  | 'thunderstorm'
  | 'mist'
  | 'fog'
