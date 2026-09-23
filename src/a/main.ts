import '../shared/base.css'
import './style.css'
import { geoCircle, geoGraticule10, geoOrthographic, geoPath, type GeoPermissibleObjects } from 'd3-geo'
import { feature } from 'topojson-client'
import land110 from 'world-atlas/land-110m.json'
import type { Topology } from 'topojson-specification'
import { cities, distanceKm } from '../shared/cities'
import { addSignature } from '../shared/signature'
import { describe, fetchPoint } from '../shared/weather'

const RAD = Math.PI / 180
const WIND_MAX = 50
const STEP = 0.011 // degrees per (m/s) per frame
const FADE = 0.94

const base = document.createElement('canvas')
const trails = document.createElement('canvas')
for (const c of [base, trails]) {
  c.setAttribute('aria-hidden', 'true')
  document.body.appendChild(c)
}
const bctx = base.getContext('2d')!
const tctx = trails.getContext('2d')!

const title = document.createElement('h1')
title.className = 'title'
title.textContent = 'Surface wind'
const stamp = document.createElement('span')
title.appendChild(stamp)
document.body.appendChild(title)

const hint = document.createElement('p')
hint.className = 'hint'
hint.textContent = 'Drag to turn, tap anywhere for its weather'
document.body.appendChild(hint)
addSignature()

const land = feature(land110 as unknown as Topology, (land110 as unknown as Topology).objects.land) as GeoPermissibleObjects
const graticule = geoGraticule10()

const projection = geoOrthographic().rotate([-20, -25]).precision(0.3).scale(0)
let dpr = 1
let width = 0
let height = 0
let minScale = 1
function resize() {
  dpr = Math.min(devicePixelRatio, 2)
  width = innerWidth
  height = innerHeight
  for (const c of [base, trails]) {
    c.width = Math.round(width * dpr)
    c.height = Math.round(height * dpr)
  }
  minScale = Math.min(width, height) * 0.45
  projection.translate([width / 2, height / 2]).scale(Math.max(projection.scale(), minScale))
  moved()
}

// ---- Wind field -------------------------------------------------------------

let wind: Uint8ClampedArray | null = null
const W = 1440
const H = 721

