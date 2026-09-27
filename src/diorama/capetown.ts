import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { Batch, GROUND, house, materials, paint, random } from './kit'
import { TAU, boat, buildIsland, grassAndStone, islet, lowest, placer, ridge, type Site } from './island'
import { createSprites } from './sprites'

// The city bowl between Table Bay and Table Mountain, with Lion's Head and Signal
// Hill at one end and Robben Island out in the bay. Water on the islands runs north
// to south, so the bay lies to the east and the mountain to the west.
const shore = (z: number) => 1.6 + 0.2 * Math.sin(0.5 * z + 0.4)
const SEA = 5
const centre = (z: number) => shore(z) + SEA
const half = () => SEA

const LIONS_HEAD = { x: -2.9, z: -3.2 }
const SIGNAL_HILL = { x: -1.4, z: -3.6, a: 1.2, c: 0.6, h: 0.28, grass: '#9aa86c' }
const FYNBOS = new THREE.Color('#8f9a62')
const SANDSTONE = new THREE.Color('#9b8f82')

/**
 * Table Mountain: a long, flat top with sheer cliffs towards the city, rising at the
 * south end to Devil's Peak. The cable car climbs its face.
 */
function tableMountain(site: Site) {
  const mountain = ridge({
    from: Math.PI - 0.6,
    to: Math.PI + 0.5,
    depth: 1.7,
    face: [0.12, 0.32],
    height: (u) => (1.55 + 0.35 * Math.exp(-(((u - 0.04) / 0.12) ** 2))) * THREE.MathUtils.smoothstep(u, 0, 0.08) * (1 - THREE.MathUtils.smoothstep(u, 0.9, 1)),
  })
  const g = mountain.geometry
  const normal = g.attributes.normal
  const color = new Float32Array(normal.count * 3)
  const c = new THREE.Color()
  for (let i = 0; i < normal.count; i++) c.lerpColors(SANDSTONE, FYNBOS, THREE.MathUtils.smoothstep(normal.getY(i), 0.6, 0.85)).toArray(color, i * 3)
  g.setAttribute('color', new THREE.BufferAttribute(color, 3))
  const mesh = new THREE.Mesh(g, materials.clay)
  mesh.castShadow = mesh.receiveShadow = true
  site.group.add(mesh)
  site.block((x, z, r) => mountain.covers(x, z, r + 0.1))
  return mountain
}

/** Lion's Head: a steep rocky peak with a green skirt. */
function lionsHead(site: Site) {
  const profile = [[0.8, -0.05], [0.62, 0.15], [0.42, 0.42], [0.26, 0.75], [0.14, 1.0], [0.05, 1.1], [0, 1.12]]
  const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 32)
  g.scale(1, 1, 0.85)
  site.b.add(materials.clay, grassAndStone(g, '#8f9a62', '#9b8f82'), LIONS_HEAD.x, GROUND - 0.02, LIONS_HEAD.z, 0.4)
  site.reserve(LIONS_HEAD.x, LIONS_HEAD.z, 0.8)
}

/** The cable car up the face of the mountain; the round Rotair cabin turns as it climbs. */
function cableCar(site: Site, mountain: ReturnType<typeof ridge>) {
  const foot = mountain.surface(0.62, 0.06)
  const top = mountain.surface(0.62, 0.5)
  for (const [p, w] of [[foot, 0.2], [top, 0.16]] as const) {
    site.b.add(materials.clay, paint(new RoundedBoxGeometry(w, 0.1, w * 0.8, 2, 0.02), '#e6e0d4', 0.2, 0.1), p.x, p.y + 0.04, p.z)
  }
  site.reserve(foot.x, foot.z, 0.15)
  const a = foot.clone().setY(foot.y + 0.14)
  const b = top.clone().setY(top.y + 0.12)
  const along = (s: number, out = new THREE.Vector3()) => out.lerpVectors(a, b, s).setY(out.y - 0.1 * Math.sin(Math.PI * s))
  const cable = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(Array.from({ length: 17 }, (_, i) => along(i / 16))), 48, 0.005, 4)
  site.b.add(materials.clay, paint(cable, '#3e4247', 0, 1))
  const cab = new Batch()
  cab.add(materials.clay, paint(new THREE.CylinderGeometry(0.004, 0.004, 0.06, 4), '#3e4247', 0, 1), 0, -0.03, 0)
  cab.add(materials.clay, paint(new THREE.CylinderGeometry(0.05, 0.05, 0.06, 16), '#e9e4da', 0), 0, -0.09, 0)
  cab.add(materials.clay, paint(new THREE.CylinderGeometry(0.051, 0.051, 0.02, 16), '#c8453a', 0), 0, -0.07, 0)
  const car = cab.build()
  site.group.add(car)
  site.animate((t) => {
    const p = (t % 50) / 50
    const s = p < 0.5 ? THREE.MathUtils.smoothstep(p, 0.08, 0.42) : 1 - THREE.MathUtils.smoothstep(p, 0.58, 0.92)
    along(s, car.position)
    car.rotation.y = t * 0.4
  })
}

