import * as THREE from 'three'
import { RoundedBoxGeometry } from './rounded-box'
import { Batch, GROUND, house, materials, paint, random, tree } from './kit'
import { BASE, TAU, WATER, boat, buildIsland, flag, islet, lowest, placer, rooted, type Moment, type Site } from './island'

// A town on the Black Sea coast: it climbs the hills from the shore, the castle
// stands on its headland and Giresun Island lies offshore to the north-east. The
// island is turned so the sea, laid out along +x, lies to the north; its +z then
// points east, towards Aksu.
const HEADING = Math.PI / 2
const HEADLAND = -1.6
const shore = (z: number) => 1.9 + 0.25 * Math.sin(0.5 * z + 0.3) + 0.5 * Math.exp(-(((z - HEADLAND) / 0.8) ** 2))
// The sea is a band of water reaching past the rim, which leaves land on one side only.
const SEA = 5
const centre = (z: number) => shore(z) + SEA
const half = () => SEA

const ISLAND = { x: 4, z: 1.6 }
const CASTLE = { x: shore(HEADLAND) - 0.75, z: HEADLAND, a: 0.65, c: 0.75, h: 0.55, rough: 0.25, grass: '#86a85c' }
// Hazelnut groves on the hills behind the town.
const GROVES = [
  { x: -3.4, z: -1.8, a: 1.3, c: 1.4, h: 0.75, rough: 0.3, grass: '#7fa35a' },
  { x: -3.3, z: 1.7, a: 1.4, c: 1.3, h: 0.7, rough: 0.3, grass: '#7fa35a' },
]
const inside = (m: { x: number; z: number; a: number; c: number }, x: number, z: number, r = 0) => ((x - m.x) / (m.a + r)) ** 2 + ((z - m.z) / (m.c + r)) ** 2 < 1

/** Giresun Island: rocks at the waterline, a wooded crown, the monastery's ruined walls and a jetty. */
function giresunIsland(site: Site) {
  const { x, z } = ISLAND
  const rot = 0.4
  const top = islet(site, x, z, 1.2, 0.85, rot)
  const r = random(97)
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * TAU + r() * 0.3
    const rock = new THREE.SphereGeometry(0.08 + r() * 0.06, 7, 5)
    rock.scale(1, 0.55, 1)
    const lx = Math.cos(a) * 0.61
    const lz = Math.sin(a) * 0.44
    site.b.add(materials.clay, paint(rock, '#8f8a82', 0.2, 0.05), x + lx * Math.cos(rot) + lz * Math.sin(rot), WATER + 0.01, z - lx * Math.sin(rot) + lz * Math.cos(rot))
  }
  const mound = new THREE.SphereGeometry(1, 24, 8, 0, TAU, 0, Math.PI / 2)
  mound.scale(0.46, 0.24, 0.32)
  site.b.add(materials.clay, paint(mound, '#7fa05a', 0), x, top, z, rot)
  const put = placer(site.b, x, top, z, rot)
  // The ruined walls and tower of the old monastery, on the seaward side.
  for (const [lx, lz, w, d] of [[-0.16, -0.12, 0.2, 0.025], [-0.26, -0.03, 0.025, 0.18], [-0.1, 0.07, 0.14, 0.025]]) {
    const wall = new RoundedBoxGeometry(w, 0.06, d, 1, 0.006)
    wall.translate(lx, 0, lz)
    put(wall, '#b9ad98', 0.1, 0.2)
  }
  const ruin = new THREE.CylinderGeometry(0.035, 0.04, 0.14, 8)
  ruin.translate(-0.28, 0, -0.12)
  put(ruin, '#b9ad98', 0.1, 0.2)
  const jetty = new RoundedBoxGeometry(0.22, 0.02, 0.05, 1, 0.006)
  jetty.translate(0.66, 0, 0.05)
  put(jetty, '#8a6f55', WATER + 0.02 - top, 0)
  const dome = (lx: number, lz: number) => top + 0.24 * Math.sqrt(Math.max(0, 1 - (lx / 0.46) ** 2 - (lz / 0.32) ** 2))
  for (let i = 0; i < 26; i++) {
    const a = r() * TAU
    const d = Math.sqrt(r())
    const lx = Math.cos(a) * d * 0.42
    const lz = Math.sin(a) * d * 0.28
    const s = 0.5 + r() * 0.3
    const y = rooted(dome, lx, lz, 0.035 * s)
    tree(site.b, x + lx * Math.cos(rot) + lz * Math.sin(rot), y, z - lx * Math.sin(rot) + lz * Math.cos(rot), s, r() < 0.5 ? '#4f7f3f' : '#5f9048')
  }
}

