import '../shared/base.css'
import '../b/style.css'
import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { HorizontalTiltShiftShader } from 'three/addons/shaders/HorizontalTiltShiftShader.js'
import { VerticalTiltShiftShader } from 'three/addons/shaders/VerticalTiltShiftShader.js'
import { getMoonPosition, getPosition } from 'suncalc'
import { cities, sunsetCity } from '../shared/cities'
import { addSignature } from '../shared/signature'
import { describe, fetchCurrent, localTime, type Conditions } from '../shared/weather'
import { createSky } from './dome'
import { R, type Island } from './island'
import { buildIstanbul } from './istanbul'
import { buildLondon } from './london'
import { buildNewYork } from './newyork'
import { buildParis } from './paris'
import { buildTokyo } from './tokyo'
import { materials, random, world } from './kit'
import { createSound } from './sound'

const RAD = Math.PI / 180
const params = new URLSearchParams(location.search)
// Debug: ?shift=<hours> previews another time of day, ?w=<kind> forces the weather.
const shift = Number(params.get('shift') ?? 0) * 3600_000
const forced = params.get('w')
const now = () => new Date(Date.now() + shift)
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches

// ---- Page -------------------------------------------------------------------

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' })
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFShadowMap
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.05
renderer.domElement.setAttribute('aria-hidden', 'true')
document.body.appendChild(renderer.domElement)

const readout = document.createElement('section')
readout.className = 'readout'
readout.setAttribute('aria-live', 'polite')
const cityEl = Object.assign(document.createElement('h1'), { className: 'city' })
const tempEl = Object.assign(document.createElement('p'), { className: 'temp' })
const detailEl = Object.assign(document.createElement('p'), { className: 'detail' })
readout.append(cityEl, tempEl, detailEl)
document.body.appendChild(readout)
addSignature()

const nav = document.createElement('nav')
nav.className = 'step'
nav.setAttribute('aria-label', 'Cities')
nav.innerHTML = '<button type="button" aria-label="Previous city">‹</button><button type="button" aria-label="Next city">›</button>'
document.body.appendChild(nav)
const sound = createSound()

// ---- Scene ------------------------------------------------------------------

const scene = new THREE.Scene()
const fog = new THREE.Fog(0x000000, 30, 80)
scene.fog = fog

const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 200)
const controls = new OrbitControls(camera, renderer.domElement)
controls.target.set(0, 0.2, 0)
controls.enableDamping = true
controls.enablePan = false
controls.autoRotate = !reduced
controls.autoRotateSpeed = 0.35
controls.minPolarAngle = 0.35
controls.maxPolarAngle = 1.35

const sky = createSky()
scene.add(sky.mesh)

const hemi = new THREE.HemisphereLight(0xffffff, 0x3a3128, 1)
const key = new THREE.DirectionalLight(0xffffff, 2)
key.castShadow = true
key.shadow.mapSize.setScalar(2048)
Object.assign(key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 50 })
key.shadow.bias = -0.0008
key.shadow.normalBias = 0.02
key.shadow.radius = 5
scene.add(hemi, key, key.target)

// The islands, west to east. Each is built the first time it is shown.
const builders: Record<string, () => Island> = {
  'New York': buildNewYork,
  London: buildLondon,
  Paris: buildParis,
  Istanbul: buildIstanbul,
  Tokyo: buildTokyo,
}
const places = cities.filter((c) => c.name in builders)
const built: Island[] = []
const islandAt = (i: number) => (built[i] ??= builders[places[i].name]())

// Debug: ?city=<name> opens that island instead of the one nearest sunset.
const asked = places.findIndex((c) => c.name.toLowerCase() === params.get('city')?.toLowerCase())
let index = asked >= 0 ? asked : sunsetCity(now(), places)
let island = islandAt(index)
scene.add(island.group)

