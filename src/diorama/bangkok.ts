import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { GROUND, house, random } from './kit'
import { TAU, WATER, blockBox, boat, buildIsland, gable, placer, plantPalm, type Put, type Site } from './island'
import { createSprites } from './sprites'

// The Chao Phraya winds south through the city: Thonburi on the west bank,
// the old royal island of Rattanakosin on the east.
const centre = (z: number) => 0.6 + 0.9 * Math.sin(0.45 * z)
const half = () => 0.7
const WAT = { x: centre(-0.5) - half() - 0.85, z: -0.5 }

const PORCELAIN = '#ebe4d6'
const GOLD = '#d9ad3c'
const ORANGE = '#c8623a'
const GREEN = '#3f7d4f'

/** A prang: a tiered, faceted tower rising to a slender spire. */
function prang(scale: number) {
  const profile = [
    [0.36, 0], [0.36, 0.08], [0.3, 0.08], [0.3, 0.16], [0.24, 0.16], [0.24, 0.26], [0.2, 0.28], [0.19, 0.6], [0.16, 0.66],
    [0.16, 0.74], [0.13, 0.78], [0.12, 0.92], [0.09, 0.98], [0.07, 1.12], [0.05, 1.18], [0.03, 1.32], [0.012, 1.45], [0, 1.5],
  ].map(([r, y]) => new THREE.Vector2(r * scale, y * scale))
  const g = new THREE.LatheGeometry(profile, 8).toNonIndexed()
  g.computeVertexNormals()
  return g
}

/** Wat Arun: the great prang on its terrace by the river, four small ones at the corners. */
function watArun(site: Site, x: number, z: number) {
  // The terrace squares up to the bank, which runs along the river's course here.
  const along = Math.atan((centre(z + 0.05) - centre(z - 0.05)) / 0.1)
  const put = placer(site.b, x, GROUND - 0.02, z, along)
  put(new RoundedBoxGeometry(1.2, 0.08, 1.2, 1, 0.02), '#d8cfbd', 0.04, 0.3)
  put(prang(1), PORCELAIN, 0.08, 0.2)
  for (const [lx, lz] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) {
    const g = prang(0.45)
    g.translate(lx, 0, lz)
    put(g, PORCELAIN, 0.08, 0.2)
  }
  site.reserve(x, z, 0.85)
  // The corner prangs stand out past the terrace's corners.
  blockBox(site, x, z, 1.36, 1.36, along)
}

/** A Thai hall: white walls under tiered roofs in orange and green. */
function hall(put: Put, w: number, d: number, tiers: number) {
  put(new RoundedBoxGeometry(w, 0.2, d, 2, 0.02), '#f1ede4', 0.1, 0.3)
  for (let i = 0; i < tiers; i++) {
    const k = 1 - i * 0.18
    put(gable(w * k + 0.08, 0.2 * k, d * k + 0.08), i % 2 ? GREEN : ORANGE, 0.2 + i * 0.1)
  }
}

/** A golden bell-shaped chedi on stepped bases. */
function chedi(put: Put, s: number) {
  const profile = [
    [0.22, 0], [0.22, 0.06], [0.2, 0.06], [0.2, 0.12], [0.18, 0.12], [0.19, 0.18], [0.18, 0.3], [0.14, 0.4], [0.07, 0.46],
    [0.05, 0.5], [0.05, 0.54], [0.035, 0.6], [0.02, 0.8], [0.004, 0.95], [0, 0.96],
  ].map(([r, y]) => new THREE.Vector2(r * s, y * s))
  put(new THREE.LatheGeometry(profile, 24), GOLD, 0, 0.15)
}

/** The Grand Palace: a walled court with the throne hall, its golden spires, and a chedi. */
function grandPalace(site: Site, x: number, z: number) {
  const w = 1.5
  const d = 1.3
  const put = placer(site.b, x, GROUND - 0.02, z)
  for (const [lx, lz, bw, bd] of [[0, -d / 2, w, 0.04], [0, d / 2, w, 0.04], [-w / 2, 0, 0.04, d], [w / 2, 0, 0.04, d]]) {
    const wall = new RoundedBoxGeometry(bw, 0.1, bd, 1, 0.01)
    wall.translate(lx, 0, lz)
    put(wall, '#f1ede4', 0.05, 0.3)
  }
  hall(placer(site.b, x - 0.15, GROUND - 0.02, z + 0.2), 0.7, 0.3, 3)
  for (const lx of [-0.45, -0.15, 0.15]) {
    const spire = new THREE.ConeGeometry(0.045, 0.42, 8)
    spire.translate(lx, 0, 0.2)
    put(spire, GOLD, 0.52, 0)
  }
  hall(placer(site.b, x + 0.45, GROUND - 0.02, z - 0.35, Math.PI / 2), 0.4, 0.22, 2)
  chedi(placer(site.b, x + 0.35, GROUND - 0.02, z + 0.3), 1)
  chedi(placer(site.b, x - 0.5, GROUND - 0.02, z - 0.35), 0.6)
  site.block((bx, bz, r) => Math.abs(bx - x) < w / 2 + r && Math.abs(bz - z) < d / 2 + r)
}

