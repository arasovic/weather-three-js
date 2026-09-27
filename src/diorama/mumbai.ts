import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { GROUND, materials, paint, palm, random } from './kit'
import { TAU, WATER, buildIsland, gable, islet, placer, type Site } from './island'
import { createSprites } from './sprites'

// Back Bay curves between Malabar Hill and Nariman Point, with Marine Drive along
// it; Colaba and the Gateway of India lie at the south end. Water on the islands
// runs north to south, so the sea lies to the east.
const shore = (z: number) => 2.5 - 1.1 * Math.exp(-(((z - 0.1) / 2.2) ** 2))
const SEA = 5
const centre = (z: number) => shore(z) + SEA
const half = () => SEA

const DRIVE: [number, number] = [-2.6, 2.4]
const BASALT = '#c9a878'
const MALABAR = { x: -0.9, z: -3.6, a: 1.2, c: 0.9, h: 0.3 }

/** The Gateway of India: a yellow basalt arch on the waterfront, with four turrets. */
function gateway(site: Site, x: number, z: number) {
  const put = placer(site.b, x, GROUND - 0.02, z)
  for (const s of [-1, 1]) {
    const pier = new RoundedBoxGeometry(0.1, 0.36, 0.18, 1, 0.012)
    pier.translate(0, 0, s * 0.11)
    put(pier, BASALT, 0.18, 0.3)
  }
  put(new RoundedBoxGeometry(0.1, 0.1, 0.4, 1, 0.012), BASALT, 0.41, 0.1)
  const arch = new THREE.TorusGeometry(0.06, 0.02, 6, 16, Math.PI)
  arch.rotateY(Math.PI / 2)
  put(arch, BASALT, 0.34, 0)
  for (const [lz, lx] of [[-0.18, -0.04], [0.18, -0.04], [-0.18, 0.04], [0.18, 0.04]]) {
    const turret = new THREE.CylinderGeometry(0.025, 0.028, 0.14, 8)
    turret.translate(lx, 0, lz)
    put(turret, BASALT, 0.53, 0)
    const cap = new THREE.SphereGeometry(0.027, 8, 6, 0, TAU, 0, Math.PI / 2)
    cap.translate(lx, 0, lz)
    put(cap, BASALT, 0.6, 0)
  }
  site.reserve(x, z, 0.3)
}

/** The Taj Mahal Palace beside it: a cream facade under red domes. */
function taj(site: Site, x: number, z: number) {
  const put = placer(site.b, x, GROUND - 0.02, z)
  put(new RoundedBoxGeometry(0.3, 0.4, 0.8, 2, 0.02), '#ece2cf', 0.2, 0.3)
  put(new RoundedBoxGeometry(0.32, 0.03, 0.82, 1, 0.008), '#d9c9aa', 0.41, 0)
  const main = new THREE.SphereGeometry(0.13, 16, 8, 0, TAU, 0, Math.PI / 2)
  main.scale(1, 1.3, 1)
  put(main, '#b84a36', 0.42, 0)
  put(new THREE.ConeGeometry(0.018, 0.08, 6), '#d9ad3c', 0.62, 0)
  for (const lz of [-0.33, 0.33]) {
    const small = new THREE.SphereGeometry(0.06, 12, 6, 0, TAU, 0, Math.PI / 2)
    small.translate(0, 0, lz)
    put(small, '#b84a36', 0.42, 0)
  }
  site.reserve(x, z, 0.45)
}

/** Chhatrapati Shivaji Terminus: a Gothic station with its central dome and gables. */
function terminus(site: Site, x: number, z: number) {
  const put = placer(site.b, x, GROUND - 0.02, z, 0.2)
  const stone = '#d9c49a'
  put(new RoundedBoxGeometry(0.9, 0.24, 0.3, 2, 0.015), stone, 0.12, 0.3)
  const roof = gable(0.92, 0.12, 0.32)
  put(roof, '#8a6f5e', 0.24, 0)
  put(new RoundedBoxGeometry(0.22, 0.36, 0.26, 1, 0.012), stone, 0.18, 0.3)
  put(new THREE.CylinderGeometry(0.09, 0.1, 0.1, 8), stone, 0.41, 0)
  const dome = new THREE.SphereGeometry(0.1, 12, 8, 0, TAU, 0, Math.PI / 2)
  dome.scale(1, 1.4, 1)
  put(dome, '#7f8f86', 0.46, 0)
  put(new THREE.ConeGeometry(0.012, 0.1, 6), '#d9ad3c', 0.64, 0)
  for (const lx of [-0.42, 0.42]) {
    const tower = new RoundedBoxGeometry(0.08, 0.32, 0.08, 1, 0.01)
    tower.translate(lx, 0, 0.1)
    put(tower, stone, 0.16, 0.3)
    const spire = new THREE.ConeGeometry(0.05, 0.12, 4)
    spire.translate(lx, 0, 0.1)
    put(spire, '#8a6f5e', 0.38, 0)
  }
  site.reserve(x, z, 0.5)
}

/** Haji Ali Dargah on its islet out in the bay, reached along a causeway. */
function hajiAli(site: Site, z: number) {
  const x = shore(z) + 1.1
  const top = islet(site, x, z, 0.4, 0.34)
  const put = placer(site.b, x, top, z)
  put(new RoundedBoxGeometry(0.22, 0.12, 0.18, 1, 0.012), '#f4f1ea', 0.06, 0.2)
  const dome = new THREE.SphereGeometry(0.07, 14, 8, 0, TAU, 0, Math.PI / 2)
  dome.scale(1, 1.3, 1)
  put(dome, '#f4f1ea', 0.12, 0)
  const minaret = new THREE.CylinderGeometry(0.012, 0.016, 0.3, 8)
  minaret.translate(0.09, 0, 0.07)
  put(minaret, '#f4f1ea', 0.15, 0)
  const causeway = new RoundedBoxGeometry(1.1 - 0.2 + 0.1, 0.02, 0.05, 1, 0.006)
  site.b.add(materials.clay, paint(causeway, '#b9ad98', 0), shore(z) + (1.1 - 0.2) / 2, WATER + 0.005, z)
}