async function loadWind() {
  const [img, meta] = await Promise.all([
    fetch('/data/wind.png').then((r) => r.blob()).then((b) => createImageBitmap(b, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' })),
    fetch('/data/gfs.json').then((r) => r.json() as Promise<{ valid: string }>),
  ])
  const c = new OffscreenCanvas(W, H)
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0)
  wind = ctx.getImageData(0, 0, W, H).data
  const valid = new Date(meta.valid)
  stamp.textContent = `GFS, ${valid.toUTCString().slice(17, 22)} UTC`
}

/** Bilinear u/v in m/s at a point. */
function sample(lon: number, lat: number, out: [number, number]) {
  const x = (((lon + 180) % 360) + 360) % 360 / 0.25
  const y = Math.min(Math.max((90 - lat) / 0.25, 0), H - 1.001)
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const fx = x - x0
  const fy = y - y0
  const x1 = (x0 + 1) % W
  const i00 = (y0 * W + x0) * 4
  const i10 = (y0 * W + x1) * 4
  const i01 = ((y0 + 1) * W + x0) * 4
  const i11 = ((y0 + 1) * W + x1) * 4
  const d = wind!
  for (let k = 0; k < 2; k++) {
    const top = d[i00 + k] * (1 - fx) + d[i10 + k] * fx
    const bottom = d[i01 + k] * (1 - fx) + d[i11 + k] * fx
    out[k] = ((top * (1 - fy) + bottom * fy) / 255) * 2 * WIND_MAX - WIND_MAX
  }
  return out
}

// ---- Particles --------------------------------------------------------------

// Speed buckets, from calm blue-grey through white to a warm amber for gales.
const COLOURS = ['#3d5a78', '#5f86a8', '#8fb4cf', '#c3dbe8', '#eef4f8', '#ffe6bf', '#ffc27a', '#ff8f4d']
const BUCKET = 3.2 // m/s per colour step

let count = 0
let lon = new Float32Array(0)
let lat = new Float32Array(0)
let age = new Uint16Array(0)
let px = new Float32Array(0)
let py = new Float32Array(0)
const uv: [number, number] = [0, 0]

function visible(lo: number, la: number) {
  const [rl, rp] = projection.rotate()
  const c = -rl * RAD
  const p = -rp * RAD
  return (
    Math.sin(la * RAD) * Math.sin(p) + Math.cos(la * RAD) * Math.cos(p) * Math.cos(lo * RAD - c) > 0.08
  )
}

function spawn(i: number) {
  // A uniform point on the visible part of the disc, so density matches what you see.
  const [cx, cy] = projection.translate()
  const r = projection.scale()
  const x0 = Math.max(0, cx - r)
  const x1 = Math.min(width, cx + r)
  const y0 = Math.max(0, cy - r)
  const y1 = Math.min(height, cy + r)
  for (let tries = 0; tries < 8; tries++) {
    const x = x0 + Math.random() * (x1 - x0)
    const y = y0 + Math.random() * (y1 - y0)
    if (Math.hypot(x - cx, y - cy) > r) continue
    const g = projection.invert!([x, y])
    if (g && Number.isFinite(g[0])) {
      lon[i] = g[0]
      lat[i] = g[1]
      break
    }
  }
  age[i] = Math.floor(Math.random() * 90) + 30
  px[i] = NaN
}

function seed() {
  const zoom = projection.scale() / minScale
  count = Math.round(Math.min(7000, (width * height) / 140) * Math.min(zoom, 1.6))
  lon = new Float32Array(count)
  lat = new Float32Array(count)
  age = new Uint16Array(count)
  px = new Float32Array(count)
  py = new Float32Array(count)
  for (let i = 0; i < count; i++) spawn(i)
}

const paths: Path2D[] = COLOURS.map(() => new Path2D())

function step() {
  for (let b = 0; b < paths.length; b++) paths[b] = new Path2D()
  const zoom = projection.scale() / minScale
  const k = STEP / Math.sqrt(zoom)
  for (let i = 0; i < count; i++) {
    if (age[i]-- === 0 || !visible(lon[i], lat[i])) {
      spawn(i)
      continue
    }
    sample(lon[i], lat[i], uv)
    const speed = Math.hypot(uv[0], uv[1])
    lon[i] += (uv[0] * k) / Math.max(Math.cos(lat[i] * RAD), 0.1)
    lat[i] = Math.max(-89, Math.min(89, lat[i] + uv[1] * k))
    const p = projection([lon[i], lat[i]])!
    if (!Number.isNaN(px[i])) {
      const path = paths[Math.min(COLOURS.length - 1, Math.floor(speed / BUCKET))]
      path.moveTo(px[i] * dpr, py[i] * dpr)
      path.lineTo(p[0] * dpr, p[1] * dpr)
    }
    px[i] = p[0]
    py[i] = p[1]
  }
  tctx.globalCompositeOperation = 'destination-in'
  tctx.fillStyle = `rgba(0,0,0,${FADE})`
  tctx.fillRect(0, 0, trails.width, trails.height)
  tctx.globalCompositeOperation = 'source-over'
  tctx.lineWidth = 1.1 * dpr
  tctx.lineCap = 'round'
  paths.forEach((path, b) => {
    tctx.strokeStyle = COLOURS[b]
    tctx.stroke(path)
  })
}

// ---- Globe ------------------------------------------------------------------

function subsolar(date: Date): [number, number] {
  const d = (date.getTime() - Date.UTC(2000, 0, 1, 12)) / 864e5
  const g = (357.529 + 0.98560028 * d) * RAD
  const q = 280.459 + 0.98564736 * d
  const l = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD
  const e = (23.439 - 0.00000036 * d) * RAD
  const ra = Math.atan2(Math.cos(e) * Math.sin(l), Math.cos(l)) / RAD
  const dec = Math.asin(Math.sin(e) * Math.sin(l)) / RAD
  const gmst = (18.697374558 + 24.06570982441908 * d) % 24
  const lon = ((((ra - gmst * 15) % 360) + 540) % 360) - 180
  return [lon, dec]
}

let marker: [number, number] | null = null

function drawBase() {
  const path = geoPath(projection, bctx)
  bctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  bctx.clearRect(0, 0, width, height)
  const [cx, cy] = projection.translate()
  const r = projection.scale()

  const glow = bctx.createRadialGradient(cx, cy, r * 0.98, cx, cy, r * 1.12)
  glow.addColorStop(0, 'rgba(90,140,200,0.18)')
  glow.addColorStop(1, 'rgba(90,140,200,0)')
  bctx.fillStyle = glow
  bctx.fillRect(0, 0, width, height)

  bctx.beginPath()
  path({ type: 'Sphere' })
  bctx.fillStyle = '#060a11'
  bctx.fill()

  bctx.beginPath()
  path(graticule)
  bctx.strokeStyle = 'rgba(160,190,230,0.05)'
  bctx.lineWidth = 0.6
  bctx.stroke()

  bctx.beginPath()
  path(land)
  bctx.fillStyle = '#172231'
  bctx.fill()
  bctx.strokeStyle = 'rgba(200,220,245,0.22)'
  bctx.lineWidth = 0.7
  bctx.stroke()

  const [sl, sp] = subsolar(new Date())
  bctx.beginPath()
  path(geoCircle().center([sl + 180, -sp]).radius(90)())
  bctx.fillStyle = 'rgba(0,0,6,0.42)'
  bctx.fill()

  if (marker && visible(marker[0], marker[1])) {
    const p = projection(marker)!
    bctx.beginPath()
    bctx.arc(p[0], p[1], 7, 0, Math.PI * 2)
    bctx.strokeStyle = '#fff'
    bctx.lineWidth = 1.5
    bctx.stroke()
  }
}

// ---- Interaction ------------------------------------------------------------

const pointers = new Map<number, { x: number; y: number }>()
let moving = false
let settleAt = 0
let travel = 0
let pinch = 0
let lastInput = performance.now()

function moved() {
  // Trails are drawn in screen space, so any camera change invalidates them.
  moving = true
  settleAt = performance.now() + 140
  tctx.clearRect(0, 0, trails.width, trails.height)
  drawBase()
}

function zoomBy(factor: number) {
  projection.scale(Math.min(minScale * 6, Math.max(minScale, projection.scale() * factor)))
  moved()
}

addEventListener('pointerdown', (e) => {
  if ((e.target as Element).closest('.panel, .signature')) return
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
  travel = 0
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()]
    pinch = Math.hypot(a.x - b.x, a.y - b.y)
  }
})