/**
 * The tablecloth: when the south-easter blows, cloud piles up on the flat top and
 * pours over the edge down the cliffs towards the city, melting away as it falls.
 */
function tablecloth(site: Site, mountain: ReturnType<typeof ridge>) {
  const n = 220
  const s = createSprites(n, { color: '#f4f6f8', soft: 1 })
  site.group.add(s.points)
  const r = random(151)
  const seeds = Array.from({ length: n }, () => [0.12 + r() * 0.76, r(), r() * 100])
  const p = new THREE.Vector3()
  const southEast = new THREE.Vector2(-Math.SQRT1_2, -Math.SQRT1_2)
  let shown = 0
  site.animate((t, wind, m) => {
    // The wind blows from the south-east, towards the north-west.
    const blowing = wind.length() > 6 && wind.clone().normalize().dot(southEast) > 0.6 && m.rain < 0.3
    shown += ((blowing ? 1 : 0) - shown) * 0.01
    s.points.visible = shown > 0.01
    if (!s.points.visible) return
    seeds.forEach(([u, lane, seed], i) => {
      if (i < n * 0.45) {
        // The cloth lying on the top.
        mountain.surface(u + 0.01 * Math.sin(t * 0.2 + seed), 0.45 + lane * 0.4, p)
        p.y += 0.08
        s.alpha[i] = shown * 0.8
        s.size[i] = 0.5
      } else {
        // Streams pouring over the edge and fading as they fall.
        const age = (t * 0.06 + seed) % 1
        mountain.surface(u, 0.42 - 0.3 * age, p)
        p.y += 0.12 - 0.1 * age
        s.alpha[i] = shown * 0.75 * (1 - age) ** 1.5
        s.size[i] = 0.35 + 0.25 * age
      }
      p.toArray(s.position, i * 3)
    })
    s.commit()
  })
}

/** The noon gun on Signal Hill: every day but Sunday at twelve, a shot and a puff of smoke. */
function noonGun(site: Site) {
  const x = SIGNAL_HILL.x + 0.5
  const z = SIGNAL_HILL.z + 0.1
  const y = site.height(x, z) - 0.02
  const put = placer(site.b, x, y, z, 0.8)
  put(new RoundedBoxGeometry(0.16, 0.03, 0.1, 1, 0.01), '#b9ad98', 0.015, 0.2)
  const barrel = new THREE.CylinderGeometry(0.014, 0.02, 0.16, 8)
  barrel.rotateZ(Math.PI / 2 - 0.15)
  put(barrel, '#2e3236', 0.07, 0)
  for (const s of [-1, 1]) {
    const wheel = new THREE.CylinderGeometry(0.03, 0.03, 0.01, 12)
    wheel.rotateX(Math.PI / 2)
    wheel.translate(-0.02, 0, s * 0.03)
    put(wheel, '#6b4a33', 0.05, 0)
  }
  site.reserve(x, z, 0.15)
  const n = 18
  const smoke = createSprites(n, { color: '#eceae6', soft: 1 })
  site.group.add(smoke.points)
  const muzzle = new THREE.Vector3(0.09, 0.09, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.8).add(new THREE.Vector3(x, y, z))
  site.animate((_t, wind, m) => {
    const seconds = (m.hour - 12) * 3600
    smoke.points.visible = m.weekday !== 0 && seconds >= 0 && seconds < 30
    if (!smoke.points.visible) return
    const age = seconds / 30
    for (let i = 0; i < n; i++) {
      const k = i / n
      smoke.position[i * 3] = muzzle.x + 0.25 * age * Math.cos(k * TAU) + wind.x * 0.5 * age
      smoke.position[i * 3 + 1] = muzzle.y + 0.3 * age + 0.05 * Math.sin(k * 9)
      smoke.position[i * 3 + 2] = muzzle.z + 0.25 * age * Math.sin(k * TAU) + wind.y * 0.5 * age
      smoke.alpha[i] = 0.9 * (1 - age)
      smoke.size[i] = 0.15 + 0.7 * age
    }
    smoke.commit()
  })
}

/** Bo-Kaap: small flat-roofed houses in bright colours on the slope of Signal Hill. */
function boKaap(site: Site, cx: number, cz: number) {
  const walls = ['#f06ea9', '#7ad3a0', '#f7d44c', '#5bb3e6', '#b58ae0', '#ff9f43', '#63d2c6', '#f25f5c']
  const r = random(157)
  const placed: [number, number][] = []
  for (let tries = 0; tries < 300 && placed.length < 18; tries++) {
    const x = cx + (r() - 0.5) * 1.1
    const z = cz + (r() - 0.5) * 0.7
    if (placed.some(([px, pz]) => Math.hypot(x - px, z - pz) < 0.2)) continue
    placed.push([x, z])
    house(site.b, x, lowest(site.height, x, z, 0.16, 0.14) - 0.03, z, 0.1, 0.16, 0.14, 1 + Math.floor(r() * 1.6), walls[Math.floor(r() * walls.length)], null, r)
    site.reserve(x, z, 0.1)
  }
}

