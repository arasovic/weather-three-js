import Sun from './Sun'
import Cloud from './Cloud'
import { latLonToVector3 } from '../../utils/coordinates'

interface WeatherIconProps {
  condition: string
  lat: number
  lon: number
  radius: number
}

function WeatherIcon({ condition, lat, lon, radius }: WeatherIconProps) {
  const surfacePosition = latLonToVector3(lat, lon, radius)

  // Offset above the surface
  const offsetMultiplier = 1.3
  const iconX = surfacePosition.x * offsetMultiplier
  const iconY = surfacePosition.y * offsetMultiplier
  const iconZ = surfacePosition.z * offsetMultiplier

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
