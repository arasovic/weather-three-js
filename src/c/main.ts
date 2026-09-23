import '../shared/base.css'
import '../b/style.css'
import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { getMoonPosition, getPosition } from 'suncalc'
import { cities, sunsetCity } from '../shared/cities'
import { addSignature } from '../shared/signature'
import { describe, fetchCurrent, localTime, type Conditions } from '../shared/weather'

const RAD = Math.PI / 180
const ISLAND = 5

// ---- Page -------------------------------------------------------------------

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
renderer.setClearColor(0x000000, 0)
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.shadowMap.enabled = true
renderer.toneMapping = THREE.ACESFilmicToneMapping
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

const nav = document.createElement('nav')
nav.className = 'step'
const prev = Object.assign(document.createElement('button'), { textContent: '‹', ariaLabel: 'Previous city' })
const next = Object.assign(document.createElement('button'), { textContent: '›', ariaLabel: 'Next city' })
nav.append(prev, next)
document.body.appendChild(nav)
addSignature()

// ---- Scene ------------------------------------------------------------------

const scene = new THREE.Scene()
scene.fog = new THREE.Fog(0x000000, 18, 60)

const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200)
camera.position.set(13, 9, 15)
const controls = new OrbitControls(camera, renderer.domElement)
controls.target.set(0, 1, 0)
controls.enableDamping = true
controls.enablePan = false
controls.autoRotate = !matchMedia('(prefers-reduced-motion: reduce)').matches
controls.autoRotateSpeed = 0.4
controls.minDistance = 10
controls.maxDistance = 34
controls.maxPolarAngle = 1.45

const hemi = new THREE.HemisphereLight(0xffffff, 0x333333, 1)
scene.add(hemi)
const sun = new THREE.DirectionalLight(0xffffff, 2)
sun.castShadow = true
sun.shadow.mapSize.set(1024, 1024)
sun.shadow.camera.left = sun.shadow.camera.bottom = -8
sun.shadow.camera.right = sun.shadow.camera.top = 8
sun.shadow.bias = -0.0015
scene.add(sun, sun.target)
const moon = new THREE.DirectionalLight(0x8fa8d8, 0)
scene.add(moon)

const rng = (() => {
  let s = 7
  return () => ((s = (s * 16807) % 2147483647) / 2147483647)
})()

// Island: a grassy top on a rocky, tapering underside.
const island = new THREE.Group()
scene.add(island)
const grass = new THREE.MeshStandardMaterial({ color: 0x6f8a57, roughness: 1, flatShading: true })
const rock = new THREE.MeshStandardMaterial({ color: 0x5d5249, roughness: 1, flatShading: true })
const top = new THREE.Mesh(new THREE.CylinderGeometry(ISLAND, ISLAND * 0.97, 0.5, 48), grass)
top.receiveShadow = true
island.add(top)
const under = new THREE.ConeGeometry(ISLAND * 0.97, 5, 24, 4)
under.rotateX(Math.PI)
const pos = under.attributes.position
for (let i = 0; i < pos.count; i++) {
  if (pos.getY(i) < 2.4) pos.setXYZ(i, pos.getX(i) * (0.85 + rng() * 0.3), pos.getY(i), pos.getZ(i) * (0.85 + rng() * 0.3))
}
under.computeVertexNormals()
const base = new THREE.Mesh(under, rock)
base.position.y = -2.75
island.add(base)

