import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { Batch, GROUND, materials, paint } from './kit'
import { TAU, WATER, boat, buildIsland, gable, hip, placer, type Site } from './island'

// The Grand Canal winds through the city in a reversed S and opens into the
// basin of San Marco at the south end.
const centre = (z: number) => 0.2 + 1.2 * Math.sin(0.55 * z)
const half = (z: number) => 0.32 + 1.1 * THREE.MathUtils.smoothstep(z, 2.6, 4.6)
const east = (z: number) => centre(z) + half(z)
const west = (z: number) => centre(z) - half(z)

const ISTRIAN = '#efe8da'
const BRICK = '#b8664e'
const PIAZZA = { x0: 2.25, x1: 3.55, z0: 1.75, z1: 2.55 }
// The Piazzetta runs from the square down to the water beside the Doge's Palace.
const SQUARE = [PIAZZA, { x0: 2.25, x1: 2.85, z0: 2.5, z1: 3.55 }]

/** An arched bridge across the canal at z, its deck rising from both banks. Returns its height at x. */
function arch(site: Site, z: number, rise: number, width: number, color: string) {
  const x0 = west(z) - 0.3
  const x1 = east(z) + 0.3
  const mid = (x0 + x1) / 2
  const span = (x1 - x0) / 2
  const top = (x: number) => 0.06 + rise * (1 - ((x - mid) / span) ** 2)
  const bottom = (x: number) => Math.max(0, rise * 1.2 * (1 - ((x - mid) / (half(z) + 0.05)) ** 2))
  const shape = new THREE.Shape()
  const n = 24
  shape.moveTo(x0, 0)
  for (let i = 1; i <= n; i++) shape.lineTo(x0 + ((x1 - x0) * i) / n, bottom(x0 + ((x1 - x0) * i) / n))
  for (let i = n; i >= 0; i--) shape.lineTo(x0 + ((x1 - x0) * i) / n, top(x0 + ((x1 - x0) * i) / n))
  const g = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false })
  g.translate(0, 0, -width / 2)
  g.computeVertexNormals()
  placer(site.b, 0, GROUND - 0.03, z)(g, color, 0, 0.1)
  site.block((bx, bz, r) => Math.abs(bz - z) < width / 2 + r + 0.05 && bx > x0 - 0.25 && bx < x1 + 0.25)
  return (x: number) => GROUND - 0.03 + top(x)
}

/** The Rialto Bridge: a stone arch carrying two rows of shops and a portico at the crown. */
function rialto(site: Site, z: number) {
  const deck = arch(site, z, 0.2, 0.34, ISTRIAN)
  const c = centre(z)
  for (const lx of [-0.34, -0.22, 0.22, 0.34]) {
    const y = deck(c + lx)
    for (const s of [-1, 1]) {
      const put = placer(site.b, c + lx, y, z + s * 0.11)
      put(new RoundedBoxGeometry(0.11, 0.07, 0.08, 1, 0.01), ISTRIAN, 0.035, 0.2)
      put(gable(0.12, 0.04, 0.1), '#b5573f', 0.07, 0)
    }
  }
  const put = placer(site.b, c, deck(c), z)
  put(new RoundedBoxGeometry(0.16, 0.11, 0.3, 1, 0.012), ISTRIAN, 0.055, 0.2)
  const roof = gable(0.32, 0.06, 0.18)
  roof.rotateY(Math.PI / 2)
  put(roof, '#b5573f', 0.11, 0)
}

/** St Mark's Campanile: a brick shaft, the arched belfry, and a green spire with the gilded angel. */
function campanile(site: Site, x: number, z: number) {
  const put = placer(site.b, x, GROUND - 0.02, z)
  put(new RoundedBoxGeometry(0.2, 1.2, 0.2, 2, 0.01), BRICK, 0.6, 0.3)
  put(new RoundedBoxGeometry(0.21, 0.16, 0.21, 1, 0.01), ISTRIAN, 1.28, 0)
  for (let k = 0; k < 4; k++) {
    const opening = new RoundedBoxGeometry(0.1, 0.1, 0.01, 1, 0.004)
    opening.translate(0, 0, 0.106)
    opening.rotateY((k * Math.PI) / 2)
    put(opening, '#4a3f3a', 1.28, 0)
  }
  put(new RoundedBoxGeometry(0.19, 0.12, 0.19, 1, 0.01), BRICK, 1.42, 0)
  put(hip(0.19, 0.36), '#6f9a86', 1.48, 0)
  put(new THREE.ConeGeometry(0.012, 0.05, 6), '#d9ad3c', 1.87, 0)
}

