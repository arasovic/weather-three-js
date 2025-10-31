import type { Location } from '../types/weather'

const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org'

interface NominatimResult {
  place_id: number
  lat: string
  lon: string
  display_name: string
  address: {
    city?: string
    town?: string
    village?: string
    country?: string
    country_code?: string
  }
}

export async function searchLocation(query: string): Promise<Location[]> {
  try {
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      limit: '5',
      addressdetails: '1',
    })

    const response = await fetch(`${NOMINATIM_BASE_URL}/search?${params}`, {
      headers: {
        'User-Agent': '3D-Weather-App/1.0',
      },
    })

    if (!response.ok) {
      throw new Error(`Geocoding API error: ${response.status}`)
    }

    const data: NominatimResult[] = await response.json()

    return data.map((result) => ({
      name:
        result.address.city ||
        result.address.town ||
        result.address.village ||
        result.display_name.split(',')[0],
      country: result.address.country || '',
      lat: parseFloat(result.lat),
      lon: parseFloat(result.lon),
    }))
  } catch (error) {
    console.error('Failed to search location:', error)
    throw error
  }
}

export async function reverseGeocode(lat: number, lon: number): Promise<Location> {
  try {
    const params = new URLSearchParams({
      lat: lat.toString(),
      lon: lon.toString(),
      format: 'json',
      addressdetails: '1',
    })

    const response = await fetch(`${NOMINATIM_BASE_URL}/reverse?${params}`, {
      headers: {
        'User-Agent': '3D-Weather-App/1.0',
      },
    })

    if (!response.ok) {
      throw new Error(`Reverse geocoding error: ${response.status}`)
    }

    const data: NominatimResult = await response.json()

    return {
      name: data.address.city || data.address.town || data.address.village || 'Unknown',
      country: data.address.country || '',
      lat: parseFloat(data.lat),
      lon: parseFloat(data.lon),
    }
  } catch (error) {
    console.error('Failed to reverse geocode:', error)
    throw error
  }
}