// A small town: pale blocks with window textures that light up after dark.
function windowTexture() {
  const c = document.createElement('canvas')
  c.width = 32
  c.height = 64
  const g = c.getContext('2d')!
  g.fillStyle = '#000'
  g.fillRect(0, 0, 32, 64)
  for (let y = 4; y < 60; y += 8) {
    for (let x = 3; x < 30; x += 7) {
      if (rng() < 0.55) {
        g.fillStyle = rng() < 0.8 ? '#ffc98a' : '#fff1d6'
        g.fillRect(x, y, 4, 4)
      }
    }
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.magFilter = THREE.NearestFilter
  return t
}

const buildings: THREE.MeshStandardMaterial[] = []
for (let i = 0; i < 16; i++) {
  const a = rng() * Math.PI * 2
  const r = Math.sqrt(rng()) * 2.6
  const w = 0.5 + rng() * 0.6
  const h = 0.6 + rng() * rng() * 3.4
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color().setHSL(0.08 + rng() * 0.05, 0.12, 0.7 + rng() * 0.15),
    roughness: 0.9,
    emissive: 0xffffff,
    emissiveMap: windowTexture(),
    emissiveIntensity: 0,
  })
  mat.emissiveMap!.repeat.set(1, Math.max(1, Math.round(h)))
  mat.emissiveMap!.wrapT = THREE.RepeatWrapping
  buildings.push(mat)
  // Box faces: +x, -x, +y (roof), -y, +z, -z. Windows only on the walls.
  const roof = new THREE.MeshStandardMaterial({ color: mat.color.clone().multiplyScalar(0.8), roughness: 0.9 })
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), [mat, mat, roof, roof, mat, mat])
  b.position.set(Math.cos(a) * r, 0.25 + h / 2, Math.sin(a) * r)
  b.rotation.y = rng() * Math.PI
  b.castShadow = b.receiveShadow = true
  island.add(b)
}

// Trees around the rim; they lean and sway with the wind.
const trees: { group: THREE.Group; phase: number }[] = []
const leaves = new THREE.MeshStandardMaterial({ color: 0x3f6b3a, roughness: 1, flatShading: true })
const bark = new THREE.MeshStandardMaterial({ color: 0x4a3526, roughness: 1 })
for (let i = 0; i < 22; i++) {
  const a = rng() * Math.PI * 2
  const r = 3.1 + rng() * 1.6
  const s = 0.6 + rng() * 0.6
  const group = new THREE.Group()
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.5), bark)
  trunk.position.y = 0.25
  const crown = new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.1, 7), leaves)
  crown.position.y = 0.95
  crown.castShadow = trunk.castShadow = true
  group.add(trunk, crown)
  group.scale.setScalar(s)
  group.position.set(Math.cos(a) * r, 0.25, Math.sin(a) * r)
  island.add(group)
  trees.push({ group, phase: rng() * 10 })
}

// Clouds: clusters of flat-shaded puffs that drift over the island and wrap around.
const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true, transparent: true })
const puff = new THREE.IcosahedronGeometry(1, 1)
const clouds: THREE.Group[] = []
for (let i = 0; i < 14; i++) {
  const g = new THREE.Group()
  const n = 3 + Math.floor(rng() * 3)
  for (let j = 0; j < n; j++) {
    const m = new THREE.Mesh(puff, cloudMat)
    m.position.set((j - n / 2) * 0.8 + rng() * 0.3, rng() * 0.3, rng() * 0.6 - 0.3)
    m.scale.setScalar(0.6 + rng() * 0.5)
    m.scale.y *= 0.7
    m.castShadow = true
    g.add(m)
  }
  g.scale.setScalar(0.75)
  g.position.set((rng() - 0.5) * 16, 6.5 + rng() * 2, (rng() - 0.5) * 16)
  scene.add(g)
  clouds.push(g)
}

// Rain as short falling segments, snow as points; both fill a cylinder over the island.
const DROPS = 1400
const rainGeo = new THREE.BufferGeometry()
const rainPos = new Float32Array(DROPS * 6)
const snowGeo = new THREE.BufferGeometry()
const snowPos = new Float32Array(DROPS * 3)
for (let i = 0; i < DROPS; i++) {
  const a = rng() * Math.PI * 2
  const r = Math.sqrt(rng()) * ISLAND
  const y = rng() * 7
  rainPos.set([Math.cos(a) * r, y, Math.sin(a) * r, Math.cos(a) * r, y - 0.25, Math.sin(a) * r], i * 6)
  snowPos.set([Math.cos(a) * r, y, Math.sin(a) * r], i * 3)
}
rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3))
snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3))
const rainMat = new THREE.LineBasicMaterial({ color: 0xaabbdd, transparent: true, opacity: 0.5 })
const snowMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.07, transparent: true })
const rain = new THREE.LineSegments(rainGeo, rainMat)
const snow = new THREE.Points(snowGeo, snowMat)
scene.add(rain, snow)

