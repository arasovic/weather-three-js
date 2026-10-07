import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { GROUND, house, materials, paint, random, tree } from './kit'
import { BASE, R, WATER, boat, buildIsland, footing, gable, hip, islet, placer, rooted, traffic, type Site } from './island'
import { createSprites } from './sprites'

// The Golden Gate opens at the north end and widens into the bay, with the city
// on the west bank and the Marin Headlands across the strait.
const centre = (z: number) => 1.75 + 0.3 * Math.sin(0.45 * z + 0.6)
const half = (z: number) => 0.95 + 0.3 * THREE.MathUtils.smoothstep(z, -2.4, 1.6)

const ORANGE = '#c4452e'
const STONE = '#e4dac6'
// The Marin Headlands: dry grass on furrowed crests, rock where they fall steeply.
const HEADLAND = { grass: '#b9b26f', rock: '#a39684', rough: 0.4 }
const MARIN = [
  { x: 3.7, z: -2.9, a: 0.95, c: 1.2, h: 0.7, ...HEADLAND },
  { x: 3.95, z: -2, a: 0.75, c: 0.8, h: 0.42, ...HEADLAND },
]
const onHeadland = (x: number, z: number, r = 0) => MARIN.some((m) => ((x - m.x) / (m.a + r)) ** 2 + ((z - m.z) / (m.c + r)) ** 2 < 1)

/**
 * The Golden Gate Bridge. Its two towers stand in the strait; the road climbs from
 * the Presidio on the city side and runs into the headlands on the far side.
 */
function goldenGate(site: Site, z: number) {
  const xw = centre(z) - half(z) + 0.16
  const xe = centre(z) + half(z) - 0.16
  const deck = 0.82
  const top = 1.85
  const put = placer(site.b, 0, 0, z)
  const at = (g: THREE.BufferGeometry, x: number, lz = 0) => (g.translate(x, 0, lz), g)

  for (const x of [xw, xe]) {
    put(at(new RoundedBoxGeometry(0.2, WATER + 0.04 - BASE, 0.4, 2, 0.03), x), '#b9b1a4', (BASE + WATER + 0.04) / 2, 0.3)
    // Each leg steps in at the portals above the road.
    const steps = [[WATER + 0.04, deck + 0.34, 0.085], [deck + 0.34, deck + 0.7, 0.072], [deck + 0.7, top, 0.06]]
    for (const s of [-1, 1]) {
      for (const [y0, y1, w] of steps) put(at(new RoundedBoxGeometry(w, y1 - y0, w * 0.9, 1, 0.01), x, s * 0.13), ORANGE, (y0 + y1) / 2, 0)
    }
    for (const y of [deck - 0.1, deck + 0.34, deck + 0.7, top - 0.04]) put(at(new RoundedBoxGeometry(0.055, 0.07, 0.3, 1, 0.01), x), ORANGE, y, 0)
  }

  // Side span on the city side, then a ramp down to the ground; on the far side the
  // deck runs on until it meets the hill.
  const west = xw - 0.5
  let east = xe + 0.35
  while (east < 5 && site.height(east, z) < deck - 0.02) east += 0.05
  const run = 1.2
  const drop = deck - GROUND
  put(at(new RoundedBoxGeometry(east - west, 0.05, 0.2, 1, 0.01), (west + east) / 2), ORANGE, deck, 0.05)
  put(at(new RoundedBoxGeometry(east - west, 0.05, 0.16, 1, 0.01), (west + east) / 2), '#8e3526', deck - 0.05, 0)
  const ramp = new RoundedBoxGeometry(Math.hypot(run, drop), 0.05, 0.2, 1, 0.01)
  ramp.rotateZ(Math.atan2(drop, run))
  put(at(ramp, west - run / 2), ORANGE, (deck + GROUND) / 2, 0.05)
  for (const x of [west, (xe + east) / 2]) {
    const y0 = site.height(x, z) - 0.02
    put(at(new THREE.CylinderGeometry(0.03, 0.035, deck - y0, 8), x), '#b9b1a4', (deck + y0) / 2, 0.2)
  }
  // A tunnel portal where the road meets the hill.
  put(at(new RoundedBoxGeometry(0.07, 0.2, 0.3, 2, 0.02), east + 0.02), '#cfc6b4', deck + 0.08, 0.2)
  put(at(new RoundedBoxGeometry(0.02, 0.12, 0.18, 1, 0.01), east - 0.02), '#3b3631', deck + 0.06, 0)

  // Main cables: a parabola between the towers and straight backstays to the deck.
  const mid = (xw + xe) / 2
  const span = xe - xw
  const sag = (x: number) => deck + 0.07 + (top - 0.12 - deck) * ((x - mid) / (span / 2)) ** 2
  for (const s of [-1, 1]) {
    const pts = [new THREE.Vector3(west, deck + 0.03, s * 0.13)]
    for (let i = 0; i <= 24; i++) {
      const x = xw + (span * i) / 24
      pts.push(new THREE.Vector3(x, sag(x), s * 0.13))
    }
    pts.push(new THREE.Vector3(Math.min(east, xe + 0.5), deck + 0.03, s * 0.13))
    put(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.1), 96, 0.013, 5), ORANGE, 0, 0)
    for (let x = xw + 0.1; x < xe - 0.05; x += 0.1) {
      const y = sag(x)
      put(at(new THREE.CylinderGeometry(0.004, 0.004, y - deck, 4), x, s * 0.13), ORANGE, (y + deck) / 2, 0)
    }
  }

  site.block((x, bz, r) => Math.abs(bz - z) < 0.3 + r && x > west - run - 0.2 && x < east + 0.2)
  const length = east - west + run
  traffic(site, (s) => {
    const d = s * length
    return new THREE.Vector3(west - run + d, (d < run ? GROUND + (drop * d) / run : deck) + 0.04, z)
  }, 0.05)
}