// Clouds: soft clusters of puffs that drift with the wind and cast shadows.
const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true })
const clouds: THREE.Mesh<THREE.BufferGeometry, THREE.MeshLambertMaterial>[] = []
{
  const r = random(21)
  const puff = new THREE.SphereGeometry(1, 18, 12)
  for (let i = 0; i < 12; i++) {
    const parts: THREE.BufferGeometry[] = []
    const n = 4 + Math.floor(r() * 4)
    for (let j = 0; j < n; j++) {
      const s = 0.45 + r() * 0.45 * (1 - Math.abs(j - n / 2) / n)
      const g = puff.clone()
      g.scale(s, s * 0.8, s)
      g.translate((j - (n - 1) / 2) * 0.55 + (r() - 0.5) * 0.2, s * 0.25 + r() * 0.15, (r() - 0.5) * 0.6)
      parts.push(g)
    }
    const cloud = new THREE.Mesh(mergeAll(parts), cloudMat.clone())
    cloud.castShadow = true
    cloud.rotation.y = r() * Math.PI
    cloud.position.set((r() - 0.5) * 18, 3.6 + r() * 1.4, (r() - 0.5) * 18)
    cloud.scale.setScalar(0.5 + r() * 0.35)
    scene.add(cloud)
    clouds.push(cloud)
  }
}

function mergeAll(parts: THREE.BufferGeometry[]) {
  const out = new THREE.BufferGeometry()
  const attrs = ['position', 'normal'] as const
  for (const name of attrs) {
    const arrays = parts.map((p) => (p.index ? p.toNonIndexed() : p).attributes[name].array as Float32Array)
    const merged = new Float32Array(arrays.reduce((n, a) => n + a.length, 0))
    let o = 0
    for (const a of arrays) merged.set(a, (o += a.length) - a.length)
    out.setAttribute(name, new THREE.BufferAttribute(merged, 3))
  }
  return out
}

// Rain as short streaks slanted by the wind; snow as soft round flakes.
const DROPS = 1600
const HEIGHT = 7
const rainPos = new Float32Array(DROPS * 6)
const flakePos = new Float32Array(DROPS * 3)
const drops = new Float32Array(DROPS * 3)
{
  const r = random(5)
  for (let i = 0; i < DROPS; i++) {
    const a = r() * Math.PI * 2
    const d = Math.sqrt(r()) * (R + 0.5)
    drops.set([Math.cos(a) * d, r() * HEIGHT, Math.sin(a) * d], i * 3)
  }
}
const rainGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(rainPos, 3))
const snowGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(flakePos, 3))
const rainMat = new THREE.LineBasicMaterial({ color: 0xc4d2e6, transparent: true, depthWrite: false })
const snowMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.09, map: flakeTexture(), transparent: true, depthWrite: false })
const rain = new THREE.LineSegments(rainGeo, rainMat)
const snow = new THREE.Points(snowGeo, snowMat)
rain.frustumCulled = snow.frustumCulled = false
scene.add(rain, snow)

function flakeTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 32
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.5, 'rgba(255,255,255,0.7)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 32, 32)
  return new THREE.CanvasTexture(c)
}

// ---- Post-processing: a light tilt-shift sells the miniature ----------------

const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 })
const composer = new EffectComposer(renderer, target)
composer.addPass(new RenderPass(scene, camera))
const blurX = new ShaderPass(HorizontalTiltShiftShader)
const blurY = new ShaderPass(VerticalTiltShiftShader)
composer.addPass(blurX)
composer.addPass(blurY)
composer.addPass(new OutputPass())

// ---- Weather state ----------------------------------------------------------