const starGeo = new THREE.BufferGeometry()
const starPos = new Float32Array(1500 * 3)
for (let i = 0; i < 1500; i++) {
  const v = new THREE.Vector3(rng() - 0.5, rng() * 0.9 + 0.05, rng() - 0.5).normalize().multiplyScalar(90)
  starPos.set([v.x, v.y, v.z], i * 3)
}
starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.35, transparent: true, fog: false })
scene.add(new THREE.Points(starGeo, starMat))

// ---- Weather state ----------------------------------------------------------

// Sky colours keyed on sun altitude, the same palette as the sky window prototype.
const KEYS = [-18, -9, -4, 0, 5, 12, 30]
const ZENITH = ['#03050b', '#090f26', '#1a2957', '#2e4a87', '#335ca8', '#366bc7', '#296bdb'].map((c) => new THREE.Color(c))
const HORIZON = ['#080a14', '#1a1f40', '#574d80', '#a8809e', '#ccadad', '#b8cce6', '#bdd9f5'].map((c) => new THREE.Color(c))
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
  cover: number
  rain: number
  snow: number
  fog: number
  wind: number
  windTo: number
}

let conditions: (Conditions | undefined)[] = []
let index = sunsetCity()

function lookFor(i: number): Look {
  const c = cities[i]
  const now = new Date()
  const s = getPosition(now, c.lat, c.lon)
  const m = getMoonPosition(now, c.lat, c.lon)
  const w = conditions[i]?.current
  const code = w?.weather_code ?? 0
  const within = (lo: number, hi: number) => code >= lo && code <= hi
  return {
    alt: s.altitude,
    az: s.azimuth,
    moonAlt: m.altitude,
    moonAz: m.azimuth,
    cover: w ? w.cloud_cover / 100 : 0.3,
    rain: w ? Math.max(Math.min(w.rain / 4, 1), within(51, 67) || within(80, 82) || code >= 95 ? 0.35 : 0) : 0,
    snow: w ? Math.max(Math.min(w.snowfall / 1.5, 1), within(71, 77) || within(85, 86) ? 0.4 : 0) : 0,
    fog: w ? Math.min(1, Math.max(0, 1 - (w.visibility - 1000) / 19000)) ** 2 : 0,
    wind: w?.wind_speed_10m ?? 2,
    windTo: ((w?.wind_direction_10m ?? 270) + 180) % 360,
  }
}

let shown = lookFor(index)
let target = shown

function toVector(az: number, alt: number, r: number, out: THREE.Vector3) {
  return out.set(Math.cos(alt * RAD) * Math.sin(az * RAD), Math.sin(alt * RAD), -Math.cos(alt * RAD) * Math.cos(az * RAD)).multiplyScalar(r)
}

const sky = new THREE.Color()
const zenith = new THREE.Color()
const grey = new THREE.Color()
let backdrop = ''

function greyed(c: THREE.Color, gloom: number) {
  const l = c.r * 0.3 + c.g * 0.55 + c.b * 0.15
  return c.lerp(grey.setRGB(l * 0.85, l * 0.9, l), gloom * 0.75)
}
const warm = new THREE.Color()