/** The Basilica of San Marco: a cross of five lead domes over a front of arches. */
function basilica(site: Site, x: number, z: number) {
  const put = placer(site.b, x, GROUND - 0.02, z)
  put(new RoundedBoxGeometry(0.55, 0.26, 0.55, 2, 0.02), '#e9ddc6', 0.13, 0.3)
  for (let i = 0; i < 5; i++) {
    const arcade = new RoundedBoxGeometry(0.02, 0.16, 0.08, 1, 0.006)
    arcade.translate(-0.28, 0, -0.2 + i * 0.1)
    put(arcade, '#c9a86a', 0.1, 0)
  }
  for (const [lx, lz, r] of [[0, 0, 0.13], [0.2, 0, 0.09], [-0.2, 0, 0.09], [0, 0.2, 0.09], [0, -0.2, 0.09]]) {
    const dome = new THREE.SphereGeometry(r, 16, 8, 0, TAU, 0, Math.PI / 2)
    dome.scale(1, 1.25, 1)
    dome.translate(lx, 0, lz)
    put(dome, '#8e9aa3', 0.26, 0)
    const lantern = new THREE.ConeGeometry(0.02, 0.07, 6)
    lantern.translate(lx, 0, lz)
    put(lantern, '#d9ad3c', 0.26 + r * 1.25 + 0.02, 0)
  }
  site.reserve(x, z, 0.4)
}

/** The Doge's Palace on the waterfront: a pink block on two tiers of white arcades. */
function dogesPalace(site: Site, x: number, z: number) {
  const put = placer(site.b, x, GROUND - 0.02, z)
  put(new RoundedBoxGeometry(0.34, 0.14, 0.7, 1, 0.012), ISTRIAN, 0.07, 0.3)
  put(new RoundedBoxGeometry(0.34, 0.16, 0.7, 1, 0.012), '#e9b7a6', 0.22, 0.1)
  put(new RoundedBoxGeometry(0.36, 0.03, 0.72, 1, 0.008), ISTRIAN, 0.31, 0)
  for (let i = 0; i < 9; i++) {
    const column = new THREE.CylinderGeometry(0.01, 0.011, 0.12, 6)
    column.translate(-0.175, 0, -0.32 + i * 0.08)
    put(column, '#f7f2e8', 0.06, 0)
  }
  site.reserve(x, z, 0.1)
  site.block((bx, bz, r) => Math.abs(bx - x) < 0.2 + r && Math.abs(bz - z) < 0.38 + r)
}

/** Santa Maria della Salute at the mouth of the canal: an octagon under a great dome. */
function salute(site: Site, x: number, z: number) {
  const put = placer(site.b, x, GROUND - 0.02, z)
  put(new THREE.CylinderGeometry(0.34, 0.36, 0.3, 8), ISTRIAN, 0.15, 0.3)
  put(new THREE.CylinderGeometry(0.24, 0.25, 0.16, 16), ISTRIAN, 0.38, 0.1)
  for (let k = 0; k < 8; k++) {
    const scroll = new THREE.SphereGeometry(0.045, 8, 6)
    scroll.translate(Math.cos((k * TAU) / 8) * 0.29, 0, Math.sin((k * TAU) / 8) * 0.29)
    put(scroll, ISTRIAN, 0.32, 0)
  }
  const dome = new THREE.SphereGeometry(0.25, 20, 10, 0, TAU, 0, Math.PI / 2)
  dome.scale(1, 1.2, 1)
  put(dome, '#a9b1b6', 0.46, 0)
  put(new THREE.CylinderGeometry(0.05, 0.06, 0.1, 10), ISTRIAN, 0.8, 0)
  put(new THREE.ConeGeometry(0.03, 0.12, 8), '#a9b1b6', 0.9, 0)
  const small = new THREE.SphereGeometry(0.13, 14, 8, 0, TAU, 0, Math.PI / 2)
  small.translate(-0.42, 0, 0)
  put(small, '#a9b1b6', 0.3, 0)
  for (const lz of [-0.12, 0.12]) {
    const tower = new RoundedBoxGeometry(0.07, 0.42, 0.07, 1, 0.008)
    tower.translate(-0.55, 0, lz)
    put(tower, ISTRIAN, 0.21, 0.2)
  }
  const drum = new RoundedBoxGeometry(0.24, 0.22, 0.34, 1, 0.012)
  drum.translate(-0.42, 0, 0)
  put(drum, ISTRIAN, 0.11, 0.3)
  site.reserve(x - 0.15, z, 0.6)
}

