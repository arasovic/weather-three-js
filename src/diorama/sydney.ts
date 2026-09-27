import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { GROUND, materials, paint, random } from './kit'
import { BASE, TAU, WATER, bloomingTrees, boat, buildIsland, placer, strut, traffic, type Moment, type Site } from './island'
import { createSprites } from './sprites'

// Sydney Harbour: the city on one shore (-x), North Sydney across the water. The
// island is turned so the harbour runs east to west, with the city to the south.
const centre = (z: number) => 0.2 + 0.4 * Math.sin(0.35 * z + 0.4)
const half = (z: number) => 0.75 + 0.2 * Math.sin(0.5 * z)
const west = (z: number) => centre(z) - half(z)
const east = (z: number) => centre(z) + half(z)

const BRIDGE_Z = -1.9
const OPERA_Z = -0.4
const TOWER = { x: -2, z: 0.9 }
const STEEL = '#6f7b83'
const GRANITE = '#cdbfa4'

/**
 * The Harbour Bridge: a steel arch from bearings near the water, rising through
 * the deck to its crown, with a granite pylon at each corner.
 */
function harbourBridge(site: Site, z: number) {
  const xw = west(z) + 0.05
  const xe = east(z) - 0.05
  const mid = (xw + xe) / 2
  const span = (xe - xw) / 2
  const deck = 0.72
  const bottom = (x: number) => WATER + 0.1 + (1.25 - WATER - 0.1) * (1 - ((x - mid) / span) ** 2)
  const top = (x: number) => WATER + 0.34 + (1.38 - WATER - 0.34) * (1 - ((x - mid) / span) ** 2)
  const b = site.b
  const add = (g: THREE.BufferGeometry, color = STEEL) => b.add(materials.landmark, paint(g, color, 0, 1))
  for (const s of [-1, 1]) {
    const lz = z + s * 0.11
    const n = 16
    for (let i = 0; i < n; i++) {
      const x0 = xw + ((xe - xw) * i) / n
      const x1 = xw + ((xe - xw) * (i + 1)) / n
      add(strut(new THREE.Vector3(x0, bottom(x0), lz), new THREE.Vector3(x1, bottom(x1), lz), 0.014, 0.014, 5))
      add(strut(new THREE.Vector3(x0, top(x0), lz), new THREE.Vector3(x1, top(x1), lz), 0.011, 0.011, 5))
      add(strut(new THREE.Vector3(x0, bottom(x0), lz), new THREE.Vector3(x1, top(x1), lz), 0.005, 0.005, 4))
      add(strut(new THREE.Vector3(x1, bottom(x1), lz), new THREE.Vector3(x1, top(x1), lz), 0.005, 0.005, 4))
      // Hangers down to the deck where the arch is above it, posts up to it where below.
      if (bottom(x1) > deck + 0.02) add(strut(new THREE.Vector3(x1, deck, lz), new THREE.Vector3(x1, bottom(x1), lz), 0.004, 0.004, 4))
      else add(strut(new THREE.Vector3(x1, top(x1), lz), new THREE.Vector3(x1, deck, lz), 0.006, 0.006, 4))
    }
  }
  // Deck through the arch, on to the pylons and down ramps to the ground on both shores.
  const run = 0.9
  const x0 = xw - 0.3 - run
  const x1 = xe + 0.3 + run
  const level = (x: number) => (x < xw - 0.3 ? GROUND + ((deck - GROUND) * (x - x0)) / run : x > xe + 0.3 ? GROUND + ((deck - GROUND) * (x1 - x)) / run : deck)
  const n = 24
  for (let i = 0; i < n; i++) {
    const a = x0 + ((x1 - x0) * i) / n
    const c = x0 + ((x1 - x0) * (i + 1)) / n
    const slab = new RoundedBoxGeometry(Math.hypot(c - a, level(c) - level(a)) + 0.01, 0.035, 0.24, 1, 0.006)
    slab.rotateZ(Math.atan2(level(c) - level(a), c - a))
    slab.translate((a + c) / 2, (level(a) + level(c)) / 2, z)
    add(slab, '#8d979c')
  }
  for (const x of [xw - 0.13, xe + 0.13]) {
    for (const s of [-1, 1]) {
      const y0 = Math.min(site.height(x, z + s * 0.11), GROUND) - 0.02
      const pylon = new RoundedBoxGeometry(0.2, 1.05 - y0, 0.1, 2, 0.015)
      pylon.translate(x, (1.05 + y0) / 2, z + s * 0.12)
      b.add(materials.landmark, paint(pylon, GRANITE, 0.25, 0.3))
      const cap = new RoundedBoxGeometry(0.22, 0.04, 0.12, 1, 0.01)
      cap.translate(x, 1.07, z + s * 0.12)
      b.add(materials.landmark, paint(cap, GRANITE, 0, 1))
    }
  }
  site.block((bx, bz, r) => Math.abs(bz - z) < 0.24 + r && bx > x0 - 0.2 && bx < x1 + 0.2)
  traffic(site, (s) => new THREE.Vector3(x0 + (x1 - x0) * s, level(x0 + (x1 - x0) * s) + 0.04, z), 0.05)
}