/** On the 20th of May, the Aksu festival: boats go seven times round the island. */
function aksu(site: Site) {
  const colors = ['#d9463a', '#f2c230', '#3f88c5', '#6fb07f', '#f2efe6', '#e8762d', '#b784a7']
  const boats = colors.map((color) => {
    const b = new Batch()
    b.add(materials.clay, paint(new RoundedBoxGeometry(0.16, 0.04, 0.06, 1, 0.015), color, 0), 0, 0.02, 0)
    b.add(materials.clay, paint(new THREE.CylinderGeometry(0.003, 0.003, 0.1, 4), '#6b4a33', 0), -0.02, 0.09, 0)
    b.add(materials.clay, paint(new RoundedBoxGeometry(0.04, 0.025, 0.003, 1, 0.001), '#e30a17', 0), 0, 0.125, 0)
    const mesh = b.build(false)
    mesh.visible = false
    site.group.add(mesh)
    return mesh
  })
  const festival = (m: Moment) => m.month === 5 && m.date === 20 && m.day > 0.3
  site.animate((t, _wind, m) => {
    const on = festival(m)
    boats.forEach((boatMesh, i) => {
      boatMesh.visible = on
      if (!on) return
      const a = t * 0.12 + (i / boats.length) * TAU
      boatMesh.position.set(ISLAND.x + Math.cos(a) * 0.86, WATER - 0.005 + 0.004 * Math.sin(t * 2 + i), ISLAND.z + Math.sin(a) * 0.66)
      boatMesh.rotation.y = -a - Math.PI / 2
    })
  })
}

function flagTexture() {
  const c = document.createElement('canvas')
  c.width = 96
  c.height = 64
  const g = c.getContext('2d')!
  const red = '#e30a17'
  g.fillStyle = red
  g.fillRect(0, 0, 96, 64)
  g.fillStyle = '#fff'
  g.beginPath()
  g.arc(32, 32, 16, 0, TAU)
  g.fill()
  g.fillStyle = red
  g.beginPath()
  g.arc(36, 32, 12.8, 0, TAU)
  g.fill()
  g.fillStyle = '#fff'
  g.beginPath()
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const rr = i % 2 ? 3.2 : 8
    g.lineTo(52 + Math.cos(a) * rr, 32 + Math.sin(a) * rr)
  }
  g.fill()
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** Giresun Castle on its headland: broken walls, plane trees, and the flag flying in the wind. */
function castle(site: Site) {
  const { x, z } = CASTLE
  const y = site.height(x, z) - 0.02
  for (let i = 0; i < 10; i++) {
    if (i === 3 || i === 7) continue
    const a = (i / 10) * TAU
    const rot = -a - Math.PI / 2
    const wx = x + Math.cos(a) * 0.34
    const wz = z + Math.sin(a) * 0.34
    const h = 0.16 + (i % 3) * 0.04
    placer(site.b, wx, lowest(site.height, wx, wz, 0.22, 0.05, rot) - 0.02, wz, rot)(new RoundedBoxGeometry(0.22, h, 0.05, 1, 0.008), '#b9ad98', h / 2, 0.3)
  }
  for (const a of [0.6, 2.9]) {
    const tx = x + Math.cos(a) * 0.36
    const tz = z + Math.sin(a) * 0.36
    placer(site.b, tx, lowest(site.height, tx, tz, 0.14, 0.14) - 0.02, tz)(new THREE.CylinderGeometry(0.065, 0.075, 0.3, 12), '#b3a792', 0.15, 0.3)
  }
  placer(site.b, x, y, z)(new THREE.CylinderGeometry(0.007, 0.01, 0.75, 6), '#d9d9d9', 0.375, 0)
  flag(site, x, y + 0.64, z, flagTexture())
  const r = random(101)
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + 0.4
    const tx = x + Math.cos(a) * 0.55
    const tz = z + Math.sin(a) * 0.5
    const s = 1 + r() * 0.2
    tree(site.b, tx, rooted(site.height, tx, tz, 0.035 * s), tz, s, '#5f8a4a')
  }
  site.reserve(x, z, 0.85)
}

/** Zeytinlik: old two-storey houses, white walls and red tiles, on the slope below the castle. */
function zeytinlik(site: Site, cx: number, cz: number) {
  const r = random(103)
  const placed: [number, number][] = []
  for (let tries = 0; tries < 200 && placed.length < 10; tries++) {
    const x = cx + (r() - 0.5) * 1
    const z = cz + (r() - 0.5) * 0.8
    if (placed.some(([px, pz]) => Math.hypot(x - px, z - pz) < 0.3)) continue
    placed.push([x, z])
    const rot = (r() - 0.5) * 0.4
    house(site.b, x, lowest(site.height, x, z, 0.24, 0.2, rot) - 0.03, z, rot, 0.24, 0.2, 2, r() < 0.7 ? '#efe9dc' : '#e8dcc4', '#b5573f', r, 1.1)
    site.reserve(x, z, 0.16)
  }
}

