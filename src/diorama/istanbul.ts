import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { GROUND, cypress, materials, paint } from './kit'
import { BASE, TAU, WATER, boat, buildIsland, placer, traffic, type Put, type Site } from './island'

// The Bosphorus runs north to south (north is -z): centre line and half width along z.
const centre = (z: number) => -0.3 + 0.55 * Math.sin(0.42 * z + 0.3)
const half = (z: number) => 0.78 + 0.14 * Math.sin(0.8 * z + 0.5)

function galata(site: Site, x: number, z: number) {
  const put = placer(site.b, x, site.height(x, z) - 0.12, z)
  const stone = '#dac9ab'
  put(new THREE.CylinderGeometry(0.3, 0.33, 0.26, 28), '#cbb897', 0.13, 0.3)
  put(new THREE.CylinderGeometry(0.2, 0.22, 1.06, 28), stone, 0.26 + 0.53, 0.25)
  for (const h of [0.55, 0.85]) put(new THREE.CylinderGeometry(0.212, 0.212, 0.06, 28), '#7d6c5a', h)
  put(new THREE.CylinderGeometry(0.26, 0.24, 0.05, 28), stone, 1.34)
  put(new THREE.CylinderGeometry(0.205, 0.205, 0.16, 28), '#6b5b4d', 1.44)
  put(new THREE.CylinderGeometry(0.235, 0.235, 0.03, 28), stone, 1.53)
  put(new THREE.ConeGeometry(0.25, 0.5, 28), '#5d6b7b', 1.545 + 0.25)
  put(new THREE.SphereGeometry(0.028, 10, 8), '#c9a24a', 2.07)
}

function minaret(put: Put, h: number) {
  put(new THREE.CylinderGeometry(0.034, 0.042, h, 12), '#f1ebe1', h / 2, 0.1)
  for (const f of [0.55, 0.75, 0.92]) put(new THREE.CylinderGeometry(0.058, 0.048, 0.025, 14), '#e6dfd3', h * f)
  put(new THREE.ConeGeometry(0.043, 0.24, 12), '#8492a1', h + 0.12)
}

function mosque(site: Site, x: number, z: number, rot: number) {
  const y = site.height(x, z) - 0.02
  const put = (lx: number, lz: number) => placer(site.b, x, y, z, rot, lx, lz)
  const lead = '#8d99a6'
  const wall = '#ece5d9'
  put(0, 0)(new RoundedBoxGeometry(1.2, 0.36, 1.2, 2, 0.03), wall, 0.14, 0.3)
  put(0, 1.1)(new RoundedBoxGeometry(1.1, 0.14, 0.95, 2, 0.03), '#e2dbcd', 0.03, 0.2)
  for (const lx of [-0.52, 0, 0.52]) put(lx, 1.5)(new THREE.SphereGeometry(0.1, 14, 6, 0, TAU, 0, Math.PI / 2), lead, 0.1)
  put(0, 0)(new THREE.CylinderGeometry(0.36, 0.38, 0.12, 36), wall, 0.38)
  const dome = new THREE.SphereGeometry(0.4, 36, 12, 0, TAU, 0, Math.PI / 2)
  dome.scale(1, 0.85, 1)
  put(0, 0)(dome, lead, 0.44)
  put(0, 0)(new THREE.ConeGeometry(0.025, 0.14, 8), '#c9a24a', 0.84)
  for (let k = 0; k < 4; k++) {
    const semi = new THREE.SphereGeometry(0.27, 24, 8, 0, Math.PI, 0, Math.PI / 2)
    semi.rotateY((k * Math.PI) / 2)
    const a = (k * Math.PI) / 2
    put(Math.sin(a) * 0.32, Math.cos(a) * 0.32)(semi, lead, 0.32)
  }
  for (const [lx, lz] of [[-0.44, -0.44], [0.44, -0.44], [-0.44, 0.44], [0.44, 0.44]]) {
    put(lx, lz)(new THREE.SphereGeometry(0.14, 16, 6, 0, TAU, 0, Math.PI / 2), lead, 0.3)
  }
  for (const [lx, lz] of [[-0.66, -0.66], [0.66, -0.66], [-0.66, 0.66], [0.66, 0.66]]) minaret(put(lx, lz), 1.3)
  for (const lx of [-0.62, 0.62]) minaret(put(lx, 1.62), 1.05)
}

function maidensTower(site: Site, x: number, z: number) {
  const put = placer(site.b, x, BASE, z)
  put(new THREE.CylinderGeometry(0.22, 0.27, 0.24, 14), '#8c7d6d', 0.12, 0.3)
  put(new RoundedBoxGeometry(0.26, 0.12, 0.16, 2, 0.015), '#ece5d9', 0.3)
  put(new THREE.CylinderGeometry(0.055, 0.06, 0.34, 16), '#ece5d9', 0.41, 0.1)
  put(new THREE.ConeGeometry(0.068, 0.14, 16), '#8492a1', 0.65)
}

