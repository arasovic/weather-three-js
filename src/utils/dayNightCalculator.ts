export interface DayNightInfo {
  isNight: boolean
  progress: number // 0-1, where 0 is full night, 1 is full day
}

/**
 * Calculates if it's currently night or day based on sunrise/sunset times
 * Also returns a progress value for smooth transitions
 */
export function calculateDayNight(
  sunrise: number,
  sunset: number,
  currentTime: number = Date.now()
): DayNightInfo {
  // If sunrise/sunset not available, default to day
  if (!sunrise || !sunset) {
    return { isNight: false, progress: 1 }
  }

  const isNight = currentTime < sunrise || currentTime > sunset

  // Calculate progress for smooth transitions
  let progress = 1

  if (isNight) {
    // Night time
    if (currentTime < sunrise) {
      // Before sunrise - calculate how close to sunrise
      const nightDuration = sunrise - (sunset - 24 * 60 * 60 * 1000)
      const timeSinceSunset = currentTime - (sunset - 24 * 60 * 60 * 1000)
      progress = Math.max(0, 1 - timeSinceSunset / nightDuration)
    } else {
      // After sunset - calculate how far from sunset
      const nextSunrise = sunrise + 24 * 60 * 60 * 1000
      const nightDuration = nextSunrise - sunset
      const timeSinceSunset = currentTime - sunset
      progress = Math.max(0, 1 - timeSinceSunset / nightDuration)
    }
    progress = progress * 0.3 // Night is darker (0-0.3 range)
  } else {
    // Day time
    const dayDuration = sunset - sunrise
    const timeSinceSunrise = currentTime - sunrise

    // Create a smooth curve peaking at noon
    const dayProgress = timeSinceSunrise / dayDuration
    progress = 0.3 + Math.sin(dayProgress * Math.PI) * 0.7 // 0.3-1.0 range
  }

  return { isNight, progress }
}
