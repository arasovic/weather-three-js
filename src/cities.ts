import { getPosition } from 'suncalc'

export interface City {
  name: string
  lat: number
  lon: number
}

// West to east, so stepping through them follows the sun around the planet.
export const cities: City[] = [
  { name: 'Honolulu', lat: 21.31, lon: -157.86 },
  { name: 'San Francisco', lat: 37.77, lon: -122.42 },
  { name: 'Mexico City', lat: 19.43, lon: -99.13 },
  { name: 'Chicago', lat: 41.88, lon: -87.63 },
  { name: 'New York', lat: 40.71, lon: -74.01 },
  { name: 'Rio de Janeiro', lat: -22.91, lon: -43.17 },
  { name: 'Reykjavik', lat: 64.15, lon: -21.94 },
  { name: 'London', lat: 51.51, lon: -0.13 },
  { name: 'Paris', lat: 48.86, lon: 2.35 },
  { name: 'Venice', lat: 45.44, lon: 12.33 },
  { name: 'Berlin', lat: 52.52, lon: 13.4 },
  { name: 'Cape Town', lat: -33.92, lon: 18.42 },
  { name: 'Istanbul', lat: 41.01, lon: 28.98 },
  { name: 'Giresun', lat: 40.91, lon: 38.39 },
  { name: 'Dubai', lat: 25.2, lon: 55.27 },
  { name: 'Mumbai', lat: 18.94, lon: 72.83 },
  { name: 'Bangkok', lat: 13.75, lon: 100.5 },
  { name: 'Hong Kong', lat: 22.28, lon: 114.16 },
  { name: 'Tokyo', lat: 35.68, lon: 139.69 },
  { name: 'Sydney', lat: -33.86, lon: 151.21 },
  { name: 'Auckland', lat: -36.85, lon: 174.76 },
]

/** Index of the city closest to sunset right now: sun just above the horizon and going down. */
export function sunsetCity(now = new Date(), list: City[] = cities): number {
  const later = new Date(now.getTime() + 10 * 60_000)
  let best = Math.max(0, list.findIndex((c) => c.name === 'Istanbul'))
  let bestScore = Infinity
  list.forEach((c, i) => {
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