function bridge(site: Site, z: number) {
  const xw = centre(z) - half(z) - 0.15
  const xe = centre(z) + half(z) + 0.15
  const b = site.b
  const deck = 0.95
  const top = 1.78
  const grey = '#d5d8da'
  const put = placer(b, 0, 0, z)
  const piece = (g: THREE.BufferGeometry, px: number, py: number) => {
    g.translate(px, 0, 0)
    put(g, grey, py, 0.05)
  }
  for (const x of [xw, xe]) {
    const y0 = site.height(x, z) - 0.02
    for (const s of [-1, 1]) {
      const leg = new RoundedBoxGeometry(0.07, top - y0, 0.07, 1, 0.012)
      leg.translate(0, 0, s * 0.11)
      piece(leg, x, (top + y0) / 2)
    }
    for (const h of [deck - 0.06, top - 0.03]) piece(new RoundedBoxGeometry(0.06, 0.05, 0.28, 1, 0.01), x, h)
  }
  // Deck over the strait, then ramps down to the ground on both sides.
  const inner = [xw - 0.45, xe + 0.45]
  piece(new RoundedBoxGeometry(inner[1] - inner[0], 0.045, 0.2, 1, 0.01), (inner[0] + inner[1]) / 2, deck)
  for (const [x0, dir] of [[inner[0], -1], [inner[1], 1]] as const) {
    const run = 1.3
    const drop = deck - GROUND
    const ramp = new RoundedBoxGeometry(Math.hypot(run, drop), 0.045, 0.2, 1, 0.01)
    ramp.rotateZ(dir * -Math.atan2(drop, run))
    piece(ramp, x0 + (dir * run) / 2, (deck + GROUND) / 2)
    piece(new THREE.CylinderGeometry(0.03, 0.035, deck - GROUND, 8), x0, (deck + GROUND) / 2)
  }

  site.block((x, bz, r) => Math.abs(bz - z) < 0.32 + r && x > xw - 2 && x < xe + 2)
  const run = 1.3
  const length = inner[1] - inner[0] + 2 * run
  traffic(site, (s) => {
    const d = s * length
    const x = inner[0] - run + d
    const y = d < run ? GROUND + ((deck - GROUND) * d) / run : d > length - run ? GROUND + ((deck - GROUND) * (length - d)) / run : deck
    return new THREE.Vector3(x, y + 0.04, z)
  }, 0.05)

  // Main cables: a parabola across the span and straight backstays to the ramps.
  const mid = (xw + xe) / 2
  const span = xe - xw
  for (const s of [-1, 1]) {
    const pts: THREE.Vector3[] = []
    const anchor = (x: number) => new THREE.Vector3(x, deck + 0.02, s * 0.1)
    pts.push(anchor(inner[0]))
    for (let i = 0; i <= 24; i++) {
      const x = xw + (span * i) / 24
      pts.push(new THREE.Vector3(x, deck + 0.08 + (top - deck - 0.08) * ((x - mid) / (span / 2)) ** 2, s * 0.1))
    }
    pts.push(anchor(inner[1]))
    const cable = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.1), 96, 0.012, 5)
    paint(cable, grey, 0, 1)
    b.add(materials.leds, cable, 0, 0, z)
    for (let x = xw + 0.12; x < xe - 0.06; x += 0.12) {
      const y = deck + 0.08 + (top - deck - 0.08) * ((x - mid) / (span / 2)) ** 2
      const hanger = new THREE.CylinderGeometry(0.005, 0.005, y - deck, 4)
      paint(hanger, grey, 0, 1)
      b.add(materials.leds, hanger, x, (y + deck) / 2, z + s * 0.1)
    }
  }
}

export function buildIstanbul() {
  const ferryZ = 1.0
  return buildIsland({
    seed: 7,
    centre,
    half,
    // Galata hill on the European side, Çamlıca park on the Asian side.
    hills: [
      { x: -2.4, z: -0.9, a: 1.3, c: 1.1, h: 0.26 },
      { x: 2.9, z: -1.2, a: 1.6, c: 1.6, h: 0.45 },
    ],
    parks: [{ x: 2.9, z: -1.2, a: 1.43, c: 1.43, h: 0 }],
    houses: {
      count: 120,
      walls: ['#e8c9a0', '#d98e73', '#efe3cf', '#c9d4c5', '#e3b7a0', '#b8c7d6', '#f0dcc0'],
      roofs: ['#b5573f', '#a44e3a', '#bd6446'],
      pitched: 0.75,
      width: [0.24, 0.46],
      floors: (r) => 1 + Math.floor(r() * r() * 4.5),
    },
    trees: { count: 30, park: 26, greens: ['#7fa45a', '#6b9150', '#8bb262'], cypress: 0.35 },
    landmarks(site) {
      galata(site, -2.3, -0.8)
      site.reserve(-2.3, -0.8, 0.45)
      mosque(site, -2.6, 2.3, -Math.PI / 2)
      site.reserve(-3.05, 2.3, 1.25)
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * TAU + 0.2
        const x = -3.05 + Math.cos(a) * 1.35
        const z = 2.3 + Math.sin(a) * 1.35
        if (x > centre(z) - half(z) - 0.25) continue
        cypress(site.b, x, site.height(x, z) - 0.02, z, 0.8 + ((i * 7) % 5) * 0.1)
        site.reserve(x, z, 0.06)
      }
      maidensTower(site, centre(3.3) + 0.3, 3.3)
      bridge(site, -3.4)
      for (const side of [-1, 1]) {
        const x = centre(ferryZ) + side * (half(ferryZ) - 0.1)
        site.b.add(materials.clay, paint(new RoundedBoxGeometry(0.34, 0.05, 0.14, 1, 0.01), '#8a6f55', 0), x, WATER + 0.03, ferryZ)
        site.reserve(x + side * 0.1, ferryZ, 0.35)
      }
      const from = centre(ferryZ) - half(ferryZ) + 0.32
      const to = centre(ferryZ) + half(ferryZ) - 0.32
      boat(site, (s) => [from + (to - from) * s, ferryZ], 30, '#2c3139', '#f3f1ec')
    },
  })
}