/** Gondolas rowed up and down the canal, each with its gondolier standing at the stern. */
function gondolas(site: Site) {
  const b = new Batch()
  const hull = new THREE.SphereGeometry(1, 16, 6)
  hull.scale(0.2, 0.025, 0.035)
  const pos = hull.attributes.position
  // Raise both ends into the gondola's long curve.
  for (let i = 0; i < pos.count; i++) pos.setY(i, pos.getY(i) + 0.9 * (pos.getX(i) / 0.2) ** 4 * 0.05)
  hull.computeVertexNormals()
  b.add(materials.clay, paint(hull, '#1f2226', 0), 0, 0.02, 0)
  b.add(materials.clay, paint(new RoundedBoxGeometry(0.008, 0.05, 0.03, 1, 0.003), '#d9d9d9', 0), 0.2, 0.07, 0)
  b.add(materials.clay, paint(new THREE.CylinderGeometry(0.009, 0.011, 0.07, 6), '#f2efe9', 0), -0.14, 0.09, 0)
  b.add(materials.clay, paint(new THREE.SphereGeometry(0.01, 8, 6), '#c98a6a', 0), -0.14, 0.135, 0)
  b.add(materials.clay, paint(new THREE.CylinderGeometry(0.003, 0.003, 0.16, 4).rotateZ(0.5), '#6b4a33', 0), -0.11, 0.08, 0.02)
  const mesh = b.build()
  const routes = [[-3.6, -0.6, 0.12, 40], [-1.5, 2.2, -0.12, 52], [0.5, 3.4, 0.08, 46]]
  const gondola = routes.map(() => {
    const m = mesh.clone()
    site.group.add(m)
    return m
  })
  site.animate((t, wind) => {
    routes.forEach(([z0, z1, offset, period], i) => {
      const p = ((t + i * 13) % period) / period
      const s = p < 0.5 ? THREE.MathUtils.smoothstep(p, 0.05, 0.45) : 1 - THREE.MathUtils.smoothstep(p, 0.55, 0.95)
      const z = z0 + (z1 - z0) * s
      const dz = (z1 - z0) * (p < 0.5 ? 1 : -1)
      const g = gondola[i]
      g.position.set(centre(z) + offset * half(z) * 2, WATER - 0.01 + Math.sin(t * 1.9 + i) * 0.004 * (1 + Math.min(wind.length() / 12, 1)), z)
      g.rotation.y = Math.atan2(-dz, (centre(z + 0.01 * Math.sign(dz)) - centre(z)) * 100)
    })
  })
}

/**
 * Acqua alta: from autumn to spring, when a storm drives the sea into the lagoon,
 * the water rises over St Mark's Square.
 */
function acquaAlta(site: Site) {
  const material = new THREE.MeshStandardMaterial({ color: '#3f7f86', roughness: 0.08, transparent: true, opacity: 0, depthWrite: false })
  const floods = SQUARE.map(({ x0, x1, z0, z1 }) => {
    const flood = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2), material)
    flood.position.set((x0 + x1) / 2, GROUND, (z0 + z1) / 2)
    flood.receiveShadow = true
    site.group.add(flood)
    return flood
  })
  let level = 0
  site.animate((_t, wind, m) => {
    const season = m.month >= 10 || m.month <= 3
    level += ((season && wind.length() > 7 && m.rain > 0.1 ? 1 : 0) - level) * 0.01
    material.opacity = 0.85 * level
    for (const flood of floods) {
      flood.visible = level > 0.01
      // Above the paving, which stands 0.006 proud of the ground.
      flood.position.y = GROUND + 0.008 + 0.02 * level
    }
  })
}

export function buildVenice() {
  return buildIsland({
    seed: 149,
    centre,
    half,
    grass: '#b9b09a',
    water: '#4f8f8a',
    houses: {
      count: 190,
      walls: ['#d98b6a', '#e8b48a', '#c96a4f', '#f0d9b5', '#e3a07a', '#d9c09a', '#b85c45', '#f2e2c6', '#e7c9a0'],
      roofs: ['#b5573f', '#a44e3a', '#c26b48'],
      pitched: 0.85,
      pitch: 0.5,
      width: [0.22, 0.36],
      floors: (r) => 2 + Math.floor(r() * 2.5),
    },
    trees: { count: 8, park: 0, greens: ['#6f9a52', '#7ea85c'], cypress: 0.3 },
    landmarks(site) {
      for (const { x0, x1, z0, z1 } of SQUARE) {
        site.b.add(materials.clay, paint(new RoundedBoxGeometry(x1 - x0, 0.012, z1 - z0, 1, 0.004), '#d9d0bf', 0), (x0 + x1) / 2, GROUND, (z0 + z1) / 2)
        site.block((x, z, r) => x > x0 - r && x < x1 + r && z > z0 - r && z < z1 + r)
      }
      const { x0, x1, z0, z1 } = PIAZZA
      basilica(site, x1 + 0.2, (z0 + z1) / 2)
      campanile(site, x0 + 0.25, z1 + 0.15)
      site.reserve(x0 + 0.25, z1 + 0.15, 0.16)
      dogesPalace(site, east(3.1) + 0.3, 3.1)
      salute(site, west(3.25) - 0.4, 3.25)
      rialto(site, -2.5)
      arch(site, 1.7, 0.16, 0.2, '#9a7a5a')
      gondolas(site)
      acquaAlta(site)
      boat(site, (s) => {
        const z = -4 + 6.8 * s
        return [centre(z) - 0.12, z]
      }, 60, '#e9e4d8', '#3a4a5a', 0.75)
    },
  })
}