function apply(l: Look, t: number, dt: number) {
  const day = THREE.MathUtils.smoothstep(l.alt, -6, 8)
  const night = 1 - THREE.MathUtils.smoothstep(l.alt, -14, -4)
  const gloom = Math.max(l.cover * 0.7, l.rain, l.snow * 0.8)

  greyed(keyed(HORIZON, l.alt, sky), gloom)
  greyed(keyed(ZENITH, l.alt, zenith), gloom)
  const css = `linear-gradient(#${zenith.getHexString()}, #${sky.getHexString()} 75%)`
  if (css !== backdrop) document.body.style.background = backdrop = css
  scene.fog!.color.copy(sky)
  const fog = scene.fog as THREE.Fog
  fog.near = THREE.MathUtils.lerp(18, 4, l.fog)
  fog.far = THREE.MathUtils.lerp(60, 16, l.fog)

  toVector(l.az, Math.max(l.alt, 2), 20, sun.position)
  warm.setHSL(0.07, 0.9, 0.5 + 0.5 * THREE.MathUtils.smoothstep(l.alt, 0, 25))
  sun.color.copy(warm)
  sun.intensity = 2.6 * day * (1 - gloom * 0.7)
  toVector(l.moonAz, Math.max(l.moonAlt, 5), 20, moon.position)
  moon.intensity = l.moonAlt > 0 ? 0.5 * night : 0
  hemi.color.copy(sky).lerp(grey.setScalar(1), 0.3)
  hemi.groundColor.setHex(0x2a2520)
  hemi.intensity = 0.25 + 1.1 * day

  for (const m of buildings) m.emissiveIntensity = 1.4 * night
  starMat.opacity = night * (1 - gloom)

  // Clouds: show as many clusters as the cover asks for, tinted by the light.
  const shownClouds = Math.round(l.cover * clouds.length)
  cloudMat.color.setScalar(0.95 - gloom * 0.4)
  // Clouds take on the sky around them, so they never go muddy in low light.
  cloudMat.emissive.copy(sky).multiplyScalar(0.45)
  const speed = 0.08 + l.wind * 0.06
  const vx = Math.sin(l.windTo * RAD) * speed * dt
  const vz = -Math.cos(l.windTo * RAD) * speed * dt
  clouds.forEach((g, i) => {
    g.visible = i < shownClouds
    g.position.x += vx
    g.position.z += vz
    if (Math.hypot(g.position.x, g.position.z) > 9) {
      g.position.x *= -0.95
      g.position.z *= -0.95
    }
  })

  const sway = Math.min(l.wind / 15, 1)
  for (const { group, phase } of trees) {
    group.rotation.z = sway * (0.12 + 0.05 * Math.sin(t * (1.5 + sway * 2) + phase))
  }

  rain.visible = l.rain > 0.02
  rainMat.opacity = 0.55 * l.rain
  if (rain.visible) fall(rainPos, 6, 9 * dt)
  snow.visible = l.snow > 0.02
  snowMat.opacity = l.snow
  if (snow.visible) fall(snowPos, 3, 0.9 * dt)
}

function fall(arr: Float32Array, stride: number, dy: number) {
  for (let i = 0; i < arr.length; i += stride) {
    for (let k = 1; k < stride; k += 3) arr[i + k] -= dy
    if (arr[i + 1] < 0.3) for (let k = 1; k < stride; k += 3) arr[i + k] += 7
  }
  const geo = stride === 6 ? rainGeo : snowGeo
  geo.attributes.position.needsUpdate = true
}

// ---- Data and navigation ----------------------------------------------------

function render() {
  const city = cities[index]
  const c = conditions[index]
  cityEl.textContent = city.name
  tempEl.textContent = c ? `${Math.round(c.current.temperature_2m)}°` : '–'
  const offset = c?.utcOffset ?? Math.round(city.lon / 15) * 3600
  detailEl.textContent = c ? `${describe(c.current.weather_code)}, ${localTime(offset)}` : localTime(offset)
}

async function refresh() {
  try {
    conditions = await fetchCurrent(cities)
  } catch (e) {
    console.warn('Weather request failed; showing sun and moon only.', e)
  }
  target = lookFor(index)
  render()
}

function go(step: number) {
  index = (index + step + cities.length) % cities.length
  target = lookFor(index)
  readout.classList.add('leaving')
  setTimeout(() => {
    render()
    readout.classList.remove('leaving')
  }, 350)
}
prev.addEventListener('click', () => go(-1))
next.addEventListener('click', () => go(1))
addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight') go(1)
  if (e.key === 'ArrowLeft') go(-1)
})

function resize() {
  renderer.setSize(innerWidth, innerHeight, false)
  camera.aspect = innerWidth / innerHeight
  // Keep the whole island in frame on a narrow phone screen.
  camera.fov = camera.aspect < 0.8 ? 58 : 40
  camera.updateProjectionMatrix()
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
    target = lookFor(index)
    sinceLook = 0
  }
  const k = 1 - Math.exp(-dt * 1.8)
  const nextLook = { ...shown }
  for (const key of Object.keys(target) as (keyof Look)[]) {
    let d = target[key] - shown[key]
    // Angles take the short way round.
    if (key === 'az' || key === 'moonAz' || key === 'windTo') d = ((d + 540) % 360) - 180
    nextLook[key] += d * k
  }
  shown = nextLook
  apply(shown, time / 1000, dt)
  controls.update()
  renderer.render(scene, camera)
})

render()
refresh()
setInterval(refresh, 10 * 60_000)
setInterval(render, 30_000)