const KEYS = [-18, -9, -4, 0, 5, 12, 30]
const ZENITH = ['#070b1a', '#0c1430', '#1a2957', '#2e4a87', '#335ca8', '#366bc7', '#296bdb'].map((c) => new THREE.Color(c))
const HORIZON = ['#111830', '#1e2548', '#574d80', '#a8809e', '#ccadad', '#b8cce6', '#bdd9f5'].map((c) => new THREE.Color(c))
function keyed(palette: THREE.Color[], alt: number, out: THREE.Color) {
  if (alt <= KEYS[0]) return out.copy(palette[0])
  for (let i = 0; i < KEYS.length - 1; i++) {
    if (alt < KEYS[i + 1]) return out.lerpColors(palette[i], palette[i + 1], (alt - KEYS[i]) / (KEYS[i + 1] - KEYS[i]))
  }
  return out.copy(palette[palette.length - 1])
}

interface Look {
  alt: number
  az: number
  moonAlt: number
  moonAz: number
  moonLit: number
  cover: number
  rain: number
  snow: number
  fog: number
  storm: number
  wind: number
  windTo: number
}

const FORCED: Record<string, Partial<Look>> = {
  clear: { cover: 0.1, rain: 0, snow: 0, fog: 0, storm: 0, wind: 3 },
  overcast: { cover: 1, rain: 0, snow: 0, fog: 0, storm: 0, wind: 5 },
  rain: { cover: 0.9, rain: 0.7, snow: 0, fog: 0.1, storm: 0, wind: 7 },
  storm: { cover: 1, rain: 1, snow: 0, fog: 0.1, storm: 1, wind: 14 },
  snow: { cover: 0.85, rain: 0, snow: 0.8, fog: 0.15, storm: 0, wind: 3 },
  fog: { cover: 0.5, rain: 0, snow: 0, fog: 0.9, storm: 0, wind: 1 },
}

let conditions: Conditions[] = []

function lookFor(): Look {
  const c = places[index]
  const t = now()
  const s = getPosition(t, c.lat, c.lon)
  const m = getMoonPosition(t, c.lat, c.lon)
  const w = conditions[index]?.current
  const code = w?.weather_code ?? 0
  const within = (lo: number, hi: number) => code >= lo && code <= hi
  const look: Look = {
    alt: s.altitude,
    az: s.azimuth,
    moonAlt: m.altitude,
    moonAz: m.azimuth,
    moonLit: 1,
    cover: w ? w.cloud_cover / 100 : 0.3,
    rain: w ? Math.max(Math.min(w.rain / 4, 1), within(51, 67) || within(80, 82) || code >= 95 ? 0.35 : 0) : 0,
    snow: w ? Math.max(Math.min(w.snowfall / 1.5, 1), within(71, 77) || within(85, 86) ? 0.4 : 0) : 0,
    fog: w ? Math.max(Math.min(1, Math.max(0, 1 - (w.visibility - 1000) / 19000)) ** 2, within(45, 48) ? 0.8 : 0) : 0,
    storm: code >= 95 ? 1 : 0,
    wind: w?.wind_speed_10m ?? 2,
    windTo: ((w?.wind_direction_10m ?? 200) + 180) % 360,
  }
  return forced && FORCED[forced] ? { ...look, ...FORCED[forced] } : look
}

let shown = lookFor()
let aim = shown

function toVector(az: number, alt: number, out: THREE.Vector3) {
  return out.set(Math.cos(alt * RAD) * Math.sin(az * RAD), Math.sin(alt * RAD), -Math.cos(alt * RAD) * Math.cos(az * RAD))
}

const grey = new THREE.Color()
function greyed(c: THREE.Color, gloom: number) {
  const l = c.r * 0.3 + c.g * 0.55 + c.b * 0.15
  return c.lerp(grey.setRGB(l * 0.85, l * 0.9, l), gloom * 0.8)
}

const horizon = new THREE.Color()
const sunDir = new THREE.Vector3()
const moonDir = new THREE.Vector3()
const lightDir = new THREE.Vector3()
const warm = new THREE.Color()
const cool = new THREE.Color(0x8fa6d6)
const led = new THREE.Color()
const seen = new THREE.Vector3()
let flash = 0
let nextFlash = 3