/**
 * One shell: a sail of white tiles whose sides meet in a sharp ridge. Its open
 * front, an arch `w` wide and `h` high, faces +x; it narrows back over `length`
 * to a point on the ground. The front is closed by a wall of dark glass.
 */
function shell(w: number, h: number, length: number) {
  const nu = 14
  const nv = 16
  const section = (t: number) => (1 - Math.abs(t)) ** 0.6
  const pos: number[] = []
  const index: number[] = []
  for (let i = 0; i <= nu; i++) {
    const u = i / nu
    const s = (1 - u) ** 0.85
    for (let j = 0; j <= nv; j++) {
      const t = (j / nv) * 2 - 1
      pos.push(-length * u, h * s * section(t), (w / 2) * s * t)
      const k = i * (nv + 1) + j
      if (i < nu && j < nv) index.push(k, k + nv + 1, k + 1, k + 1, k + nv + 1, k + nv + 2)
    }
  }
  const tiles = new THREE.BufferGeometry()
  tiles.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  tiles.setIndex(index)
  tiles.computeVertexNormals()
  const arch = Array.from({ length: nv + 1 }, (_, j) => {
    const t = (j / nv) * 2 - 1
    return new THREE.Vector2((w / 2) * t * 0.97, h * section(t) * 0.97)
  })
  const glass = new THREE.ShapeGeometry(new THREE.Shape(arch))
  glass.rotateY(Math.PI / 2)
  glass.translate(-0.01, 0, 0)
  return { tiles, glass }
}

/**
 * The Opera House on Bennelong Point: a sandstone podium on a stone point running
 * out into the harbour, with two halls of shells facing the water and the small
 * restaurant shells beside them.
 */
function operaHouse(site: Site, z: number) {
  const shore = west(z)
  const top = GROUND + 0.015
  const [x0, x1] = [shore - 0.5, shore + 0.5]
  const depth = 0.84
  const x = (x0 + x1) / 2
  // The point rises from the harbour floor, so it stands in the water rather than over it.
  const point = new RoundedBoxGeometry(x1 - x0, top - BASE, depth, 2, 0.03)
  site.b.add(materials.landmark, paint(point, '#c9a47a', 0.3, 0.25), x, (top + BASE) / 2, z)
  // The grand stairs down to the forecourt on the land side.
  for (let i = 0; i < 3; i++) {
    const step = new RoundedBoxGeometry(0.08, top - GROUND + 0.012 - i * 0.008, depth * 0.7, 1, 0.004)
    site.b.add(materials.landmark, paint(step, '#d6b98f', 0.1, 0.05), x0 - 0.04 - i * 0.08, GROUND + (top - GROUND - i * 0.008) / 2, z)
  }
  // The landmark material, floodlit at night, but showing both faces of the thin shells.
  const tiles = materials.landmark.clone()
  tiles.side = THREE.DoubleSide
  tiles.onBeforeCompile = materials.landmark.onBeforeCompile
  tiles.customProgramCacheKey = () => `${materials.landmark.customProgramCacheKey()}-double`
  const glass = new THREE.MeshStandardMaterial({ color: '#3a4550', roughness: 0.2, metalness: 0.3, side: THREE.DoubleSide })
  const add = (w: number, h: number, length: number, lx: number, lz: number, rot = 0) => {
    const g = shell(w, h, length)
    paint(g.tiles, '#f6f3ec', 0.25, 0.2)
    for (const [geometry, material] of [[g.tiles, tiles], [g.glass, glass]] as const) {
      const m = new THREE.Mesh(geometry, material)
      m.position.set(x + lx, top, z + lz)
      m.rotation.y = rot
      m.castShadow = m.receiveShadow = true
      site.group.add(m)
    }
  }
  // Each hall: a row of shells nesting into one another, tallest at the harbour end,
  // and a last shell facing back towards the city.
  for (const lz of [-0.18, 0.18]) {
    add(0.3, 0.55, 0.5, 0.42, lz)
    add(0.28, 0.47, 0.44, 0.22, lz)
    add(0.26, 0.4, 0.38, 0.03, lz)
    add(0.24, 0.34, 0.34, -0.3, lz, Math.PI)
  }
  add(0.14, 0.2, 0.22, -0.12, 0.38)
  add(0.13, 0.17, 0.2, -0.24, 0.38)
  site.reserve(x - 0.25, z, 0.5)
  site.block((bx, bz, r) => bx > x0 - 0.3 - r && bx < x1 + r && Math.abs(bz - z) < depth / 2 + r)
}