addEventListener('pointermove', (e) => {
  const prev = pointers.get(e.pointerId)
  if (!prev) return
  const next = { x: e.clientX, y: e.clientY }
  pointers.set(e.pointerId, next)
  lastInput = performance.now()
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()]
    const d = Math.hypot(a.x - b.x, a.y - b.y)
    if (pinch) zoomBy(d / pinch)
    pinch = d
    travel += 10
    return
  }
  const dx = next.x - prev.x
  const dy = next.y - prev.y
  travel += Math.abs(dx) + Math.abs(dy)
  if (travel < 4) return
  const k = 75 / projection.scale()
  const [l, p] = projection.rotate()
  projection.rotate([l + dx * k, Math.max(-85, Math.min(85, p - dy * k))])
  hint.classList.add('gone')
  moved()
})

function release(e: PointerEvent) {
  if (!pointers.delete(e.pointerId)) return
  if (pointers.size < 2) pinch = 0
  if (travel < 6 && e.type === 'pointerup') select(e.clientX, e.clientY)
  travel = 99
}
addEventListener('pointerup', release)
addEventListener('pointercancel', release)

addEventListener(
  'wheel',
  (e) => {
    e.preventDefault()
    lastInput = performance.now()
    zoomBy(Math.exp(-e.deltaY * 0.0015))
  },
  { passive: false },
)

// ---- Panel ------------------------------------------------------------------