function apply(l: Look, t: number, dt: number) {
  const day = THREE.MathUtils.smoothstep(l.alt, -6, 6)
  const night = 1 - THREE.MathUtils.smoothstep(l.alt, -12, -2)
  const gloom = Math.max(l.cover * 0.65, l.rain * 0.9, l.snow * 0.7, l.fog * 0.6)

  // Lightning: brief double flashes at random intervals during a storm.
  nextFlash -= dt
  if (l.storm > 0.5 && nextFlash < 0) {
    flash = 1
    nextFlash = 2 + Math.random() * 7
    sound.thunder()
  }
  const strobe = flash * (0.6 + 0.4 * Math.sin(t * 60))
  flash = Math.max(0, flash - dt * 3.5)

  const u = sky.uniforms
  greyed(keyed(HORIZON, l.alt, u.uHorizon.value), gloom)
  greyed(keyed(ZENITH, l.alt, u.uZenith.value), gloom)
  u.uBelow.value.copy(u.uHorizon.value).lerp(u.uZenith.value, 0.45)
  horizon.copy(u.uHorizon.value)
  u.uHorizon.value.lerp(grey.setScalar(0.55 * (0.15 + 0.85 * day)), l.fog * 0.5)
  toVector(l.az, l.alt, sunDir)
  toVector(l.moonAz, l.moonAlt, moonDir)
  u.uSun.value.copy(sunDir)
  warm.setHSL(0.075, 0.85, 0.45 + 0.35 * THREE.MathUtils.smoothstep(l.alt, 0, 30))
  u.uSunColor.value.copy(warm).multiplyScalar(THREE.MathUtils.smoothstep(l.alt, -4, 2) * (1 - gloom * 0.85))
  u.uMoon.value.copy(moonDir)
  u.uMoonLight.value = THREE.MathUtils.smoothstep(l.moonAlt, -2, 4) * (0.3 + 0.7 * night) * (1 - gloom * 0.9)
  u.uStars.value = night * (1 - Math.min(1, gloom * 1.3))
  u.uFlash.value = strobe * 0.8
  u.uTime.value = t

  fog.color.copy(u.uHorizon.value)
  fog.near = THREE.MathUtils.lerp(30, 6, l.fog)
  fog.far = THREE.MathUtils.lerp(80, 26, l.fog)

  // One shadow-casting key light: the sun by day, the moon (or a faint sky glow) by night.
  lightDir.copy(moonDir.y > 0.05 ? moonDir : lightDir.set(0.3, 1, 0.4).normalize()).lerp(sunDir, day)
  lightDir.y = Math.max(lightDir.y, 0.18)
  key.position.copy(lightDir.normalize()).multiplyScalar(20)
  key.color.copy(cool).lerp(warm, day)
  key.intensity = (day * 3.2 + (1 - day) * (moonDir.y > 0 ? 0.55 : 0.2)) * (1 - Math.min(1, gloom * 1.2) * 0.85) + strobe * 3
  key.shadow.radius = 3 + gloom * 10
  hemi.color.copy(horizon).lerp(grey.setScalar(1), 0.35 + 0.25 * (1 - day))
  hemi.groundColor.setHex(0x3a3128).multiplyScalar(0.3 + 0.7 * day)
  renderer.toneMappingExposure = 1.05 - 0.2 * gloom
  hemi.intensity = 0.35 + 1.1 * day * (1 - gloom * 0.25) + strobe * 1.5

  materials.walls.emissiveIntensity = 1.6 * night + 0.5 * gloom * (1 - day)
  world.uGlow.value = night
  led.setHSL((t * 0.03) % 1, 0.8, 0.55)
  materials.leds.emissive.copy(led).multiplyScalar(night * 1.4)

  const snowTarget = l.snow > 0.05 ? 0.9 : 0
  world.uSnow.value += (snowTarget - world.uSnow.value) * Math.min(1, dt * (snowTarget ? 0.15 : 0.05))
  const wind = world.uWind.value.set(Math.sin(l.windTo * RAD), -Math.cos(l.windTo * RAD)).multiplyScalar(l.wind)
  world.uTime.value = t

  // Clouds: cover decides how many are out; gloom greys them.
  const out = Math.round(1 + l.cover * (clouds.length - 1))
  const speed = (0.1 + l.wind * 0.05) * dt
  clouds.forEach((c, i) => {
    c.visible = i < out
    // Clouds thin out where they would hide the island from the camera.
    const range = camera.position.distanceTo(controls.target)
    const away = c.position.distanceTo(camera.position)
    const p = seen.copy(c.position).project(camera)
    const aside = THREE.MathUtils.smoothstep(Math.hypot(p.x * camera.aspect, p.y), 0.35, 0.9)
    const behind = THREE.MathUtils.smoothstep(away, range * 0.95, range * 1.1)
    c.material.opacity = Math.max(aside, behind) * THREE.MathUtils.smoothstep(away, range * 0.5, range * 0.75)
    c.visible &&= c.material.opacity > 0.01
    c.material.color.setScalar(1 - gloom * 0.45)
    c.material.emissive.copy(horizon).multiplyScalar(0.35 + 0.3 * night)
    c.position.x += wind.x * speed / Math.max(l.wind, 0.1)
    c.position.z += wind.y * speed / Math.max(l.wind, 0.1)
    if (Math.hypot(c.position.x, c.position.z) > 10) {
      c.position.x *= -0.96
      c.position.z *= -0.96
    }
  })

  rain.visible = l.rain > 0.02
  rainMat.opacity = (0.25 + 0.35 * l.rain) * (0.35 + 0.65 * day) + strobe * 0.4
  snow.visible = l.snow > 0.02
  snowMat.opacity = 0.9 * Math.min(1, l.snow * 1.5)
  if (rain.visible || snow.visible) fall(l, wind, dt)

  island.update(t, wind)
  sound.update({ rain: l.rain, wind: l.wind, night }, dt)
}