/** Alcatraz: the cellhouse and the lighthouse on their rock in the bay. */
function alcatraz(site: Site, x: number, z: number) {
  const rot = 0.35
  const top = islet(site, x, z, 0.74, 0.42, rot)
  const put = placer(site.b, x, top, z, rot)
  put(new RoundedBoxGeometry(0.36, 0.13, 0.16, 2, 0.015), '#e5ddcb', 0.065, 0.3)
  put(new RoundedBoxGeometry(0.38, 0.03, 0.18, 1, 0.01), '#bdb5a6', 0.14)
  const tower = new THREE.CylinderGeometry(0.024, 0.034, 0.3, 8)
  tower.translate(0.25, 0, 0)
  put(tower, '#f2eee6', 0.15)
  const cap = new THREE.ConeGeometry(0.032, 0.05, 8)
  cap.translate(0.25, 0, 0)
  put(cap, '#5b6168', 0.36)
  site.b.add(materials.lamps, paint(new THREE.SphereGeometry(0.028, 10, 8), '#f3ead6', 0, 0.01), x + 0.25 * Math.cos(rot), top + 0.32, z - 0.25 * Math.sin(rot))
}

/** On foggy days fog pours in from the Pacific through the Golden Gate, below the tower tops. */
function fogBank(site: Site) {
  const n = 80
  const s = createSprites(n, { color: '#eef1f3', soft: 0.95 })
  const r = random(37)
  const puffs = Array.from({ length: n }, () => [r(), r() * 2 - 1, r()])
  site.group.add(s.points)
  site.animate((t, _wind, m) => {
    const shown = THREE.MathUtils.smoothstep(m.fog, 0.3, 0.8)
    s.points.visible = shown > 0.01
    if (!s.points.visible) return
    s.shade(1 - 0.65 * m.night)
    s.uniforms.uOpacity.value = 0.5 * shown
    puffs.forEach(([phase, across, high], i) => {
      const age = (t * 0.015 + phase) % 1
      const z = -R + age * 7.5
      s.position[i * 3] = centre(z) + across * half(z) * 1.25
      s.position[i * 3 + 1] = 0.35 + high * 0.8
      s.position[i * 3 + 2] = z
      s.alpha[i] = Math.sin(Math.PI * age) * (1 - 0.6 * across * across)
      s.size[i] = 0.9 + high * 0.9
    })
    s.commit()
  })
}

/** Keeps the headlands open and dots their lower slopes with scrub. */
function headlands(site: Site, road: number) {
  site.block((x, z, r) => onHeadland(x, z, r))
  const r = random(23)
  for (let placed = 0, tries = 0; placed < 14 && tries < 200; tries++) {
    const x = 2.6 + r() * 2.2
    const z = -4.2 + r() * 2.8
    const y = site.height(x, z)
    if (!onHeadland(x, z) || y > GROUND + 0.35 || Math.hypot(x, z) > 5.5 || Math.abs(z - road) < 0.25) continue
    const s = 0.35 + r() * 0.25
    tree(site.b, x, rooted(site.height, x, z, 0.035 * s), z, s, r() < 0.5 ? '#6f8a4c' : '#5f7a44')
    placed++
  }
}

/** The Transamerica Pyramid with its two wings near the top. */
function transamerica(site: Site, x: number, z: number) {
  const put = placer(site.b, x, site.height(x, z) - 0.02, z)
  put(new RoundedBoxGeometry(0.42, 0.06, 0.42, 1, 0.015), '#cfc8bb', 0.03, 0.2)
  put(hip(0.34, 2.3), '#eeebe4', 0.06, 0.25)
  for (const s of [-1, 1]) {
    const wing = new RoundedBoxGeometry(0.05, 0.5, 0.09, 1, 0.012)
    wing.translate(s * 0.075, 0, 0)
    put(wing, '#e4e0d8', 1.55, 0)
  }
}

