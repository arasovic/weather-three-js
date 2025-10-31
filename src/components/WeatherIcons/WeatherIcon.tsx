import Sun from './Sun'
import Cloud from './Cloud'

interface WeatherIconProps {
  condition: string
  lat: number
  lon: number
  radius: number
}

function WeatherIcon({ condition, lat, lon, radius }: WeatherIconProps) {
  // Convert lat/lon to 3D coordinates (same as LocationMarker)
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lon + 180) * (Math.PI / 180)

  const x = -(radius * Math.sin(phi) * Math.cos(theta))
  const y = radius * Math.cos(phi)
  const z = radius * Math.sin(phi) * Math.sin(theta)

  // Offset above the surface
  const offsetMultiplier = 1.3
  const iconX = x * (offsetMultiplier / radius) * radius
  const iconY = y * (offsetMultiplier / radius) * radius
  const iconZ = z * (offsetMultiplier / radius) * radius

  // Render appropriate icon based on weather condition
  switch (condition) {
    case 'clear':
      return <Sun position={[iconX, iconY, iconZ]} />

    case 'clouds':
    case 'fog':
      return <Cloud position={[iconX, iconY, iconZ]} />

    case 'rain':
    case 'drizzle':
      return <Cloud position={[iconX, iconY, iconZ]} scale={0.15} />

    case 'snow':
      return <Cloud position={[iconX, iconY, iconZ]} scale={0.13} />

    default:
      return null
  }
}

export default WeatherIcon
