import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { Batch, GROUND, house, materials, paint, random } from './kit'
import { BASE, TAU, WATER, boat, buildIsland, placer, slab, strut, type Site } from './island'

// Guanabara Bay runs down to its mouth at the south end, with Rio on the west
// bank and Niterói on the east.
const centre = (z: number) => 1.2 + 0.35 * Math.sin(0.4 * z - 0.3)
const half = (z: number) => 0.85 + 0.25 * THREE.MathUtils.smoothstep(z, -1, 3)
const shore = (z: number) => centre(z) - half(z)

// Granite domes: rock on the steep flanks, a little green on top.
const GRANITE = { grass: '#7fa35a', rock: '#9a9083' }
const SUGARLOAF = { x: -0.2, z: 3.5, a: 0.5, c: 0.6, h: 1.1, rough: 0.2, ...GRANITE }
const URCA = { x: -1.1, z: 2.7, a: 0.6, c: 0.55, h: 0.5, rough: 0.3, ...GRANITE }
const CORCOVADO = { x: -3.4, z: -0.7, a: 0.65, c: 0.75, h: 1.4, rough: 0.35, ...GRANITE, rock: '#8f877c' }
const TIJUCA = { x: -3.6, z: -0.3, a: 1.6, c: 1.8, h: 0.55, rough: 0.25, grass: '#8aab60' }

const WHITE = '#eeeae2'

/** Christ the Redeemer on the summit of Corcovado, arms open towards the bay. */
function redeemer(site: Site, x: number, z: number) {
  const put = placer(site.b, x, site.height(x, z) - 0.02, z)
  put(new RoundedBoxGeometry(0.12, 0.08, 0.12, 1, 0.012), '#d8d2c6', 0.04, 0.2)
  put(new THREE.CylinderGeometry(0.032, 0.05, 0.22, 10), WHITE, 0.19, 0.1)
  put(new RoundedBoxGeometry(0.032, 0.03, 0.3, 1, 0.012), WHITE, 0.27, 0)
  put(new THREE.SphereGeometry(0.024, 10, 8), WHITE, 0.32, 0)
}

/** The cable car from the top of Urca to the top of Sugarloaf, shuttling back and forth. */
function cableCar(site: Site) {
  const top = (m: { x: number; z: number }) => new THREE.Vector3(m.x, site.height(m.x, m.z), m.z)
  const from = top(URCA)
  const to = top(SUGARLOAF)
  const yaw = Math.atan2(-(to.z - from.z), to.x - from.x)
  for (const p of [from, to]) {
    site.b.add(materials.clay, paint(new RoundedBoxGeometry(0.2, 0.12, 0.16, 2, 0.02), '#d9d2c4', 0.2, 0.1), p.x, p.y + 0.04, p.z, yaw)
    site.reserve(p.x, p.z, 0.16)
  }
  const a = from.clone().setY(from.y + 0.14)
  const b = to.clone().setY(to.y + 0.14)
  const along = (s: number, out = new THREE.Vector3()) => out.lerpVectors(a, b, s).setY(out.y - 0.12 * Math.sin(Math.PI * s))
  const cable = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(Array.from({ length: 17 }, (_, i) => along(i / 16))), 48, 0.006, 4)
  site.b.add(materials.clay, paint(cable, '#3e4247', 0, 1))

  const cab = new Batch()
  cab.add(materials.clay, paint(strut(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.07, 0), 0.006, 0.006, 4), '#3e4247', 0, 1))
  cab.add(materials.clay, paint(new RoundedBoxGeometry(0.1, 0.07, 0.07, 2, 0.02), '#f1ece2', 0), 0, -0.1, 0)
  cab.add(materials.clay, paint(new RoundedBoxGeometry(0.104, 0.025, 0.074, 1, 0.008), '#4b5968', 0), 0, -0.09, 0)
  const car = cab.build()
  site.group.add(car)
  site.animate((t) => {
    const p = (t % 40) / 40
    const s = p < 0.5 ? THREE.MathUtils.smoothstep(p, 0.08, 0.42) : 1 - THREE.MathUtils.smoothstep(p, 0.58, 0.92)
    along(s, car.position)
    car.rotation.set(0, yaw, Math.sin(t * 1.8) * 0.04)
  })
}

/** A coconut palm: a slender leaning trunk and a crown of drooping fronds. */
function palm(b: Batch, x: number, y: number, z: number, s: number, lean: number) {
  const tip = new THREE.Vector3(Math.cos(lean) * 0.06 * s, 0.5 * s, -Math.sin(lean) * 0.06 * s)
  b.add(materials.trees, paint(strut(new THREE.Vector3(), tip, 0.02 * s, 0.013 * s, 6), '#8a6f55', 0.2, 0.1), x, y, z)
  for (let k = 0; k < 7; k++) {
    const frond = new THREE.SphereGeometry(1, 8, 4)
    frond.scale(0.15 * s, 0.012 * s, 0.035 * s)
    frond.translate(0.13 * s, 0, 0)
    frond.rotateZ(-0.45)
    frond.rotateY((k / 7) * TAU + lean)
    paint(frond, k % 2 ? '#5f8f45' : '#6d9c4c', 0, 0.01)
    b.add(materials.trees, frond, x + tip.x, y + tip.y, z + tip.z)
  }
}

