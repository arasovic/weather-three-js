import { getPosition } from 'suncalc'

export interface City {
  name: string
  lat: number
  lon: number
}

// West to east, so stepping through them follows the sun around the planet.
export const cities: City[] = [
  { name: 'New York', lat: 40.71, lon: -74.01 },
  { name: 'London', lat: 51.51, lon: -0.13 },
  { name: 'Paris', lat: 48.86, lon: 2.35 },
  { name: 'Istanbul', lat: 41.01, lon: 28.98 },
  { name: 'Tokyo', lat: 35.68, lon: 139.69 },
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
