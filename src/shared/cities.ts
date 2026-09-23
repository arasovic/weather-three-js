import { getPosition } from 'suncalc'

export interface City {
  name: string
  lat: number
  lon: number
}

// Sorted west to east, so stepping through the list follows the sun across the planet.
export const cities: City[] = [
  { name: 'Honolulu', lat: 21.31, lon: -157.86 },
  { name: 'Anchorage', lat: 61.22, lon: -149.9 },
  { name: 'Vancouver', lat: 49.28, lon: -123.12 },
  { name: 'San Francisco', lat: 37.77, lon: -122.42 },
  { name: 'Los Angeles', lat: 34.05, lon: -118.24 },
  { name: 'Denver', lat: 39.74, lon: -104.99 },
  { name: 'Mexico City', lat: 19.43, lon: -99.13 },
  { name: 'Chicago', lat: 41.88, lon: -87.63 },
  { name: 'Lima', lat: -12.05, lon: -77.04 },
  { name: 'Bogotá', lat: 4.71, lon: -74.07 },
  { name: 'New York', lat: 40.71, lon: -74.01 },
  { name: 'Santiago', lat: -33.45, lon: -70.67 },
  { name: 'Buenos Aires', lat: -34.6, lon: -58.38 },
  { name: 'Rio de Janeiro', lat: -22.91, lon: -43.17 },
  { name: 'Reykjavík', lat: 64.15, lon: -21.94 },
  { name: 'Dakar', lat: 14.72, lon: -17.47 },
  { name: 'Lisbon', lat: 38.72, lon: -9.14 },
  { name: 'London', lat: 51.51, lon: -0.13 },
  { name: 'Paris', lat: 48.86, lon: 2.35 },
  { name: 'Lagos', lat: 6.52, lon: 3.38 },
  { name: 'Rome', lat: 41.9, lon: 12.5 },
  { name: 'Cape Town', lat: -33.92, lon: 18.42 },
  { name: 'Istanbul', lat: 41.01, lon: 28.98 },
  { name: 'Cairo', lat: 30.04, lon: 31.24 },
  { name: 'Nairobi', lat: -1.29, lon: 36.82 },
  { name: 'Moscow', lat: 55.76, lon: 37.62 },
  { name: 'Tehran', lat: 35.69, lon: 51.39 },
  { name: 'Dubai', lat: 25.2, lon: 55.27 },
  { name: 'Karachi', lat: 24.86, lon: 67.0 },
  { name: 'Mumbai', lat: 19.08, lon: 72.88 },
  { name: 'Delhi', lat: 28.61, lon: 77.21 },
  { name: 'Kathmandu', lat: 27.72, lon: 85.32 },
  { name: 'Dhaka', lat: 23.81, lon: 90.41 },
  { name: 'Bangkok', lat: 13.76, lon: 100.5 },
  { name: 'Singapore', lat: 1.35, lon: 103.82 },
  { name: 'Hong Kong', lat: 22.32, lon: 114.17 },
  { name: 'Perth', lat: -31.95, lon: 115.86 },
  { name: 'Beijing', lat: 39.9, lon: 116.4 },
  { name: 'Seoul', lat: 37.57, lon: 126.98 },
  { name: 'Tokyo', lat: 35.68, lon: 139.69 },
  { name: 'Sydney', lat: -33.87, lon: 151.21 },
  { name: 'Auckland', lat: -36.85, lon: 174.76 },
]

/** Index of the city closest to sunset right now: sun just above the horizon and going down. */
export function sunsetCity(now = new Date()): number {
  const later = new Date(now.getTime() + 10 * 60_000)
  let best = cities.findIndex((c) => c.name === 'Istanbul')
  let bestScore = Infinity
  cities.forEach((c, i) => {
    const h = getPosition(now, c.lat, c.lon).altitude
    const falling = getPosition(later, c.lat, c.lon).altitude < h
    const score = Math.abs(h - 2)
    if (falling && h > -4 && h < 10 && score < bestScore) {
      best = i
      bestScore = score
    }
  })
  return best
}

/** Great-circle distance in km. */
export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const r = Math.PI / 180
  const s =
    Math.sin(((b.lat - a.lat) * r) / 2) ** 2 +
    Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lon - a.lon) * r) / 2) ** 2
  return 12742 * Math.asin(Math.sqrt(s))
}