/** The Cape Wheel at the V&A Waterfront, turning slowly on its two legs. */
function capeWheel(site: Site, x: number, z: number) {
  const radius = 0.42
  const hub = GROUND + radius + 0.08
  const put = placer(site.b, x, GROUND - 0.02, z)
  for (const s of [-1, 1]) {
    const leg = new THREE.CylinderGeometry(0.012, 0.018, hub - GROUND + 0.02, 6)
    leg.rotateX(s * 0.08)
    leg.translate(0, 0, s * 0.03)
    put(leg, '#e9e4da', (hub - GROUND) / 2 + 0.01, 0)
  }
  const wheel = new Batch()
  wheel.add(materials.clay, paint(new THREE.TorusGeometry(radius, 0.01, 6, 48), '#f2efe9', 0))
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * TAU
    const spoke = new THREE.CylinderGeometry(0.003, 0.003, radius, 4)
    spoke.translate(0, radius / 2, 0)
    spoke.rotateZ(a)
    wheel.add(materials.clay, paint(spoke, '#d9d5cc', 0))
    wheel.add(materials.leds, paint(new RoundedBoxGeometry(0.05, 0.05, 0.05, 1, 0.012), '#e9eef2', 0), Math.cos(a) * radius, Math.sin(a) * radius, 0)
  }
  const mesh = wheel.build()
  mesh.position.set(x, hub, z)
  mesh.rotation.y = Math.PI / 2
  site.group.add(mesh)
  site.animate((t) => (mesh.rotation.x = t * 0.08))
  site.reserve(x, z, 0.3)
}

/** Robben Island, low and flat out in the bay, with its lighthouse. */
function robbenIsland(site: Site, x: number, z: number) {
  const top = islet(site, x, z, 1.1, 0.7, 0.3)
  const put = placer(site.b, x + 0.3, top, z - 0.1)
  put(new THREE.CylinderGeometry(0.03, 0.04, 0.3, 10), '#f2efe9', 0.15, 0.2)
  put(new THREE.ConeGeometry(0.04, 0.05, 10), '#c8453a', 0.33, 0)
  site.b.add(materials.lamps, paint(new THREE.SphereGeometry(0.028, 10, 8), '#f3ead6', 0, 0.01), x + 0.3, top + 0.31, z - 0.1)
  house(site.b, x - 0.2, top - 0.01, z + 0.05, 0.3, 0.3, 0.14, 1, '#e9e4da', '#6b6f75', random(163), 0.6)
}

export function buildCapeTown() {
  const cbd = (x: number, z: number) => Math.exp(-((x - 0.6) ** 2 / 0.8 + (z + 0.8) ** 2 / 1.5))
  return buildIsland({
    seed: 167,
    centre,
    half,
    grass: '#9fb074',
    water: '#3b7f98',
    hills: [SIGNAL_HILL],
    // The Company's Garden in the city bowl.
    parks: [{ x: -0.4, z: 0.4, a: 0.5, c: 0.7, h: 0 }],
    houses: {
      count: 150,
      walls: ['#f3efe6', '#efe3cf', '#e8d5b5', '#dfe9ea', '#f2d9c4', '#e6e0d4', '#cfd9dd'],
      roofs: ['#6b6f75', '#b5573f', '#8a6f5e'],
      pitched: 0.45,
      pitch: 0.8,
      width: [0.22, 0.4],
      floors: (r, x, z) => 1 + Math.floor(r() * (2 + 5 * cbd(x, z))),
    },
    trees: { count: 22, park: 22, greens: ['#6f9a52', '#7ea85c', '#5f8a4a'], cypress: 0.2 },
    landmarks(site) {
      const mountain = tableMountain(site)
      lionsHead(site)
      cableCar(site, mountain)
      tablecloth(site, mountain)
      // Signal Hill stays open grass above Bo-Kaap.
      site.block((x, z, r) => ((x - SIGNAL_HILL.x) / (SIGNAL_HILL.a + r)) ** 2 + ((z - SIGNAL_HILL.z) / (SIGNAL_HILL.c + r)) ** 2 < 1)
      noonGun(site)
      boKaap(site, SIGNAL_HILL.x + 0.1, SIGNAL_HILL.z + 0.75)
      capeWheel(site, shore(-1.6) - 0.35, -1.6)
      robbenIsland(site, 4, -2.3)
      boat(site, (s) => [shore(-1.1) + 0.3 + 2.8 * s, -1.1 - 1.1 * s], 44, '#2f5a8a', '#f2efe6', 0.8)
    },
  })
}
