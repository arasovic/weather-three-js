import { useState, useEffect } from 'react'

interface GeolocationState {
  lat: number | null
  lon: number | null
  loading: boolean
  error: string | null
}

export function useGeolocation(): GeolocationState {
  const [state, setState] = useState<GeolocationState>(() => {
    if (!navigator.geolocation) {
      return {
        lat: null,
        lon: null,
        loading: false,
        error: 'Geolocation is not supported by your browser',
      }
    }
    return {
      lat: null,
      lon: null,
      loading: true,
      error: null,
    }
  })

  useEffect(() => {
    if (!navigator.geolocation) {
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          loading: false,
          error: null,
        })
      },
      (_error) => {
        // Silently fail - user can search manually
        setState({
          lat: null,
          lon: null,
          loading: false,
          error: null,
        })
      }
    )
  }, [])

  return state
}