/** Sydney Tower: a slender shaft carrying a golden turret and a spire above the city. */
function sydneyTower(site: Site, x: number, z: number) {
  const put = placer(site.b, x, GROUND - 0.02, z)
  put(new RoundedBoxGeometry(0.34, 0.2, 0.34, 1, 0.02), '#c9c6bf', 0.1, 0.3)
  put(new THREE.CylinderGeometry(0.035, 0.05, 2, 10), '#d9d9d6', 1.1, 0.2)
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU
    put(strut(new THREE.Vector3(Math.cos(a) * 0.12, 0.2, Math.sin(a) * 0.12), new THREE.Vector3(Math.cos(a) * 0.04, 1.9, Math.sin(a) * 0.04), 0.003, 0.003, 3), '#b9bdc1', 0, 0)
  }
  put(new THREE.CylinderGeometry(0.14, 0.12, 0.2, 20), '#d9ad3c', 2.05, 0)
  put(new THREE.CylinderGeometry(0.1, 0.14, 0.05, 20), '#c9a24a', 2.18, 0)
  put(new THREE.CylinderGeometry(0.006, 0.014, 0.4, 6), '#e9e9e9', 2.4, 0)
  site.reserve(x, z, 0.25)
}

/** New Year's Eve: fireworks over the bridge and the harbour at nine and at midnight. */
function fireworks(site: Site) {
  const colors = ['#ffd36b', '#ff6b8a', '#7ad3ff', '#b58aff']
  const per = 30
  const bursts = 4
  const sets = colors.map((color) => {
    const s = createSprites(per * bursts, { color, additive: true, soft: 0.7 })
    s.points.visible = false
    site.group.add(s.points)
    return s
  })
  const r = random(223)
  const dirs = Array.from({ length: per }, () => new THREE.Vector3().randomDirection())
  const origins = Array.from({ length: colors.length * bursts }, () => [centre(BRIDGE_Z) + (r() - 0.5) * 2.5, 1.5 + r() * 0.9, BRIDGE_Z + (r() - 0.5) * 3, r() * 3])
  const showing = (m: Moment) => (m.month === 12 && m.date === 31 && m.hour >= 21 && m.hour < 21 + 10 / 60) || (m.month === 1 && m.date === 1 && m.hour < 12 / 60)
  site.animate((t, _wind, m) => {
    const on = showing(m) && m.night > 0.5
    sets.forEach((s, c) => {
      s.points.visible = on
      if (!on) return
      for (let k = 0; k < bursts; k++) {
        const [ox, oy, oz, offset] = origins[c * bursts + k]
        const age = ((t + offset + c * 0.7) % 3) / 3
        for (let i = 0; i < per; i++) {
          const j = k * per + i
          const d = dirs[i]
          s.position[j * 3] = ox + d.x * 0.6 * Math.sqrt(age)
          s.position[j * 3 + 1] = oy + d.y * 0.6 * Math.sqrt(age) - 0.4 * age * age
          s.position[j * 3 + 2] = oz + d.z * 0.6 * Math.sqrt(age)
          s.alpha[j] = (1 - age) ** 1.5
          s.size[j] = 0.07
        }
      }
      s.commit()
    })
  })
}

export function buildSydney() {
  const cbd = (x: number, z: number) => Math.exp(-((x - TOWER.x) ** 2 / 1.2 + (z - TOWER.z + 0.6) ** 2 / 2))
  const r = random(227)
  const jacarandas: [number, number, number][] = []
  for (let i = 0; i < 22; i++) {
    const x = (r() * 2 - 1) * 4.6
    const z = (r() * 2 - 1) * 4.6
    if (Math.hypot(x, z) < 4.9 && Math.abs(x - centre(z)) > half(z) + 0.35) jacarandas.push([x, z, 0.8 + r() * 0.3])
  }
  return buildIsland({
    seed: 229,
    heading: Math.PI / 2,
    centre,
    half,
    water: '#2f7fa0',
    // The Royal Botanic Garden beside the Opera House, and Hyde Park.
    parks: [
      { x: -1.2, z: -0.1, a: 0.5, c: 0.6, h: 0 },
      { x: -2.2, z: 2.1, a: 0.45, c: 0.5, h: 0 },
    ],
    houses: {
      count: 140,
      walls: ['#e6d3b0', '#d9c39c', '#f1ebe0', '#c9d3da', '#e9e4da', '#b9c6cf', '#e3b9a0'],
      roofs: ['#a44e3a', '#6b6f75', '#8a6f5e'],
      pitched: 0.55,
      pitch: 0.8,
      width: [0.22, 0.4],
      floors: (rr, x, z) => 1 + Math.floor(rr() * (2 + 8 * cbd(x, z))),
    },
    trees: { count: 18, park: 22, greens: ['#5f8a4a', '#6f9a52', '#7ea85c'], cypress: 0 },
    landmarks(site) {
      harbourBridge(site, BRIDGE_Z)
      operaHouse(site, OPERA_Z)
      sydneyTower(site, TOWER.x, TOWER.z)
      // Jacarandas flower purple from mid-October through November.
      bloomingTrees(site, jacarandas, '#5f8a4a', '#9b7ad6', (m) => m.month === 11 || (m.month === 10 && m.date >= 15))
      fireworks(site)
      const quay = 0.6
      boat(site, (s) => [west(quay) + 0.3 + (half(quay) * 2 - 0.6) * s, quay], 30, '#1f6e43', '#f2d04a', 0.8)
      boat(site, (s) => {
        const z = 0.9 + 3 * s
        return [centre(z) + 0.2, z]
      }, 44, '#1f6e43', '#f2d04a', 0.8)
    },
  })
}
