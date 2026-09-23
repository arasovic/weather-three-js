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
import { cities, sunsetCity, type City } from './cities'
import { createGlobe } from './globe'
import { addSignature } from './signature'
import { describe, fetchCurrent, localTime, type Conditions } from './weather'
import { createSky } from './diorama/dome'
import { createBirds } from './diorama/birds'
import { spriteScale } from './diorama/sprites'
import { R, type Island, type Moment } from './diorama/island'
import { buildIstanbul } from './diorama/istanbul'
import { buildLondon } from './diorama/london'
import { buildNewYork } from './diorama/newyork'
import { buildParis } from './diorama/paris'
import { buildTokyo } from './diorama/tokyo'
import { materials, random, world } from './diorama/kit'
import { createSound } from './sound'

const RAD = Math.PI / 180
const params = new URLSearchParams(location.search)
// Debug: ?shift=<hours> previews another time of day, ?w=<kind> forces the weather.
const shift = Number(params.get('shift') ?? 0) * 3600_000
const forced = params.get('w')
// Debug: ?temp=<°C> overrides the temperature the island reacts to.
const forcedTemp = params.has('temp') ? Number(params.get('temp')) : undefined
const now = () => new Date(Date.now() + shift)
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches

// ---- Page -------------------------------------------------------------------

if (!document.createElement('canvas').getContext('webgl2')) {
  document.body.innerHTML = '<p class="fallback">This page is a 3D scene and needs a browser with WebGL 2.</p>'
  throw new Error('WebGL 2 is not available.')
}

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' })
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFShadowMap
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.05
renderer.domElement.setAttribute('aria-hidden', 'true')
document.body.appendChild(renderer.domElement)

const intro = document.createElement('header')
intro.className = 'intro'
intro.innerHTML = '<h1>Weather in miniature</h1><p>Five cities as they are right now. Pick one to visit.</p>'
document.body.appendChild(intro)

const pinLayer = document.createElement('div')
pinLayer.className = 'pins'
document.body.appendChild(pinLayer)

// Fades between the globe and an island, in the colour of the sky being entered.
const veil = document.createElement('div')
veil.className = 'veil'
document.body.appendChild(veil)

const readout = document.createElement('section')
readout.className = 'readout'
readout.setAttribute('aria-live', 'polite')
const cityEl = Object.assign(document.createElement('h1'), { className: 'city' })
const tempEl = Object.assign(document.createElement('p'), { className: 'temp' })
tempEl.setAttribute('aria-hidden', 'true')
// Screen readers get the final temperature, not every step of the count.
const tempLabel = Object.assign(document.createElement('span'), { className: 'visually-hidden' })
const detailEl = Object.assign(document.createElement('p'), { className: 'detail' })
readout.append(cityEl, tempLabel, tempEl, detailEl)
document.body.appendChild(readout)
addSignature()

const nav = document.createElement('nav')
nav.className = 'step'
nav.setAttribute('aria-label', 'Cities')
const chevron = (d: string) =>
  `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`
nav.innerHTML =
  '<button type="button" class="home" aria-label="Back to the globe"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.4 3.8 5.2 3.8 8.5s-1.2 6.1-3.8 8.5c-2.6-2.4-3.8-5.2-3.8-8.5s1.2-6.1 3.8-8.5z"/></svg></button>' +
  `<button type="button" aria-label="Previous city">${chevron('M15 6l-6 6 6 6')}</button>` +
  `<button type="button" aria-label="Next city">${chevron('M9 6l6 6-6 6')}</button>`
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

const birds = createBirds()
scene.add(birds.group)

// A shooting star: a short additive streak that fades in and out.
const streakPos = new Float32Array(6)
const streakGeo = new THREE.BufferGeometry()
streakGeo.setAttribute('position', new THREE.BufferAttribute(streakPos, 3))
streakGeo.setAttribute('color', new THREE.Float32BufferAttribute([1, 1, 1, 0, 0, 0], 3))
const streakMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })
const streak = new THREE.LineSegments(streakGeo, streakMat)
streak.frustumCulled = false
streak.visible = false
scene.add(streak)