/** Coit Tower, a fluted column on Telegraph Hill. */
function coitTower(site: Site, x: number, z: number) {
  const put = placer(site.b, x, footing(site, x, z, 0.44, 0.44, '#cfc6b4', 0, true), z)
  put(new THREE.CylinderGeometry(0.2, 0.22, 0.08, 16), '#d9cfbb', 0.04, 0.2)
  put(new THREE.CylinderGeometry(0.075, 0.08, 0.62, 12), STONE, 0.39, 0.2)
  put(new THREE.CylinderGeometry(0.092, 0.08, 0.06, 12), '#d8cdb8', 0.73)
  put(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 12), STONE, 0.785)
}

/** The Ferry Building along the Embarcadero, its clock tower facing the bay. */
function ferryBuilding(site: Site, x: number, z: number) {
  const put = placer(site.b, x, GROUND - 0.02, z, Math.PI / 2)
  put(new RoundedBoxGeometry(0.95, 0.2, 0.26, 2, 0.02), STONE, 0.1, 0.3)
  put(gable(0.95, 0.08, 0.28), '#7d8590', 0.2)
  put(new RoundedBoxGeometry(0.14, 0.62, 0.14, 2, 0.012), STONE, 0.31, 0.2)
  put(new RoundedBoxGeometry(0.1, 0.14, 0.1, 1, 0.01), '#d8cdb8', 0.69)
  for (let k = 0; k < 4; k++) {
    const face = new THREE.CylinderGeometry(0.04, 0.04, 0.01, 16)
    face.rotateX(Math.PI / 2)
    face.translate(0, 0, 0.072)
    face.rotateY((k * Math.PI) / 2)
    put(face, '#f3ecd6', 0.52, 0)
  }
  put(hip(0.1, 0.12), '#7d8590', 0.76)
  site.block((bx, bz, r) => Math.abs(bx - x) < 0.18 + r && Math.abs(bz - z) < 0.5 + r)
}

/** A row of Victorian houses in candy colours, gables to the street, before a small park. */
function paintedLadies(site: Site, x: number, z0: number, z1: number) {
  const colors = ['#e9b8c6', '#b8d2e4', '#f0d897', '#c6dcb2', '#d6c2e2', '#f3e3cb']
  const r = random(17)
  const n = colors.length
  const d = (z1 - z0) / n
  colors.forEach((wall, i) => {
    const z = z0 + d * (i + 0.5)
    const y = site.height(x, z) - 0.03
    house(site.b, x, y, z, 0, 0.34, d - 0.02, 2, wall, null, r)
    const roof = gable(0.38, 0.17, d + 0.01)
    site.b.add(materials.clay, paint(roof, '#6c6f78', 0.15, 0.1), x, y + 0.46 + 0.02, z)
  })
  site.reserve(x, (z0 + z1) / 2, (z1 - z0) / 2 + 0.05)
}

export function buildSanFrancisco() {
  const downtown = (x: number, z: number) => Math.exp(-((x + 0.3) ** 2 + (z - 1) ** 2) / 1.3)
  const ferryZ = 1.9
  return buildIsland({
    seed: 31,
    centre,
    half,
    water: '#4f8196',
    // The Marin Headlands across the strait; Telegraph, Nob and Twin Peaks in the city.
    hills: [
      ...MARIN,
      { x: 0, z: -1.2, a: 0.6, c: 0.6, h: 0.32 },
      { x: -1.7, z: 0, a: 1, c: 0.9, h: 0.38 },
      { x: -3.7, z: 0.2, a: 1.1, c: 1.2, h: 0.6 },
    ],
    // The Presidio, Alamo Square and Golden Gate Park.
    parks: [
      { x: -1.6, z: -3.2, a: 1, c: 0.8, h: 0 },
      { x: -3.4, z: 2.3, a: 0.4, c: 0.6, h: 0 },
      { x: -2.4, z: 3.9, a: 1.5, c: 0.45, h: 0 },
    ],
    houses: {
      count: 150,
      walls: ['#f2e4c9', '#e8c7c1', '#c9dbe0', '#dfe8d0', '#f0d9a8', '#d6c4de', '#efe9df', '#b7cbd9'],
      roofs: ['#7c7f86', '#8a6f5e', '#6c6f78'],
      pitched: 0.35,
      pitch: 0.9,
      width: [0.22, 0.4],
      floors: (r, x, z) => 1 + Math.floor(r() * (2 + 7 * downtown(x, z))),
      grid: 0,
    },
    trees: { count: 26, park: 26, greens: ['#6f9a52', '#7ea85c', '#5f8a4a'], cypress: 0.15 },
    landmarks(site) {
      headlands(site, -3.3)
      goldenGate(site, -3.3)
      fogBank(site)
      alcatraz(site, 2.2, 0.3)
      transamerica(site, -0.3, 1)
      site.reserve(-0.3, 1, 0.3)
      coitTower(site, 0, -1.2)
      site.reserve(0, -1.2, 0.24)
      const quay = centre(ferryZ) - half(ferryZ)
      ferryBuilding(site, quay - 0.27, ferryZ)
      paintedLadies(site, -2.8, 1.7, 2.9)
      boat(site, (s) => [quay + 0.3 + (half(ferryZ) * 2 - 0.6) * s, ferryZ], 34, '#2d4a6b', '#f1efe9')
    },
  })
}