/** MahaNakhon: a glass tower with a spiral of jutting blocks, as if pixels were peeled away. */
function mahaNakhon(site: Site, x: number, z: number) {
  const y = site.height(x, z) - 0.03
  const w = 0.34
  const floors = 15
  house(site.b, x, y, z, 0, w, w, floors, '#b9c6d0', null, random(29))
  const put = placer(site.b, x, y, z)
  const top = floors * 0.2
  for (let i = 0; i < 44; i++) {
    const a = i * 0.36
    const ly = 0.2 + (i / 44) * (top - 0.2)
    const cube = new THREE.BoxGeometry(0.06, 0.06, 0.06)
    // Along the faces of the square tower, stepping round as it climbs.
    const face = Math.floor(((a % TAU) / TAU) * 4)
    const along = (((a % TAU) / TAU) * 4 - face - 0.5) * w
    const out = w / 2 + 0.02
    const [lx, lz] = [[along, out], [out, -along], [-along, -out], [-out, along]][face]
    cube.translate(lx, 0, lz)
    put(cube, '#dfe6ec', ly, 0)
  }
}

/** Loy Krathong: on the November full moon, candlelit floats drift down the river after dark. */
function krathongs(site: Site) {
  const n = 70
  const s = createSprites(n, { color: '#ffcf7a', additive: true, soft: 0.8 })
  const r = random(61)
  const floats = Array.from({ length: n }, () => [r() * 8, r() * 2 - 1, r() * 10])
  site.group.add(s.points)
  let shown = 0
  site.animate((t, _wind, m) => {
    const tonight = m.month === 11 && Math.abs(m.moon - 0.5) < 0.025 && m.hour >= 17
    shown += ((m.night > 0.5 && tonight ? 1 : 0) - shown) * 0.02
    s.points.visible = shown > 0.01
    if (!s.points.visible) return
    floats.forEach(([start, across, seed], i) => {
      const z = ((start + t * 0.03) % 8) - 4
      s.position[i * 3] = centre(z) + across * half() * 0.8
      s.position[i * 3 + 1] = WATER + 0.02
      s.position[i * 3 + 2] = z
      s.alpha[i] = shown * (0.7 + 0.3 * Math.sin(t * 9 + seed))
      s.size[i] = 0.07
    })
    s.commit()
  })
}

export function buildBangkok() {
  const silom = (x: number, z: number) => Math.exp(-((x - 3.2) ** 2 + (z + 2.6) ** 2) / 1.6)
  return buildIsland({
    seed: 67,
    centre,
    half,
    grass: '#98b86a',
    water: '#80876a',
    // Lumphini Park, with the towers of the business district beyond.
    parks: [{ x: 3.4, z: 0.6, a: 0.7, c: 0.55, h: 0 }],
    houses: {
      count: 150,
      walls: ['#e9dcc6', '#d8c9a8', '#cfd6d9', '#e6c9a9', '#b9c4c9', '#f0e6d2', '#c9b8a3', '#e3b8a0'],
      roofs: ['#9b4a35', '#5e6b73', '#b8603f'],
      pitched: 0.3,
      pitch: 0.8,
      width: [0.2, 0.38],
      floors: (r, x, z) => 1 + Math.floor(r() * (2.5 + 9 * silom(x, z))),
    },
    trees: { count: 30, park: 22, greens: ['#5f9048', '#6c9a4f', '#4f7f3f', '#7aa35a'], cypress: 0 },
    landmarks(site) {
      watArun(site, WAT.x, WAT.z)
      grandPalace(site, centre(-0.9) + half() + 1.05, -0.9)
      mahaNakhon(site, 3.2, -2.6)
      site.reserve(3.2, -2.6, 0.3)
      const r = random(71)
      for (let z = -3; z < 3.2; z += 0.55) {
        for (const side of [-1, 1]) {
          const x = centre(z) + side * (half() + 0.3)
          if (Math.hypot(x - WAT.x, z - WAT.z) < 1 || (Math.abs(x - 2.3) < 1 && Math.abs(z + 0.9) < 0.9) || Math.hypot(x, z) > 5.3) continue
          plantPalm(site, x, z, 0.8 + r() * 0.3, r() * TAU)
        }
      }
      krathongs(site)
      boat(site, (s) => {
        const z = -3.6 + 7.2 * s
        return [centre(z) - 0.22, z]
      }, 46, '#f0ece2', '#e8762d')
      boat(site, (s) => {
        const z = 3.4 - 6.8 * s
        return [centre(z) + 0.25, z]
      }, 20, '#7a4a2e', '#c24a3a', 0.6)
    },
  })
}