// A rainbow: a ring 40-42° around the point opposite the sun, as seen from the camera.
const BOW = 50
const rainbow = new THREE.Mesh(
  new THREE.RingGeometry(BOW * Math.sin(39.5 * RAD), BOW * Math.sin(42.5 * RAD), 128, 1),
  new THREE.ShaderMaterial({
    uniforms: { uOpacity: { value: 0 }, uInner: { value: BOW * Math.sin(39.5 * RAD) }, uOuter: { value: BOW * Math.sin(42.5 * RAD) } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      varying float vR;
      void main() {
        vR = length(position.xy);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform float uInner;
      uniform float uOuter;
      varying float vR;
      void main() {
        float t = (vR - uInner) / (uOuter - uInner);
        vec3 hue = clamp(abs(fract(0.75 * (1.0 - t) + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0) - 1.0, 0.0, 1.0);
        gl_FragColor = vec4(hue * sin(3.14159 * t) * uOpacity, 1.0);
      }`,
  }),
)
rainbow.visible = false
scene.add(rainbow)

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

// An island's address is its name after the hash, e.g. /#new-york.
const slug = (c: City) => c.name.toLowerCase().replace(/ /g, '-')
const fromHash = () => places.findIndex((c) => `#${slug(c)}` === location.hash)
let index = fromHash() >= 0 ? fromHash() : sunsetCity(now(), places)
let island: Island | undefined

const globe = createGlobe(places, pinLayer, pick)

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
const pass = new RenderPass(scene, camera)
composer.addPass(pass)
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
  rainbow: { cover: 0.45, rain: 0.25, snow: 0, fog: 0, storm: 0, wind: 4 },
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

  const clear = (1 - l.cover) * (l.rain < 0.02 && l.snow < 0.02 ? 1 : 0)
  const moment: Moment = { night, day, clear, rain: l.rain, temp: forcedTemp ?? conditions[index]?.current.temperature_2m ?? 15, hour: localHour() }
  island?.update(t, wind, moment)
  sound.update({ rain: l.rain, wind: l.wind, night }, dt)
  touches(l, moment, t, dt)
}

const localHour = () => {
  const offset = conditions[index]?.utcOffset ?? Math.round(places[index].lon / 15) * 3600
  return (((now().getTime() / 1000 + offset) / 3600) % 24 + 24) % 24
}

let wet = 0
let streakAge = 1
let nextStreak = 5
let chimeHour: number | undefined
const streakHead = new THREE.Vector3()
const streakDir = new THREE.Vector3()
const antisolar = new THREE.Vector3()

/** Things that come with the weather: wet sheen, lamps, gulls, shooting stars, a rainbow, the hour bell. */
function touches(l: Look, m: Moment, t: number, dt: number) {
  wet += ((l.rain > 0.05 ? 1 : 0) - wet) * Math.min(1, dt * 0.2)
  materials.clay.roughness = 0.9 - 0.45 * wet
  materials.walls.roughness = 0.85 - 0.4 * wet
  materials.landmark.roughness = 0.75 - 0.35 * wet
  materials.lamps.emissiveIntensity = 2.4 * m.night

  birds.update(t, m.day > 0.6 && m.clear > 0.5 && l.wind < 12)

  nextStreak -= dt
  if (m.night > 0.7 && m.clear > 0.6 && nextStreak < 0) {
    nextStreak = 6 + Math.random() * 14
    streakAge = 0
    streakHead.set(Math.random() * 1.2 - 0.6, 0.55 + Math.random() * 0.3, 0.5).unproject(camera).sub(camera.position).setLength(40).add(camera.position)
    streakDir.set(Math.random() < 0.5 ? -1 : 1, -0.45, 0).applyQuaternion(camera.quaternion).normalize()
  }
  streakAge += dt / 0.8
  streak.visible = streakAge < 1
  if (streak.visible) {
    const fade = Math.sin(Math.PI * streakAge)
    const head = streakHead.clone().addScaledVector(streakDir, streakAge * 9)
    head.toArray(streakPos, 0)
    head.addScaledVector(streakDir, -3 * fade).toArray(streakPos, 3)
    streakGeo.attributes.position.needsUpdate = true
    streakMat.opacity = fade
  }

  const bow =
    THREE.MathUtils.smoothstep(l.rain, 0.02, 0.1) * (1 - THREE.MathUtils.smoothstep(l.rain, 0.5, 0.8)) *
    THREE.MathUtils.smoothstep(l.alt, 2, 8) * (1 - THREE.MathUtils.smoothstep(l.alt, 36, 42)) *
    (1 - THREE.MathUtils.smoothstep(l.cover, 0.7, 0.95))
  rainbow.visible = bow > 0.01
  if (rainbow.visible) {
    antisolar.copy(sunDir).negate()
    rainbow.position.copy(camera.position).addScaledVector(antisolar, BOW * Math.cos(41 * RAD))
    rainbow.lookAt(camera.position)
    rainbow.material.uniforms.uOpacity.value = 0.45 * bow
  }

  const hour = Math.floor(m.hour)
  if (places[index].name === 'London' && chimeHour !== undefined && hour !== chimeHour) sound.chime(hour % 12 || 12)
  chimeHour = hour
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
  const temp = c ? `${Math.round(c.current.temperature_2m)}°` : ''
  cityEl.textContent = city.name
  countTo(c ? Math.round(c.current.temperature_2m) : undefined)
  tempLabel.textContent = temp
  const time = localTime(c?.utcOffset ?? Math.round(city.lon / 15) * 3600, now())
  detailEl.textContent = c ? `${describe(c.current.weather_code)}, ${time}` : time
  document.title = mode === 'island' ? `${city.name} ${temp} | Weather in miniature` : 'Weather in miniature'
}

// The temperature counts up or down to a new value instead of jumping.
let tempShown: number | undefined
let counting = 0
function countTo(value: number | undefined) {
  if (value === undefined || tempShown === undefined || value === tempShown || reduced) {
    tempEl.textContent = value === undefined ? '–' : `${value}°`
    tempShown = value
    return
  }
  const from = tempShown
  const token = ++counting
  tempShown = value
  tween({
    duration: Math.min(1.2, 0.25 + Math.abs(value - from) * 0.06),
    step: (t) => token === counting && (tempEl.textContent = `${Math.round(from + (value - from) * ease(t))}°`),
  })
}

async function refresh() {
  try {
    conditions = await fetchCurrent(places)
  } catch (e) {
    console.warn('Weather request failed; showing sun and moon only.', e)
  }
  globe.setTemps(places.map((_, i) => conditions[i]?.current.temperature_2m))
  aim = lookFor()
  sinceLook = 0
  render()
}

// ---- Globe and islands ----------------------------------------------------------

// The globe dives into a city and the island rises out of the veil; leaving, the
// island sinks and the globe pulls back. Between islands the old one sinks and
// the new one rises. Islands are built while nothing is on stage, where the
// pause goes unnoticed.
type Mode = 'globe' | 'island'
let mode: Mode = 'globe'
let busy = false
const DEPTH = 12
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

interface Tween {
  duration: number
  step: (t: number) => void
  done?: () => void
}
let tweens: (Tween & { t: number })[] = []
const tween = (tw: Tween) => tweens.push({ ...tw, t: 0 })
function runTweens(dt: number) {
  const active = tweens
  tweens = []
  for (const tw of active) {
    tw.t = Math.min(1, tw.t + dt / tw.duration)
    tw.step(tw.t)
    if (tw.t < 1) tweens.push(tw)
    else tw.done?.()
  }
}

const veilColor = new THREE.Color()
function setVeil(opacity: number, color?: THREE.Color) {
  if (color) veil.style.background = `#${color.getHexString()}`
  veil.style.opacity = opacity.toFixed(3)
}

function setMode(next: Mode) {
  mode = next
  document.body.dataset.mode = next
  renderer.domElement.style.cursor = ''
  pass.scene = next === 'globe' ? globe.scene : scene
  blurX.enabled = blurY.enabled = next === 'island'
  renderer.toneMappingExposure = 1.05
  frame()
  render()
}

/** Rises the current island into place. */
function rise() {
  chimeHour = undefined
  island = islandAt(index)
  island.group.position.y = -DEPTH
  scene.add(island.group)
  const group = island.group
  tween({ duration: reduced ? 0.01 : 1.1, step: (t) => (group.position.y = -DEPTH * (1 - t) ** 3) })
}

/** Sinks the current island, then calls `after` with the stage empty. */
function sink(after: () => void) {
  const group = island!.group
  tween({
    duration: reduced ? 0.01 : 0.8,
    step: (t) => (group.position.y = -DEPTH * t ** 3),
    done: () => {
      scene.remove(group)
      island = undefined
      after()
    },
  })
}

function enterIsland(i: number) {
  index = i
  aim = shown = lookFor()
  setMode('island')
  readout.classList.remove('leaving')
  rise()
}

function dive(i: number) {
  if (busy || mode !== 'globe') return
  busy = true
  index = i
  const look = lookFor()
  const gloom = Math.max(look.cover * 0.65, look.rain * 0.9, look.snow * 0.7, look.fog * 0.6)
  greyed(keyed(HORIZON, look.alt, veilColor), gloom)
  const from = camera.position.clone()
  const to = globe.normal(i).clone().multiplyScalar(1.3)
  const dir = new THREE.Vector3()
  tween({
    duration: reduced ? 0.3 : 1.2,
    step: (t) => {
      const k = ease(t)
      dir.copy(from).normalize().lerp(to.clone().normalize(), k).normalize()
      camera.position.copy(dir).multiplyScalar(THREE.MathUtils.lerp(from.length(), to.length(), k))
      camera.lookAt(0, 0, 0)
      labels = 1 - THREE.MathUtils.smoothstep(t, 0, 0.3)
      setVeil(THREE.MathUtils.smoothstep(t, 0.55, 0.95), veilColor)
    },
    done: () => {
      enterIsland(i)
      tween({ duration: 0.7, step: (t) => setVeil(1 - t), done: () => (busy = false) })
    },
  })
}

function surface() {
  if (busy || mode !== 'island') return
  busy = true
  readout.classList.add('leaving')
  veilColor.set(globe.scene.background as THREE.Color)
  tween({ duration: reduced ? 0.01 : 0.8, step: (t) => setVeil(THREE.MathUtils.smoothstep(t, 0.4, 1), veilColor) })
  sink(() => {
    setMode('globe')
    const dir = globe.normal(index).clone()
    const to = lifted(dir).multiplyScalar(globeFit())
    const from = dir.clone().multiplyScalar(1.3)
    const d = new THREE.Vector3()
    tween({
      duration: reduced ? 0.3 : 1.3,
      step: (t) => {
        const k = ease(t)
        d.copy(from).normalize().lerp(to.clone().normalize(), k).normalize()
        camera.position.copy(d).multiplyScalar(THREE.MathUtils.lerp(from.length(), to.length(), k))
        camera.lookAt(0, 0, 0)
        setVeil(1 - THREE.MathUtils.smoothstep(t, 0, 0.4))
        labels = THREE.MathUtils.smoothstep(t, 0.6, 1)
      },
      done: () => (busy = false),
    })
  })
}

function goTo(i: number) {
  if (busy || mode !== 'island' || i === index) return
  busy = true
  index = i
  aim = lookFor()
  readout.classList.add('leaving')
  sink(() => {
    render()
    readout.classList.remove('leaving')
    rise()
    busy = false
  })
}

// History: picking a city adds an entry, so the back button returns to the globe.
function pick(i: number) {
  if (busy) return
  history.pushState({ dived: true }, '', `#${slug(places[i])}`)
  dive(i)
}
function step(by: number) {
  if (busy || mode !== 'island') return
  const i = (index + by + places.length) % places.length
  history.replaceState(history.state, '', `#${slug(places[i])}`)
  goTo(i)
}
function home() {
  if (busy || mode !== 'island') return
  if (history.state?.dived) history.back()
  else {
    history.replaceState(null, '', location.pathname + location.search)
    surface()
  }
}
addEventListener('hashchange', () => {
  const i = fromHash()
  if (i < 0) surface()
  else if (mode === 'globe') dive(i)
  else goTo(i)
})

// A tap on a pin's head picks the city too; a drag only turns the globe.
let downAt: [number, number] | undefined
renderer.domElement.addEventListener('pointerdown', (e) => (downAt = [e.clientX, e.clientY]))
renderer.domElement.addEventListener('pointerup', (e) => {
  if (mode !== 'globe' || !downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return
  const i = globe.pinAt(e.clientX, e.clientY)
  if (i >= 0) pick(i)
})
renderer.domElement.addEventListener('pointerleave', () => globe.hover(-1))
renderer.domElement.addEventListener('pointermove', (e) => {
  if (mode !== 'globe' || e.pointerType !== 'mouse') return
  const i = globe.pinAt(e.clientX, e.clientY, 16)
  globe.hover(i)
  renderer.domElement.style.cursor = i >= 0 ? 'pointer' : ''
})

const [homeButton, prevButton, nextButton] = nav.querySelectorAll('button')
homeButton.addEventListener('click', home)
prevButton.addEventListener('click', () => step(-1))
nextButton.addEventListener('click', () => step(1))
addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight') step(1)
  if (e.key === 'ArrowLeft') step(-1)
  if (e.key === 'Escape') home()
})

// ---- Frame ------------------------------------------------------------------

const halfFov = () => (camera.fov * RAD) / 2
/** Distance at which the island fills the width on narrow screens and the depth on wide ones. */
const islandFit = () => Math.max((R * 1.1) / (Math.tan(halfFov()) * camera.aspect), (R * 0.95) / Math.tan(halfFov()))
/** Distance at which the globe fills most of the shorter side. */
const globeFit = () => 1 / Math.sin((camera.aspect < 0.8 ? 0.9 : 0.78) * Math.min(halfFov(), Math.atan(Math.tan(halfFov()) * camera.aspect)))
/** A view from a little south of a place, so the pole tilts away. */
const lifted = (dir: THREE.Vector3) => dir.clone().add(new THREE.Vector3(0, -0.25, 0)).normalize()
let labels = 1

function frame() {
  if (mode === 'globe') {
    controls.target.set(0, 0, 0)
    controls.minDistance = 1.7
    controls.maxDistance = globeFit() * 1.5
    controls.minPolarAngle = 0.3
    controls.maxPolarAngle = Math.PI - 0.3
    controls.autoRotateSpeed = 0.3
    camera.position.copy(lifted(globe.normal(index))).multiplyScalar(globeFit())
  } else {
    const fit = islandFit()
    controls.target.set(0, 0.2, 0)
    controls.minDistance = fit * 0.55
    controls.maxDistance = fit * 1.4
    controls.minPolarAngle = 0.35
    controls.maxPolarAngle = 1.35
    controls.autoRotateSpeed = 0.35
    camera.position.setFromSphericalCoords(fit, camera.aspect < 0.8 ? 0.85 : 1.02, 0.6).add(controls.target)
  }
  camera.lookAt(controls.target)
}

function resize() {
  const w = innerWidth
  const h = innerHeight
  renderer.setSize(w, h, false)
  composer.setSize(w, h)
  camera.aspect = w / h
  camera.fov = camera.aspect < 0.8 ? 50 : 35
  camera.updateProjectionMatrix()
  const fit = mode === 'globe' ? globeFit() : islandFit()
  controls.maxDistance = fit * (mode === 'globe' ? 1.5 : 1.4)
  if (!busy) camera.position.sub(controls.target).setLength(fit).add(controls.target)
  spriteScale.value = (h * renderer.getPixelRatio()) / 2
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
  runTweens(dt)
  if (mode === 'globe') {
    globe.update(camera, now(), time / 1000, labels)
    sound.update({ rain: 0, wind: 3, night: 0 }, dt)
  } else {
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
    apply(shown, time / 1000, dt)
    sky.mesh.position.copy(camera.position)
  }
  controls.enabled = !busy
  if (!busy) controls.update(dt)
  composer.render()
})

if (fromHash() >= 0) enterIsland(index)
else setMode('globe')
if (!reduced) {
  setVeil(1, globe.scene.background as THREE.Color)
  tween({ duration: 1.2, step: (t) => setVeil(1 - ease(t)) })
}
refresh()
setInterval(refresh, 10 * 60_000)
setInterval(render, 30_000)