function fall(l: Look, wind: THREE.Vector2, dt: number) {
  const rainN = Math.floor(DROPS * Math.min(1, 0.3 + l.rain))
  const snowN = Math.floor(DROPS * Math.min(1, 0.3 + l.snow))
  for (let i = 0; i < DROPS; i++) {
    const k = i * 3
    const y = (drops[k + 1] -= dt * (rain.visible ? 9 : 0.9))
    drops[k] += wind.x * dt * (rain.visible ? 0.15 : 0.12)
    drops[k + 2] += wind.y * dt * (rain.visible ? 0.15 : 0.12)
    if (y < 0.3 || Math.hypot(drops[k], drops[k + 2]) > R + 1) {
      const a = Math.random() * Math.PI * 2
      const d = Math.sqrt(Math.random()) * (R + 0.5)
      drops[k] = Math.cos(a) * d - wind.x * 0.1
      drops[k + 1] = y < 0.3 ? y + HEIGHT : y
      drops[k + 2] = Math.sin(a) * d - wind.y * 0.1
    }
    const hidden = i >= (rain.visible ? rainN : snowN) ? -100 : 0
    const j = i * 6
    rainPos[j] = drops[k]
    rainPos[j + 1] = drops[k + 1] + hidden
    rainPos[j + 2] = drops[k + 2]
    rainPos[j + 3] = drops[k] - wind.x * 0.008
    rainPos[j + 4] = drops[k + 1] + hidden + 0.3
    rainPos[j + 5] = drops[k + 2] - wind.y * 0.008
    flakePos[k] = drops[k] + Math.sin(i + drops[k + 1] * 2) * 0.1
    flakePos[k + 1] = drops[k + 1] + hidden
    flakePos[k + 2] = drops[k + 2]
  }
  rainGeo.attributes.position.needsUpdate = true
  snowGeo.attributes.position.needsUpdate = true
}

// ---- Data -------------------------------------------------------------------

