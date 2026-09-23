import '../shared/base.css'
import './style.css'
import { getMoonIllumination, getMoonPosition, getPosition } from 'suncalc'
import { cities, sunsetCity } from '../shared/cities'
import { addSignature } from '../shared/signature'
import { describe, fetchCurrent, localTime, type Conditions } from '../shared/weather'
import { fragment, vertex } from './sky'

const RAD = Math.PI / 180
// Clouds would barely move at true speed; this is purely for the eye.
const DRIFT_SPEEDUP = 60
const PITCH = 0.26
const FOCAL = 1.25
// ?shift=<hours> previews another time of day.
const shift = Number(new URLSearchParams(location.search).get('shift')) || 0
const now = () => new Date(Date.now() + shift * 3_600_000)

const canvas = document.createElement('canvas')
canvas.id = 'sky'
canvas.setAttribute('aria-hidden', 'true')
document.body.appendChild(canvas)

const readout = document.createElement('section')
readout.className = 'readout'
readout.setAttribute('aria-live', 'polite')
readout.innerHTML = '<h1 class="city"></h1><p class="temp"></p><p class="detail"></p>'
document.body.appendChild(readout)
const [cityEl, tempEl, detailEl] = readout.children as unknown as HTMLElement[]

const hint = document.createElement('p')
hint.className = 'hint'
hint.textContent = 'Swipe to follow the sunset'
document.body.appendChild(hint)
addSignature()

const gl = canvas.getContext('webgl2', { antialias: false, alpha: false })
if (!gl) throw new Error('WebGL2 is not available')

function compile(type: number, source: string) {
  const s = gl!.createShader(type)!
  gl!.shaderSource(s, source)
  gl!.compileShader(s)
  if (!gl!.getShaderParameter(s, gl!.COMPILE_STATUS)) throw new Error(gl!.getShaderInfoLog(s) ?? 'shader')
  return s
}
const program = gl.createProgram()
gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex))
gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment))
gl.linkProgram(program)
if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? 'link')
gl.useProgram(program)

gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
const aPos = gl.getAttribLocation(program, 'aPos')
gl.enableVertexAttribArray(aPos)
gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

const u = Object.fromEntries(
  ['uRes', 'uTime', 'uFocal', 'uPitch', 'uSun', 'uMoon', 'uMoonLit', 'uSunAlt', 'uCover', 'uRain', 'uSnow', 'uFog', 'uStorm', 'uDrift'].map(
    (n) => [n, gl.getUniformLocation(program, n)],
  ),
)

function resize() {
  const scale = Math.min(devicePixelRatio, 1.25)
  canvas.width = Math.round(innerWidth * scale)
  canvas.height = Math.round(innerHeight * scale)
  gl!.viewport(0, 0, canvas.width, canvas.height)
}
addEventListener('resize', resize)
resize()

// Everything the shader sees, as plain numbers so a city change can glide between two states.
interface Look {
  sunAlt: number
  sunX: number
  sunY: number
  sunZ: number
  moonX: number
  moonY: number
  moonZ: number
  moonLit: number
  low: number
  mid: number
  high: number
  rain: number
  snow: number
  fog: number
  storm: number
  windX: number
  windY: number
}

function toCamera(azimuth: number, altitude: number, viewAz: number) {
  const a = (azimuth - viewAz) * RAD
  const h = altitude * RAD
  return { x: Math.cos(h) * Math.sin(a), y: Math.sin(h), z: Math.cos(h) * Math.cos(a) }
}

function lookFor(index: number, now: Date): Look {
  const city = cities[index]
  const sun = getPosition(now, city.lat, city.lon)
  const moon = getMoonPosition(now, city.lat, city.lon)
  // Face the sun, or the moon once it is properly dark, nudged right of the text.
  const faceMoon = sun.altitude < -12 && moon.altitude > 0
  const viewAz = (faceMoon ? moon.azimuth : sun.azimuth) - 14
  const s = toCamera(sun.azimuth, sun.altitude, viewAz)
  const m = toCamera(moon.azimuth, moon.altitude, viewAz)
  const c = conditions[index]?.current
  const look: Look = {
    sunAlt: sun.altitude,
    sunX: s.x, sunY: s.y, sunZ: s.z,
    moonX: m.x, moonY: m.y, moonZ: m.z,
    moonLit: getMoonIllumination(now).fraction,
    low: 0.15, mid: 0.1, high: 0.25,
    rain: 0, snow: 0, fog: 0, storm: 0,
    windX: 1.5, windY: 0.5,
  }
  if (!c) return look
  const code = c.weather_code
  const wet = (lo: number, hi: number) => code >= lo && code <= hi
  look.low = c.cloud_cover_low / 100
  look.mid = c.cloud_cover_mid / 100
  look.high = c.cloud_cover_high / 100
  look.rain = Math.max(Math.min(c.rain / 4, 1), wet(51, 67) || wet(80, 82) || code >= 95 ? 0.35 : 0)
  look.snow = Math.max(Math.min(c.snowfall / 1.5, 1), wet(71, 77) || wet(85, 86) ? 0.4 : 0)
  look.fog = Math.min(1, Math.max(0, 1 - (c.visibility - 1000) / 19000)) ** 2
  look.storm = code >= 95 ? 1 : 0
  // Direction is where the wind comes from; clouds travel the other way.
  const to = (c.wind_direction_10m + 180 - viewAz) * RAD
  look.windX = Math.sin(to) * c.wind_speed_10m
  look.windY = Math.cos(to) * c.wind_speed_10m
  return look
}

