import { useEffect, useRef, useState } from 'react'

interface SmoothValueOptions {
  damping?: number
  precision?: number
  initialValue?: number
}

// Smoothly interpolates towards target value using exponential damping.
export function useSmoothValue(target: number, options: SmoothValueOptions = {}): number {
  const { damping = 0.15, precision = 0.001, initialValue } = options
  const [value, setValue] = useState(() => (initialValue !== undefined ? initialValue : target))
  const targetRef = useRef(target)
  const frameRef = useRef<number | null>(null)

  useEffect(() => {
    targetRef.current = target

    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }

    const step = () => {
      setValue((prev) => {
        const delta = targetRef.current - prev
        const next = prev + delta * damping

        if (Math.abs(delta) <= precision) {
          frameRef.current = null
          return targetRef.current
        }

        frameRef.current = requestAnimationFrame(step)
        return next
      })
    }

    frameRef.current = requestAnimationFrame(step)

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current)
        frameRef.current = null
      }
    }
  }, [target, damping, precision])

  return value
}

export default useSmoothValue
