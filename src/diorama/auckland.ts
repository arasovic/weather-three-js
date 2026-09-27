import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { Batch, GROUND, materials, paint, random } from './kit'
import { BASE, TAU, WATER, boat, buildIsland, grassAndStone, placer, strut, traffic, type Site } from './island'

// Waitematā Harbour: the city on the west shore, Devonport and the North Shore on the
// east, opening at the south end into the Hauraki Gulf, where Rangitoto rises.
const centre = (z: number) => 0.3 + 0.35 * Math.sin(0.4 * z)
const half = (z: number) => 0.6 + 1.6 * THREE.MathUtils.smoothstep(z, 1.5, 4.5)

const SKY_TOWER = { x: -1.4, z: 0.3 }
const MT_EDEN = { x: -3.1, z: 1.4 }
const MT_VICTORIA = { x: 2.3, z: 0.9 }
const RANGITOTO = { x: 1.1, z: 3.9 }

/** A volcanic cone with a crater at the top, grassed or bush-clad. */
function cone(radius: number, height: number, crater: number) {
  const profile = [[radius, -0.05], [radius * 0.75, height * 0.35], [radius * 0.45, height * 0.85], [radius * 0.3, height], [crater, height * 0.8], [0, height * 0.75]]
  const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 40)
  g.computeVertexNormals()
  return g
}

/** Mt Eden and Mt Victoria: grassy volcanic cones with craters, one in each part of town. */
function volcanoes(site: Site) {
  for (const [{ x, z }, radius, height] of [[MT_EDEN, 0.75, 0.5], [MT_VICTORIA, 0.55, 0.36]] as const) {
    site.b.add(materials.clay, grassAndStone(cone(radius, height, radius * 0.18), '#8fb86a', '#9b8f82'), x, GROUND - 0.02, z)
    site.reserve(x, z, radius + 0.05)
  }
}

/** Rangitoto: a broad, even shield volcano out in the gulf, dark with bush, with a small crater. */
function rangitoto(site: Site) {
  const { x, z } = RANGITOTO
  const g = cone(1, 0.55, 0.05)
  g.scale(1, 1, 0.9)
  site.b.add(materials.clay, grassAndStone(g, '#5f7a44', '#6d655e'), x, BASE, z)
}

/** The Sky Tower: a slim shaft, the pod of decks near the top, and the mast, lit at night. */
function skyTower(site: Site, x: number, z: number) {
  const put = placer(site.b, x, GROUND - 0.02, z)
  put(new THREE.CylinderGeometry(0.16, 0.2, 0.12, 16), '#d9d5cc', 0.06, 0.3)
  put(new THREE.CylinderGeometry(0.05, 0.075, 2.1, 12), '#e9e6df', 1.17, 0.2)
  for (const [y, r, h] of [[2.12, 0.15, 0.08], [2.22, 0.17, 0.1], [2.33, 0.14, 0.08]]) put(new THREE.CylinderGeometry(r, r * 0.9, h, 20), '#c9ced3', y, 0)
  site.b.add(materials.leds, paint(new THREE.CylinderGeometry(0.018, 0.035, 0.6, 8), '#e9eef2', 0), x, GROUND - 0.02 + 2.67, z)
  site.reserve(x, z, 0.3)
}