/**
 * The Queen's Necklace: a close string of lamps along the curve of Marine Drive,
 * shining gold across the bay at night.
 */
function marineDrive(site: Site) {
  const [z0, z1] = DRIVE
  for (let z = z0; z <= z1; z += 0.12) {
    const x = shore(z) - 0.1
    site.b.add(materials.clay, paint(new THREE.CylinderGeometry(0.006, 0.009, 0.16, 5), '#4b4f55', 0.1, 0.1), x, GROUND + 0.08, z)
    site.b.add(materials.lamps, paint(new THREE.SphereGeometry(0.026, 8, 6), '#f7e3b0', 0, 0.01), x, GROUND + 0.17, z)
  }
  site.block((x, z, r) => z > z0 - r && z < z1 + r && x > shore(z) - 0.22 - r)
  const r = random(197)
  for (let z = z0 + 0.2; z < z1; z += 0.5) {
    const x = shore(z) - 0.32
    palm(site.b, x, GROUND - 0.02, z, 0.8 + r() * 0.3, r() * TAU)
    site.reserve(x, z, 0.08)
  }
}

/** In the monsoon, from June to September, waves break over the sea wall on windy days. */
function monsoonSpray(site: Site) {
  const n = 160
  const s = createSprites(n, { color: '#eef5f7', soft: 0.9 })
  site.group.add(s.points)
  const r = random(199)
  const drops = Array.from({ length: n }, () => [DRIVE[0] + r() * (DRIVE[1] - DRIVE[0]), r(), r() * 8, r()])
  let shown = 0
  site.animate((t, wind, m) => {
    const monsoon = m.month >= 6 && m.month <= 9
    shown += ((monsoon && wind.length() > 6 ? 1 : 0) - shown) * 0.02
    s.points.visible = shown > 0.01
    if (!s.points.visible) return
    s.shade(1 - 0.65 * m.night)
    drops.forEach(([z, spread, seed, lift], i) => {
      // Each wave throws up a plume that rises, leans inland and falls back.
      const age = (t * 0.45 + seed) % 1
      const x = shore(z) + 0.02 - age * 0.25 * spread
      s.position[i * 3] = x
      s.position[i * 3 + 1] = WATER + 0.05 + (0.3 + 0.3 * lift) * 4 * age * (1 - age)
      s.position[i * 3 + 2] = z + (spread - 0.5) * 0.1
      s.alpha[i] = shown * 0.8 * (1 - age)
      s.size[i] = 0.06 + 0.08 * age
    })
    s.commit()
  })
}

/** Fishing boats of the Koli moored off Colaba, flying bright flags. */
function koliBoats(site: Site) {
  const colors = ['#e94f37', '#f6c85f', '#3f88c5', '#6fb07f', '#b784a7']
  colors.forEach((flag, k) => {
    const z = 2.6 + (k % 3) * 0.28
    const x = shore(z) + 0.4 + Math.floor(k / 3) * 0.3
    const put = placer(site.b, x, WATER - 0.02, z, 0.3 * k)
    put(new RoundedBoxGeometry(0.26, 0.05, 0.08, 2, 0.02), '#2f5a8a', 0.025, 0.1)
    put(new RoundedBoxGeometry(0.2, 0.02, 0.07, 1, 0.008), '#d9b77a', 0.055, 0)
    put(new THREE.CylinderGeometry(0.003, 0.004, 0.18, 4), '#6b4a33', 0.14, 0)
    put(new RoundedBoxGeometry(0.004, 0.035, 0.05, 1, 0.002).translate(0, 0, 0.026), flag, 0.21, 0)
  })
}

export function buildMumbai() {
  const towers = (x: number, z: number) => Math.max(Math.exp(-((x - 0.6) ** 2 + (z - 2.6) ** 2) / 1), Math.exp(-((x + 1.6) ** 2 + (z + 1.4) ** 2) / 1.5))
  return buildIsland({
    seed: 211,
    centre,
    half,
    grass: '#9db46c',
    water: '#4f8a95',
    hills: [MALABAR],
    // The Hanging Gardens on Malabar Hill, and the Oval Maidan.
    parks: [
      { x: MALABAR.x, z: MALABAR.z, a: 0.8, c: 0.6, h: 0 },
      { x: -0.3, z: 1.4, a: 0.55, c: 0.35, h: 0 },
    ],
    houses: {
      count: 175,
      walls: ['#efe3cf', '#e8d5b5', '#f3e7c4', '#dfe9ea', '#f2d9c4', '#e6e0d4', '#d9c6a5', '#f0c9b0'],
      roofs: ['#8a6f5e', '#b5573f'],
      pitched: 0.12,
      width: [0.24, 0.4],
      floors: (r, x, z) => 2 + Math.floor(r() * (2.5 + 7 * towers(x, z))),
    },
    trees: { count: 30, park: 26, greens: ['#5f9048', '#6c9a4f', '#4f7f3f'], cypress: 0 },
    landmarks(site) {
      gateway(site, shore(3.7) - 0.25, 3.7)
      taj(site, shore(3.1) - 0.45, 3.1)
      terminus(site, -1.3, 2.3)
      hajiAli(site, -3.2)
      marineDrive(site)
      monsoonSpray(site)
      koliBoats(site)
    },
  })
}
