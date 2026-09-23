import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { GROUND } from './kit'
import { BASE, boat, buildIsland, gable, hip, placer, stoneBridge, traffic, type Put, type Site } from './island'

// The Thames bends gently from north to south.
const centre = (z: number) => 0.2 + 0.6 * Math.sin(0.45 * z)
const half = () => 0.75
const bank = (z: number) => centre(z) - half() - 0.34

const SAND = '#cdb98f'
const SLATE = '#5b6470'
const STEEL = '#7fa6c9'

function pinnacles(put: Put, w: number, y: number, size: number, color: string) {
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const post = new THREE.BoxGeometry(size, size * 2.2, size)
    post.translate((sx * (w - size)) / 2, 0, (sz * (w - size)) / 2)
    put(post, color, y + size * 1.1)
    const cap = hip(size * 1.2, size * 1.6)
    cap.translate((sx * (w - size)) / 2, 0, (sz * (w - size)) / 2)
    put(cap, SLATE, y + size * 2.2)
  }
}

function bigBen(site: Site, x: number, z: number) {
  const put = placer(site.b, x, site.height(x, z) - 0.02, z)
  put(new RoundedBoxGeometry(0.22, 1.5, 0.22, 2, 0.012), SAND, 0.75, 0.3)
  put(new RoundedBoxGeometry(0.28, 0.3, 0.28, 2, 0.012), SAND, 1.64)
  for (let k = 0; k < 4; k++) {
    const face = new THREE.CylinderGeometry(0.1, 0.1, 0.012, 24)
    face.rotateX(Math.PI / 2)
    face.translate(0, 0, 0.142)
    face.rotateY((k * Math.PI) / 2)
    put(face, '#f3ecd6', 1.64, 0)
  }
  put(new RoundedBoxGeometry(0.24, 0.16, 0.24, 1, 0.01), '#bfa97d', 1.87)
  pinnacles(put, 0.26, 1.79, 0.035, SAND)
  put(hip(0.22, 0.5), SLATE, 1.95)
  put(new THREE.CylinderGeometry(0.004, 0.012, 0.16, 6), '#c9a24a', 2.5)
}

/** The Palace of Westminster along the river, Victoria Tower at its south end. */
function parliament(site: Site, z0: number, z1: number) {
  const a = new THREE.Vector2(bank(z0), z0)
  const b = new THREE.Vector2(bank(z1), z1)
  const length = a.distanceTo(b)
  const rot = Math.atan2(-(b.y - a.y), b.x - a.x)
  const mid = a.clone().add(b).multiplyScalar(0.5)
  const put = placer(site.b, mid.x, GROUND - 0.02, mid.y, rot)
  put(new RoundedBoxGeometry(length, 0.36, 0.4, 2, 0.015), SAND, 0.18, 0.3)
  put(gable(length, 0.14, 0.42), SLATE, 0.36)
  const lantern = new THREE.CylinderGeometry(0.07, 0.08, 0.3, 8)
  put(lantern, SAND, 0.5)
  put(new THREE.ConeGeometry(0.07, 0.3, 8), SLATE, 0.8)
  const tower = (g: THREE.BufferGeometry) => (g.translate(length / 2 + 0.05, 0, 0), g)
  const victoria: Put = (g, color, y, ao) => put(tower(g), color, y, ao)
  victoria(new RoundedBoxGeometry(0.34, 1.3, 0.34, 2, 0.015), SAND, 0.65, 0.3)
  pinnacles(victoria, 0.36, 1.3, 0.05, SAND)
  site.block((x, z, r) => {
    const t = THREE.MathUtils.clamp(((x - a.x) * (b.x - a.x) + (z - a.y) * (b.y - a.y)) / length ** 2, -0.1, 1.15)
    return Math.hypot(x - (a.x + (b.x - a.x) * t), z - (a.y + (b.y - a.y) * t)) < 0.3 + r
  })
}