/** A sandy beach below the promenade on the west bank, lined with palms. */
function beach(site: Site, z0: number, z1: number) {
  // Shapes live in the (x, -z) plane: along the quay, then back along the waterline,
  // which bulges out most in the middle.
  const pts: THREE.Vector2[] = []
  const n = 24
  for (let i = 0; i <= n; i++) {
    const z = z0 + ((z1 - z0) * i) / n
    pts.push(new THREE.Vector2(shore(z) - 0.02, -z))
  }
  for (let i = n; i >= 0; i--) {
    const z = z0 + ((z1 - z0) * i) / n
    pts.push(new THREE.Vector2(shore(z) + 0.08 + 0.18 * Math.sin((Math.PI * i) / n), -z))
  }
  site.b.add(materials.clay, paint(slab(new THREE.Shape(pts), BASE, WATER + 0.035, 0.015), '#eadcb5', 0))
  for (let z = z0 + 0.15; z < z1; z += 0.32) {
    const x = shore(z) - 0.14
    palm(site.b, x, GROUND - 0.02, z, 0.85 + ((z * 7) % 1) * 0.3, z * 3)
    site.reserve(x, z, 0.08)
  }
}

/** Colourful houses stacked up a hillside. */
function favela(site: Site, cx: number, cz: number, radius: number) {
  const walls = ['#e8a33d', '#d9594c', '#4f8fc0', '#f0d34f', '#7cb66a', '#e27fa0', '#f2efe6', '#c9764f']
  const r = random(41)
  const placed: [number, number, number][] = []
  for (let tries = 0; tries < 400 && placed.length < 30; tries++) {
    const a = r() * TAU
    const d = Math.sqrt(r()) * radius
    const x = cx + Math.cos(a) * d
    const z = cz + Math.sin(a) * d * 0.8
    const w = 0.1 + r() * 0.06
    if (placed.some(([px, pz, pr]) => Math.hypot(x - px, z - pz) < pr + w * 0.6)) continue
    placed.push([x, z, w * 0.6])
    house(site.b, x, site.height(x, z) - 0.03, z, (r() - 0.5) * 0.3, w, w * (0.8 + r() * 0.3), 1 + Math.floor(r() * 2), walls[Math.floor(r() * walls.length)], null, r)
    site.reserve(x, z, w * 0.6)
  }
}

/** Niemeyer's museum in Niterói: a white saucer on a stem over a round pool, with a red ramp. */
function museum(site: Site, x: number, z: number) {
  const put = placer(site.b, x, GROUND - 0.02, z)
  put(new THREE.CylinderGeometry(0.34, 0.34, 0.03, 32), '#6fa2b5', 0.015, 0)
  put(new THREE.CylinderGeometry(0.05, 0.06, 0.12, 12), WHITE, 0.09, 0.2)
  put(new THREE.CylinderGeometry(0.24, 0.08, 0.1, 32), WHITE, 0.2, 0.1)
  put(new THREE.CylinderGeometry(0.235, 0.235, 0.035, 32), '#3e4a55', 0.265, 0)
  put(new THREE.CylinderGeometry(0.25, 0.245, 0.025, 32), WHITE, 0.295, 0)
  const ramp = new RoundedBoxGeometry(0.5, 0.02, 0.05, 1, 0.008)
  ramp.rotateZ(Math.atan2(0.2, 0.46))
  ramp.translate(-0.4, 0, 0.05)
  put(ramp, '#c8453a', 0.12, 0)
  site.reserve(x - 0.1, z, 0.45)
}

export function buildRio() {
  // High-rises crowd the waterfront of Flamengo and Botafogo.
  const front = (x: number, z: number) => Math.exp(-((Math.abs(x - centre(z)) - half(z)) ** 2) / 1.5)
  const ferryZ = 0.2
  return buildIsland({
    seed: 43,
    centre,
    half,
    water: '#3d8f9b',
    hills: [TIJUCA, CORCOVADO, URCA, SUGARLOAF],
    // The Tijuca forest around Corcovado, and the woods of the Urca peninsula.
    parks: [
      { x: TIJUCA.x, z: TIJUCA.z, a: 1.45, c: 1.65, h: 0 },
      { x: -0.5, z: 3.7, a: 1.3, c: 1.4, h: 0 },
    ],
    houses: {
      count: 130,
      walls: ['#f3efe6', '#efe0c4', '#f2d7b6', '#dfe9ea', '#f4e7a8', '#e7c9b8', '#cfe0d1'],
      roofs: ['#b8603f', '#a55a3e', '#c26b48'],
      pitched: 0.25,
      pitch: 0.6,
      width: [0.22, 0.4],
      floors: (r, x, z) => 1 + Math.floor(r() * (2 + 6 * front(x, z))),
    },
    trees: { count: 26, park: 44, greens: ['#5f9048', '#6c9a4f', '#4f7f3f', '#7aa35a'], cypress: 0 },
    landmarks(site) {
      redeemer(site, CORCOVADO.x, CORCOVADO.z)
      site.reserve(CORCOVADO.x, CORCOVADO.z, 0.35)
      site.reserve(SUGARLOAF.x, SUGARLOAF.z, 0.55)
      cableCar(site)
      favela(site, -2.6, 0.3, 0.45)
      beach(site, 0.6, 2.2)
      museum(site, centre(1.2) + half(1.2) + 0.45, 1.2)
      for (let z = 1.9; z < 2.8; z += 0.45) {
        const x = centre(z) + half(z) + 0.3
        palm(site.b, x, GROUND - 0.02, z, 0.9, z * 5)
        site.reserve(x, z, 0.08)
      }
      const from = shore(ferryZ) + 0.32
      const to = centre(ferryZ) + half(ferryZ) - 0.32
      boat(site, (s) => [from + (to - from) * s, ferryZ], 32, '#2b4d7a', '#f3f1ec')
    },
  })
}