function render() {
  const city = places[index]
  const c = conditions[index]
  cityEl.textContent = city.name
  tempEl.textContent = c ? `${Math.round(c.current.temperature_2m)}°` : '–'
  const time = localTime(c?.utcOffset ?? Math.round(city.lon / 15) * 3600, now())
  detailEl.textContent = c ? `${describe(c.current.weather_code)}, ${time}` : time
}

async function refresh() {
  try {
    conditions = await fetchCurrent(places)
  } catch (e) {
    console.warn('Weather request failed; showing sun and moon only.', e)
  }
  aim = lookFor()
  sinceLook = 0
  render()
}

// ---- Moving between islands -----------------------------------------------

// The old island sinks out of view, then the new one rises into place. A new
// island is built while the stage is empty, where the pause goes unnoticed.
const DEPTH = 12
let sinking: Island | undefined
let sink = 0
let rise = 1

function go(step: number) {
  if (sinking) return
  sinking = island
  sink = 0
  index = (index + step + places.length) % places.length
  aim = lookFor()
  readout.classList.add('leaving')
  setTimeout(() => {
    render()
    readout.classList.remove('leaving')
  }, 350)
}

function travel(dt: number) {
  if (sinking) {
    sink = Math.min(1, sink + dt / 0.8)
    sinking.group.position.y = -DEPTH * sink ** 3
    if (sink < 1) return
    scene.remove(sinking.group)
    sinking = undefined
    island = islandAt(index)
    island.group.position.y = -DEPTH
    scene.add(island.group)
    rise = 0
  }
  if (rise < 1) {
    rise = Math.min(1, rise + dt / 1.1)
    island.group.position.y = -DEPTH * (1 - rise) ** 3
  }
}

const [prevButton, nextButton] = nav.querySelectorAll('button')
prevButton.addEventListener('click', () => go(-1))
nextButton.addEventListener('click', () => go(1))
addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight') go(1)
  if (e.key === 'ArrowLeft') go(-1)
})

// ---- Frame ------------------------------------------------------------------

let framed = false
function resize() {
  const w = innerWidth
  const h = innerHeight
  renderer.setSize(w, h, false)
  composer.setSize(w, h)
  camera.aspect = w / h
  camera.fov = camera.aspect < 0.8 ? 50 : 35
  camera.updateProjectionMatrix()
  // Frame the island's width on narrow screens and its depth on wide ones.
  const halfV = Math.tan((camera.fov * RAD) / 2)
  const fit = Math.max(R * 1.1 / (halfV * camera.aspect), (R * 0.95) / halfV)
  controls.minDistance = fit * 0.55
  controls.maxDistance = fit * 1.4
  const offset = camera.position.clone().sub(controls.target)
  camera.position.copy(controls.target).add(framed ? offset.setLength(fit) : offset.setFromSphericalCoords(fit, camera.aspect < 0.8 ? 0.85 : 1.02, 0.6))
  framed = true
  blurX.uniforms.h.value = 2.4 / w
  blurY.uniforms.v.value = 2.4 / h
  blurX.uniforms.r.value = blurY.uniforms.r.value = 0.5
}
addEventListener('resize', resize)
resize()

let last = performance.now()
let sinceLook = 0
renderer.setAnimationLoop((time) => {
  const dt = Math.min((time - last) / 1000, 0.1)
  last = time
  sinceLook += dt
  if (sinceLook > 5) {
    aim = lookFor()
    sinceLook = 0
  }
  const k = 1 - Math.exp(-dt * 1.5)
  const next = { ...shown }
  for (const name of Object.keys(aim) as (keyof Look)[]) {
    let d = aim[name] - shown[name]
    if (name === 'az' || name === 'moonAz' || name === 'windTo') d = ((d + 540) % 360) - 180
    next[name] += d * k
  }
  shown = next
  travel(dt)
  apply(shown, time / 1000, dt)
  controls.update(dt)
  sky.mesh.position.copy(camera.position)
  composer.render()
})

render()
refresh()
setInterval(refresh, 10 * 60_000)
setInterval(render, 30_000)