/** The Harbour Bridge: a deck that climbs over the navigation span on a steel truss below it. */
function harbourBridge(site: Site, z: number) {
  const x0 = centre(z) - half(z) - 0.9
  const x1 = centre(z) + half(z) + 0.9
  const mid = (x0 + x1) / 2
  const span = (x1 - x0) / 2
  const deck = (x: number) => GROUND + 0.02 + 0.34 * Math.max(0, 1 - ((x - mid) / span) ** 2) ** 0.8
  const steel = '#7b8b84'
  const pts = Array.from({ length: 33 }, (_, i) => {
    const x = x0 + ((x1 - x0) * i) / 32
    return new THREE.Vector3(x, deck(x), z)
  })
  const girder = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 64, 0.02, 4)
  for (const s of [-1, 1]) {
    const edge = girder.clone()
    edge.translate(0, 0, s * 0.07)
    site.b.add(materials.landmark, paint(edge, steel, 0, 1))
  }
  // A flat road deck between the two edge girders.
  const slab = new THREE.PlaneGeometry(x1 - x0, 0.14, 32, 1)
  slab.rotateX(-Math.PI / 2)
  const pos = slab.attributes.position
  for (let i = 0; i < pos.count; i++) pos.setY(i, deck(pos.getX(i) + mid) + 0.012)
  slab.computeVertexNormals()
  site.b.add(materials.landmark, paint(slab, '#8d9a94', 0, 1), mid, 0, z)
  // The truss under the main span, deepest over the piers.
  const piers = [centre(z) - half(z) + 0.12, centre(z) + half(z) - 0.12]
  const lower = (x: number) => deck(x) - 0.04 - 0.16 * (Math.abs(x - mid) / (piers[1] - mid)) ** 2
  for (const s of [-1, 1]) {
    for (let x = piers[0]; x < piers[1] - 0.01; x += 0.1) {
      const a = new THREE.Vector3(x, lower(x), z + s * 0.07)
      const b = new THREE.Vector3(x + 0.1, lower(x + 0.1), z + s * 0.07)
      site.b.add(materials.landmark, paint(strut(a, b, 0.008, 0.008, 4), steel, 0, 1))
      site.b.add(materials.landmark, paint(strut(a, new THREE.Vector3(x, deck(x), z + s * 0.07), 0.005, 0.005, 4), steel, 0, 1))
      site.b.add(materials.landmark, paint(strut(a, new THREE.Vector3(x + 0.1, deck(x + 0.1), z + s * 0.07), 0.005, 0.005, 4), steel, 0, 1))
    }
  }
  for (let x = x0 + 0.25; x < x1 - 0.2; x += 0.3) {
    const bottom = Math.abs(x - centre(z)) < half(z) ? BASE : GROUND - 0.02
    const top = Math.abs(x - mid) < piers[1] - mid + 0.05 ? lower(x) : deck(x)
    const pier = new THREE.CylinderGeometry(0.03, 0.04, top - bottom, 8)
    site.b.add(materials.landmark, paint(pier, '#b9b1a4', 0.2, 0.2), x, (top + bottom) / 2, z)
  }
  site.block((bx, bz, r) => Math.abs(bz - z) < 0.2 + r && bx > x0 - 0.2 && bx < x1 + 0.2)
  traffic(site, (s) => new THREE.Vector3(x0 + (x1 - x0) * s, deck(x0 + (x1 - x0) * s) + 0.05, z), 0.04)
}

/** The City of Sails: yachts come out on the harbour on breezy days and heel in the wind. */
function sailboats(site: Site) {
  const b = new Batch()
  b.add(materials.clay, paint(new RoundedBoxGeometry(0.16, 0.03, 0.05, 1, 0.012), '#f4f2ee', 0), 0, 0.015, 0)
  b.add(materials.clay, paint(new THREE.CylinderGeometry(0.003, 0.003, 0.2, 4), '#c9c6bf', 0), 0.01, 0.13, 0)
  const sail = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0.08, 0), new THREE.Vector2(0, 0.18)])
  b.add(materials.clay, paint(new THREE.ShapeGeometry(sail).translate(-0.07, 0.04, 0), '#fbfaf7', 0), 0, 0, 0)
  const yacht = b.build(false)
  yacht.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.material = o.material.clone()
      o.material.side = THREE.DoubleSide
    }
  })
  const r = random(173)
  const fleet = Array.from({ length: 10 }, () => {
    const m = yacht.clone()
    m.visible = false
    site.group.add(m)
    return { m, z: -1.2 + r() * 4.4, lane: r() * 1.4 - 0.7, speed: 0.04 + r() * 0.04, phase: r() * TAU }
  })
  let shown = 0
  site.animate((t, wind, m) => {
    shown += ((m.day > 0.3 && wind.length() > 4 && m.rain < 0.2 ? 1 : 0) - shown) * 0.02
    const heel = Math.min(wind.length() / 12, 1) * 0.35
    for (const f of fleet) {
      f.m.visible = shown > 0.01
      if (!f.m.visible) continue
      const a = t * f.speed + f.phase
      const z = f.z + 0.5 * Math.sin(a)
      f.m.position.set(centre(z) + f.lane * half(z) * 0.8 + 0.15 * Math.cos(a), WATER - 0.01, z)
      f.m.rotation.set(0, Math.atan2(-Math.cos(a), -Math.sin(a) * 0.15), heel * Math.sign(Math.cos(a)))
      f.m.scale.setScalar(1.4 * shown)
    }
  })
}

