const API = 'https://api.open-meteo.com/v1/forecast'

const CURRENT = [
  'temperature_2m',
  'weather_code',
  'cloud_cover',
  'cloud_cover_low',
  'cloud_cover_mid',
  'cloud_cover_high',
  'precipitation',
  'rain',
  'snowfall',
  'wind_speed_10m',
  'wind_direction_10m',
  'visibility',
] as const

export type Current = Record<(typeof CURRENT)[number], number> & { time: string }

export interface Conditions {
  current: Current
  utcOffset: number
}

/** Current conditions for many places in one request. */
export async function fetchCurrent(places: { lat: number; lon: number }[]): Promise<Conditions[]> {
  const url =
    `${API}?latitude=${places.map((p) => p.lat).join(',')}` +
    `&longitude=${places.map((p) => p.lon).join(',')}` +
    `&current=${CURRENT.join(',')}&wind_speed_unit=ms&timezone=auto`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Open-Meteo answered ${res.status}`)
  const body = await res.json()
  const list = Array.isArray(body) ? body : [body]
  return list.map((d) => ({ current: d.current, utcOffset: d.utc_offset_seconds }))
}

const WMO: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mostly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Freezing fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Heavy drizzle',
  56: 'Freezing drizzle',
  57: 'Freezing drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  66: 'Freezing rain',
  67: 'Freezing rain',
  71: 'Light snow',
  73: 'Snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Rain showers',
  81: 'Rain showers',
  82: 'Violent rain showers',
  85: 'Snow showers',
  86: 'Snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with hail',
  99: 'Thunderstorm with hail',
}

export const describe = (code: number) => WMO[code] ?? 'Unknown'

/** The name of the icon for a WMO weather code, by day or by night. */
export function weatherIcon(code: number, day: boolean) {
  if (code >= 95) return 'cloud-lightning'
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'cloud-snow'
  if (code >= 51) return 'cloud-rain'
  if (code >= 45) return 'cloud-fog'
  if (code === 3) return 'cloud'
  if (code === 2) return day ? 'cloud-sun' : 'cloud-moon'
  return day ? 'sun' : 'crescent-moon'
}

/** Local wall-clock time at the place, e.g. "19:42". */
export function localTime(utcOffset: number, now = new Date()) {
  const t = new Date(now.getTime() + utcOffset * 1000)
  return `${String(t.getUTCHours()).padStart(2, '0')}:${String(t.getUTCMinutes()).padStart(2, '0')}`
}