/** Rows of hazelnut bushes along the contours; in August the crop dries on the yards below. */
function groves(site: Site) {
  const r = random(107)
  const yards: THREE.Mesh[] = []
  for (const g of GROVES) {
    site.block((x, z, rad) => inside(g, x, z, rad))
    for (let ring = 0.25; ring < 0.82; ring += 0.12) {
      const n = Math.round((TAU * ring * Math.max(g.a, g.c)) / 0.17)
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + ring * 3 + (r() - 0.5) * 0.08
        const rr = ring + (r() - 0.5) * 0.04
        const x = g.x + Math.cos(a) * rr * g.a
        const z = g.z + Math.sin(a) * rr * g.c
        if (Math.hypot(x, z) > 5.4) continue
        const s = 0.42 + r() * 0.1
        tree(site.b, x, rooted(site.height, x, z, 0.035 * s) - 0.01, z, s, r() < 0.5 ? '#5d8a45' : '#6b9a4e')
      }
    }
    // Drying yards at the foot of the grove, towards the town.
    for (let i = 0; i < 3; i++) {
      const a = Math.atan2(-g.z, -g.x) + (i - 1) * 0.5
      const x = g.x + Math.cos(a) * g.a * 0.95
      const z = g.z + Math.sin(a) * g.c * 0.95
      const yard = new THREE.Mesh(new RoundedBoxGeometry(0.24, 0.012, 0.16, 1, 0.004), new THREE.MeshStandardMaterial({ color: '#a0703f', roughness: 0.9 }))
      yard.position.set(x, lowest(site.height, x, z, 0.24, 0.16, a) + 0.006, z)
      yard.rotation.y = a
      yard.receiveShadow = true
      yard.visible = false
      site.group.add(yard)
      yards.push(yard)
      site.reserve(x, z, 0.16)
    }
  }
  site.animate((_t, _wind, m) => {
    const harvest = m.month === 8 || (m.month === 9 && m.date <= 15)
    for (const y of yards) y.visible = harvest
  })
}

/** The Aksu stream coming down from the hills into the sea. */
function stream(site: Site, z: number) {
  const x0 = shore(z) + 0.05
  const x1 = 0.3 - Math.sqrt(4.9 ** 2 - z ** 2)
  const pts: THREE.Vector3[] = []
  for (let x = x0; x > x1; x -= 0.25) pts.push(new THREE.Vector3(x, 0, z + 0.25 * Math.sin((x0 - x) * 1.3)))
  const curve = new THREE.CatmullRomCurve3(pts)
  const ribbon = new THREE.TubeGeometry(curve, 48, 0.06, 4).scale(1, 0.12, 1)
  site.b.add(materials.clay, paint(ribbon, '#4f9fb3', 0, 0.01), 0, GROUND + 0.004, 0)
  const on = new THREE.Vector3()
  site.block((x, bz, r) => {
    const p = curve.getPointAt(THREE.MathUtils.clamp((x0 - x) / (x0 - x1), 0, 1), on)
    return x < x0 + 0.1 && x > x1 - 0.1 && Math.abs(bz - p.z) < 0.12 + r
  })
}

/** The harbour mole running out into the sea, with its light at the end. */
function harbour(site: Site, z: number) {
  const x0 = shore(z) - 0.05
  const length = 0.85
  const mole = new RoundedBoxGeometry(length, WATER + 0.06 - BASE, 0.1, 1, 0.015)
  mole.translate(length / 2, (WATER + 0.06 + BASE) / 2, 0)
  site.b.add(materials.clay, paint(mole, '#9a958c', 0.2, 0.1), x0, 0, z, 0.15)
  const put = placer(site.b, x0, 0, z, 0.15)
  const light = new THREE.CylinderGeometry(0.025, 0.03, 0.16, 10)
  light.translate(length - 0.04, 0, 0)
  put(light, '#c8453a', WATER + 0.06 + 0.08, 0.1)
  const end = new THREE.Vector3(length - 0.04, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.15)
  site.b.add(materials.lamps, paint(new THREE.SphereGeometry(0.022, 8, 6), '#f3ead6', 0, 0.01), x0 + end.x, WATER + 0.06 + 0.18, z + end.z)
}

export function buildGiresun() {
  return buildIsland({
    seed: 109,
    heading: HEADING,
    centre,
    half,
    grass: '#94b86a',
    water: '#3d7f95',
    hills: [CASTLE, ...GROVES],
    houses: {
      count: 120,
      walls: ['#efe3cf', '#e8d5b5', '#f2d9c4', '#dde6cf', '#d9e3ea', '#f0e6a8', '#e9c9b4', '#f4efe6'],
      roofs: ['#b5573f', '#a44e3a', '#c26b48'],
      pitched: 0.7,
      pitch: 0.6,
      width: [0.28, 0.44],
      floors: (r) => 2 + Math.floor(r() * 5),
    },
    trees: { count: 24, park: 0, greens: ['#5f8a4a', '#6f9a52', '#7ea85c'], cypress: 0 },
    landmarks(site) {
      giresunIsland(site)
      aksu(site)
      castle(site)
      zeytinlik(site, shore(-2.9) - 0.9, -2.9)
      groves(site)
      stream(site, 3.4)
      harbour(site, 0.6)
      boat(site, (s) => [shore(0.2) + 0.3 + 2 * s, 0.2 + 0.3 * s], 30, '#2f5a8a', '#f2efe6', 0.8)
    },
  })
}