/**
 * Pohutukawa along the shore: dark green most of the year, crimson with flowers in
 * December, New Zealand's Christmas tree.
 */
function pohutukawa(site: Site) {
  const trunks = new Batch()
  const green = new Batch()
  const red = new Batch()
  const r = random(179)
  for (let z = -3.8; z < 2.8; z += 0.55) {
    for (const s of [-1, 1]) {
      const along = z + (r() - 0.5) * 0.25
      const x = centre(along) + s * (half(along) + 0.24 + r() * 0.1)
      if (r() < 0.3 || Math.hypot(x, along) > 5.2 || Math.abs(along + 2.6) < 0.35) continue
      const size = 0.7 + r() * 0.3
      trunks.add(materials.trees, paint(new THREE.CylinderGeometry(0.02 * size, 0.03 * size, 0.16 * size, 6), '#6b4a33', 0.2, 0.1), x, GROUND - 0.02 + 0.08 * size, along)
      const crown = new THREE.SphereGeometry(0.19 * size, 10, 8)
      crown.scale(1.25, 0.75, 1.25)
      green.add(materials.trees, paint(crown.clone(), '#3f6b3a', 0.3, 0.2), x, GROUND - 0.02 + 0.24 * size, along)
      red.add(materials.trees, paint(crown, '#c0283a', 0.3, 0.2), x, GROUND - 0.02 + 0.24 * size, along)
      site.reserve(x, along, 0.15)
    }
  }
  const [crownsGreen, crownsRed] = [green.build(), red.build()]
  site.group.add(trunks.build(), crownsGreen, crownsRed)
  site.animate((_t, _wind, m) => {
    crownsRed.visible = m.month === 12
    crownsGreen.visible = !crownsRed.visible
  })
}

export function buildAuckland() {
  const cbd = (x: number, z: number) => Math.exp(-((x - SKY_TOWER.x) ** 2 / 0.9 + (z - SKY_TOWER.z) ** 2 / 1.6))
  const ferryZ = 1.3
  return buildIsland({
    seed: 181,
    centre,
    half,
    grass: '#8fb86a',
    water: '#3d8fa0',
    // Albert Park beside the city centre.
    parks: [{ x: -2.1, z: -0.9, a: 0.5, c: 0.5, h: 0 }],
    houses: {
      count: 140,
      walls: ['#f4f2ee', '#dfe9ee', '#e3ecd9', '#f3e7c4', '#e9e4da', '#d7e1e8', '#f2dccf'],
      roofs: ['#b5573f', '#4f6f5e', '#6b6f75', '#8a3f3a'],
      pitched: 0.7,
      pitch: 0.8,
      width: [0.22, 0.38],
      floors: (r, x, z) => 1 + Math.floor(r() * (1.5 + 7 * cbd(x, z))),
    },
    trees: { count: 26, park: 20, greens: ['#5f8a4a', '#6f9a52', '#4f7f3f'], cypress: 0 },
    landmarks(site) {
      skyTower(site, SKY_TOWER.x, SKY_TOWER.z)
      volcanoes(site)
      rangitoto(site)
      harbourBridge(site, -2.6)
      pohutukawa(site)
      sailboats(site)
      const from = centre(ferryZ) - half(ferryZ) + 0.3
      const to = centre(ferryZ) + half(ferryZ) - 0.3
      boat(site, (s) => [from + (to - from) * s, ferryZ], 34, '#2f5a8a', '#f2efe6', 0.8)
    },
  })
}