const panel = document.createElement('section')
panel.className = 'panel'
panel.setAttribute('aria-live', 'polite')
const close = document.createElement('button')
close.className = 'close'
close.setAttribute('aria-label', 'Close')
close.textContent = '×'
const nameEl = document.createElement('h2')
const whereEl = document.createElement('p')
whereEl.className = 'where'
const nowEl = document.createElement('div')
nowEl.className = 'now'
const tempEl = document.createElement('span')
tempEl.className = 'temp'
const condEl = document.createElement('span')
condEl.className = 'cond'
nowEl.append(tempEl, condEl)
const windEl = document.createElement('p')
windEl.className = 'wind'
const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
svg.setAttribute('viewBox', '0 0 100 30')
svg.setAttribute('preserveAspectRatio', 'none')
svg.setAttribute('aria-hidden', 'true')
const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline')
line.setAttribute('fill', 'none')
line.setAttribute('stroke', 'rgba(244,246,251,0.8)')
line.setAttribute('stroke-width', '1.5')
line.setAttribute('vector-effect', 'non-scaling-stroke')
svg.appendChild(line)
const hoursEl = document.createElement('div')
hoursEl.className = 'hours'
panel.append(close, nameEl, whereEl, nowEl, windEl, svg, hoursEl)
document.body.appendChild(panel)

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
const compass = (deg: number) => COMPASS[Math.round((((deg % 360) + 360) % 360) / 45) % 8]
const coords = (lo: number, la: number) =>
  `${Math.abs(la).toFixed(1)}° ${la >= 0 ? 'N' : 'S'}, ${Math.abs(lo).toFixed(1)}° ${lo >= 0 ? 'E' : 'W'}`

let request = 0

async function select(x: number, y: number) {
  const g = projection.invert!([x, y])
  if (!g || !visible(g[0], g[1]) || Math.hypot(x - width / 2, y - height / 2) > projection.scale()) {
    closePanel()
    return
  }
  const [lo, la] = g
  marker = [lo, la]
  drawBase()
  hint.classList.add('gone')
  const near = cities
    .map((c) => ({ c, d: distanceKm(c, { lat: la, lon: lo }) }))
    .sort((a, b) => a.d - b.d)[0]
  nameEl.textContent = near.d < 400 ? near.c.name : coords(lo, la)
  whereEl.textContent = near.d < 400 ? coords(lo, la) : ''

  // Wind from the loaded field is instant; the rest arrives from the forecast API.
  if (wind) {
    sample(lo, la, uv)
    const from = (Math.atan2(-uv[0], -uv[1]) / RAD + 360) % 360
    windEl.textContent = `Wind ${Math.hypot(uv[0], uv[1]).toFixed(0)} m/s from the ${compass(from)}`
  }
  tempEl.textContent = '…'
  condEl.textContent = ''
  line.setAttribute('points', '')
  hoursEl.textContent = ''
  panel.classList.add('open')

  const id = ++request
  try {
    const c = await fetchPoint(la, lo)
    if (id !== request) return
    tempEl.textContent = `${Math.round(c.current.temperature_2m)}°`
    condEl.textContent = describe(c.current.weather_code)
    windEl.textContent = `Wind ${c.current.wind_speed_10m.toFixed(0)} m/s from the ${compass(c.current.wind_direction_10m)}`
    const temps = c.hourly?.temperature_2m ?? []
    if (temps.length > 1) {
      const lo2 = Math.min(...temps)
      const hi = Math.max(...temps)
      const span = Math.max(hi - lo2, 1)
      line.setAttribute(
        'points',
        temps.map((t, i) => `${(i / (temps.length - 1)) * 100},${27 - ((t - lo2) / span) * 24}`).join(' '),
      )
      hoursEl.replaceChildren(
        ...['Now', '+6 h', '+12 h'].map((s) => Object.assign(document.createElement('span'), { textContent: s })),
      )
    }
  } catch {
    if (id === request) condEl.textContent = 'Forecast unavailable right now'
  }
}

function closePanel() {
  request++
  marker = null
  panel.classList.remove('open')
  drawBase()
}
close.addEventListener('click', closePanel)
addEventListener('keydown', (e) => e.key === 'Escape' && closePanel())

// ---- Loop -------------------------------------------------------------------

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
let lastFrame = performance.now()

function frame(t: number) {
  const dt = Math.min((t - lastFrame) / 1000, 0.1)
  lastFrame = t
  const idle = t - lastInput > 4000 && pointers.size === 0 && !panel.classList.contains('open')
  if (idle && !reduceMotion) {
    const [l, p] = projection.rotate()
    projection.rotate([l + dt * 1.2, p])
    drawBase()
  }
  if (moving && pointers.size === 0 && t > settleAt) {
    moving = false
    seed()
  }
  if (!moving && wind) step()
  requestAnimationFrame(frame)
}

addEventListener('resize', resize)
resize()
setTimeout(() => hint.classList.add('gone'), 7000)
loadWind()
  .then(() => {
    moved()
    requestAnimationFrame(frame)
  })
  .catch((e) => {
    stamp.textContent = 'Wind data could not be loaded'
    console.error(e)
  })