function towerBridge(site: Site, z: number) {
  const c = centre(z)
  const x0 = c - half() - 0.3
  const x1 = c + half() + 0.3
  const deck = GROUND + 0.09
  const top = 1.45
  const stone = '#ddd3bc'
  const put = placer(site.b, 0, 0, z)
  const at = (g: THREE.BufferGeometry, x: number) => (g.translate(x, 0, 0), g)
  put(at(new RoundedBoxGeometry(x1 - x0, 0.05, 0.22, 1, 0.012), (x0 + x1) / 2), STEEL, deck, 0.05)
  for (const s of [-1, 1]) {
    const x = c + s * 0.36
    put(at(new RoundedBoxGeometry(0.38, deck - BASE, 0.46, 2, 0.03), x), stone, (deck + BASE) / 2 - 0.03, 0.3)
    put(at(new RoundedBoxGeometry(0.26, top - deck, 0.32, 2, 0.015), x), stone, (deck + top) / 2)
    put(at(hip(0.2, 0.2), x), SLATE, top)
    const turret: Put = (g, color, y, ao) => put(at(g, x), color, y, ao)
    pinnacles(turret, 0.3, top - 0.02, 0.06, stone)
    // Suspension chains down to the banks.
    const end = s < 0 ? x0 + 0.1 : x1 - 0.1
    for (const side of [-1, 1]) {
      const pts: THREE.Vector3[] = []
      for (let i = 0; i <= 12; i++) {
        const t = i / 12
        pts.push(new THREE.Vector3(x + s * 0.13 + (end - x - s * 0.13) * t, top - 0.2 + (deck + 0.03 - top + 0.2) * t - 0.1 * Math.sin(Math.PI * t), side * 0.12))
      }
      const chain = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.014, 5)
      put(chain, STEEL, 0, 0)
    }
  }
  for (const side of [-1, 1]) {
    const walk = new RoundedBoxGeometry(0.5, 0.06, 0.06, 1, 0.01)
    walk.translate(c, 0, side * 0.1)
    put(walk, STEEL, top - 0.14, 0)
  }
  site.block((x, bz, r) => Math.abs(bz - z) < 0.3 + r && x > x0 - 0.3 && x < x1 + 0.3)
  traffic(site, (s) => new THREE.Vector3(x0 + (x1 - x0) * s, deck + 0.04, z), 0.05)
}

export function buildLondon() {
  return buildIsland({
    seed: 3,
    centre,
    half,
    water: '#557f7f',
    // Greenwich park on its hill, St James's Park behind Westminster.
    hills: [{ x: 3, z: 2.7, a: 1.3, c: 1.2, h: 0.3 }],
    parks: [
      { x: 3, z: 2.7, a: 1.15, c: 1.05, h: 0 },
      { x: -2.5, z: 1.1, a: 0.9, c: 0.8, h: 0 },
    ],
    houses: {
      count: 125,
      walls: ['#a4553f', '#b86a4f', '#8f4a3a', '#e9e0cf', '#c98a6a', '#e4dccb'],
      roofs: [SLATE, '#4f5862', '#66707c'],
      pitched: 0.75,
      pitch: 0.9,
      width: [0.22, 0.42],
      floors: (r) => 2 + Math.floor(r() * r() * 3),
    },
    trees: { count: 30, park: 28, greens: ['#6f9a52', '#7ea85c', '#5f8a4a'], cypress: 0 },
    landmarks(site) {
      bigBen(site, bank(-0.1), -0.1)
      site.reserve(bank(-0.1), -0.1, 0.25)
      parliament(site, 0.25, 2.5)
      stoneBridge(site, -0.6, '#8fa393', 0.28)
      towerBridge(site, -3.2)
      boat(site, (s) => [centre(0.1 + 4 * s) + 0.3, 0.1 + 4 * s], 40, '#2f3a48', '#e8e4dc', 0.9)
    },
  })
}