let conditions: (Conditions | undefined)[] = []
let index = sunsetCity()
let shown: Look = lookFor(index, now())
let target: Look = shown

async function refresh() {
  try {
    conditions = await fetchCurrent(cities)
  } catch (e) {
    console.warn('Weather request failed; showing the sky from sun position only.', e)
  }
  sinceLook = Infinity
  render()
}

function render() {
  const city = cities[index]
  const c = conditions[index]
  cityEl.textContent = city.name
  tempEl.textContent = c ? `${Math.round(c.current.temperature_2m)}°` : '–'
  const offset = c?.utcOffset ?? Math.round(city.lon / 15) * 3600
  detailEl.textContent = c ? `${describe(c.current.weather_code)}, ${localTime(offset, now())}` : localTime(offset, now())
}

function go(step: number) {
  index = (index + step + cities.length) % cities.length
  hint.classList.add('gone')
  readout.classList.add('leaving')
  setTimeout(() => {
    render()
    readout.classList.remove('leaving')
  }, 350)
}

let startX = 0
addEventListener('pointerdown', (e) => (startX = e.clientX))
addEventListener('pointerup', (e) => {
  const dx = e.clientX - startX
  if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1)
})
addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight') go(1)
  if (e.key === 'ArrowLeft') go(-1)
})

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
const drift = { x: 0, y: 0 }
let last = performance.now()
let sinceLook = Infinity

function frame(t: number) {
  const dt = Math.min((t - last) / 1000, 0.1)
  last = t
  sinceLook += dt
  if (sinceLook > 1) {
    target = lookFor(index, now())
    sinceLook = 0
  }
  const k = 1 - Math.exp(-dt * 1.6)
  const next = { ...shown }
  for (const key of Object.keys(target) as (keyof Look)[]) next[key] += (target[key] - shown[key]) * k
  shown = next

  const speed = reduceMotion ? 0.1 : 1
  drift.x -= (shown.windX * DRIFT_SPEEDUP * dt * speed) / 1000
  drift.y -= (shown.windY * DRIFT_SPEEDUP * dt * speed) / 1000

  const sun = Math.hypot(shown.sunX, shown.sunY, shown.sunZ)
  const moon = Math.hypot(shown.moonX, shown.moonY, shown.moonZ)
  gl!.uniform2f(u.uRes, canvas.width, canvas.height)
  gl!.uniform1f(u.uTime, reduceMotion ? 0 : t / 1000)
  gl!.uniform1f(u.uFocal, FOCAL)
  gl!.uniform1f(u.uPitch, PITCH)
  gl!.uniform3f(u.uSun, shown.sunX / sun, shown.sunY / sun, shown.sunZ / sun)
  gl!.uniform3f(u.uMoon, shown.moonX / moon, shown.moonY / moon, shown.moonZ / moon)
  gl!.uniform1f(u.uMoonLit, shown.moonLit)
  gl!.uniform1f(u.uSunAlt, shown.sunAlt)
  gl!.uniform3f(u.uCover, shown.low, shown.mid, shown.high)
  gl!.uniform1f(u.uRain, shown.rain)
  gl!.uniform1f(u.uSnow, shown.snow)
  gl!.uniform1f(u.uFog, shown.fog)
  gl!.uniform1f(u.uStorm, shown.storm)
  gl!.uniform2f(u.uDrift, drift.x, drift.y)
  gl!.drawArrays(gl!.TRIANGLES, 0, 3)
  requestAnimationFrame(frame)
}

render()
refresh()
setInterval(refresh, 10 * 60_000)
setInterval(render, 30_000)
setTimeout(() => hint.classList.add('gone'), 6000)
requestAnimationFrame(frame)
