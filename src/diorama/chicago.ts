import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { Batch, GROUND, house, materials, paint, random } from './kit'
import { WATER, boat, buildIsland, ferrisWheel, placer, traffic, type Moment, type Site } from './island'

// The Chicago River runs past the Loop and opens at one end (+z) into Lake Michigan.
// The island is turned so the lake lies to the east, with the Loop (-x) south of the
// river and River North (+x) across it.
const centre = (z: number) => 0.3 - 0.2 * Math.sin(0.3 * z)
const half = (z: number) => 0.42 + 2.4 * THREE.MathUtils.smoothstep(z, 2, 4.6)
const northBank = (z: number) => centre(z) + half(z)

const LOOP = { x: -1.6, z: -0.6 }
// Millennium Park lies at the lake end of the Loop.
const MILLENNIUM = { x: -1.8, z: 2.1 }
const L_TRACK = -2.75

/** Willis Tower: nine black tubes bundled three by three, stepping back at four heights, and two masts. */
function willisTower(site: Site, x: number, z: number) {
  const r = random(191)
  const floors = [
    [7, 9, 9],
    [12, 15, 12],
    [7, 15, 12],
  ]
  const w = 0.13
  floors.forEach((row, i) =>
    row.forEach((f, j) => house(site.b, x + (j - 1) * w, GROUND - 0.03, z + (i - 1) * w, 0, w + 0.004, w + 0.004, f, '#34383d', null, r)),
  )
  const top = GROUND - 0.03 + 15 * 0.2 + 0.06 + 0.02
  for (const dx of [-0.03, 0.03]) placer(site.b, x + dx, top, z + 0.065)(new THREE.CylinderGeometry(0.006, 0.012, 0.5, 6), '#e9e9e9', 0.25, 0)
  site.reserve(x, z, 0.3)
}

/** Marina City: two round towers of scalloped balconies on the river, parking spiralling up their bases. */
function marinaCity(site: Site, x: number, z: number) {
  for (const dz of [-0.2, 0.2]) {
    const put = placer(site.b, x, GROUND - 0.02, z + dz)
    put(new THREE.CylinderGeometry(0.1, 0.1, 1.5, 16), '#e8e4dc', 0.75, 0.2)
    for (let k = 0; k < 20; k++) {
      const balcony = new THREE.CylinderGeometry(0.15, 0.15, 0.018, 16)
      const pos = balcony.attributes.position
      for (let i = 0; i < pos.count; i++) {
        const a = Math.atan2(pos.getZ(i), pos.getX(i))
        const r = Math.hypot(pos.getX(i), pos.getZ(i))
        const scallop = r > 0.01 ? 1 - 0.1 * Math.abs(Math.sin(a * 8)) : 1
        pos.setX(i, pos.getX(i) * scallop)
        pos.setZ(i, pos.getZ(i) * scallop)
      }
      balcony.computeVertexNormals()
      put(balcony, '#f2efe9', 0.55 + k * 0.05, 0)
    }
    put(new THREE.CylinderGeometry(0.155, 0.155, 0.02, 16), '#d9d5cc', 1.52, 0)
  }
  site.reserve(x, z, 0.4)
}

/** Millennium Park with Cloud Gate, the silver bean. */
function cloudGate(site: Site) {
  const { x, z } = MILLENNIUM
  const bean = new THREE.SphereGeometry(1, 28, 16)
  bean.scale(0.2, 0.1, 0.12)
  const pos = bean.attributes.position
  // Tuck the underside up into the arch the crowds walk under.
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i)
    if (y < 0) pos.setY(i, y * 0.3 + 0.05 * Math.exp(-((pos.getX(i) / 0.08) ** 2)) * Math.exp(-((pos.getZ(i) / 0.06) ** 2)))
  }
  bean.computeVertexNormals()
  const mesh = new THREE.Mesh(bean, new THREE.MeshStandardMaterial({ color: '#dfe4e8', metalness: 0.6, roughness: 0.15 }))
  mesh.position.set(x, GROUND + 0.04, z)
  mesh.castShadow = mesh.receiveShadow = true
  site.group.add(mesh)
  site.reserve(x, z, 0.3)
}

/** A bascule bridge: a steel deck on two leaves, with a bridge house at each corner. */
function bascule(site: Site, z: number, color: string) {
  const x0 = centre(z) - half(z) - 0.25
  const x1 = northBank(z) + 0.25
  const put = placer(site.b, 0, 0, z)
  const at = (g: THREE.BufferGeometry, x: number, lz = 0) => (g.translate(x, 0, lz), g)
  put(at(new RoundedBoxGeometry(x1 - x0, 0.05, 0.24, 1, 0.01), (x0 + x1) / 2), color, GROUND + 0.02, 0.05)
  for (const s of [-1, 1]) {
    const girder = new RoundedBoxGeometry(x1 - x0 - 0.3, 0.06, 0.02, 1, 0.006)
    put(at(girder, (x0 + x1) / 2, s * 0.12), color, GROUND + 0.075, 0)
    for (const bx of [x0 + 0.08, x1 - 0.08]) {
      put(at(new RoundedBoxGeometry(0.1, 0.12, 0.08, 1, 0.01), bx, s * 0.17), '#cfc6b4', GROUND + 0.04, 0.2)
      put(at(new THREE.ConeGeometry(0.07, 0.05, 4).rotateY(Math.PI / 4), bx, s * 0.17), '#6b6f75', GROUND + 0.125, 0)
    }
  }
  site.block((bx, bz, r) => Math.abs(bz - z) < 0.24 + r && bx > x0 - 0.2 && bx < x1 + 0.2)
  traffic(site, (s) => new THREE.Vector3(x0 + (x1 - x0) * s, GROUND + 0.08, z), 0.05)
}

/** The 'L': an elevated line on steel posts, with a train running along it. */
function elevated(site: Site, x: number, z0: number, z1: number) {
  const deck = GROUND + 0.34
  const put = placer(site.b, x, 0, 0)
  const track = new RoundedBoxGeometry(0.14, 0.03, z1 - z0, 1, 0.006)
  track.translate(0, 0, (z0 + z1) / 2)
  put(track, '#5a5f66', deck, 0.05)
  for (let z = z0 + 0.1; z < z1; z += 0.35) {
    for (const s of [-1, 1]) {
      const post = new THREE.CylinderGeometry(0.008, 0.01, deck - GROUND, 5)
      post.translate(s * 0.06, 0, z)
      put(post, '#4a4f55', (deck + GROUND) / 2 - 0.01, 0)
    }
  }
  site.block((bx, bz, r) => Math.abs(bx - x) < 0.1 + r && bz > z0 - r && bz < z1 + r)
  const cars = new Batch()
  for (let k = 0; k < 3; k++) {
    cars.add(materials.clay, paint(new RoundedBoxGeometry(0.08, 0.06, 0.2, 2, 0.015), '#c9cdd2', 0), 0, 0.03, k * 0.21)
    cars.add(materials.clay, paint(new RoundedBoxGeometry(0.082, 0.015, 0.2, 1, 0.004), '#c8453a', 0), 0, 0.045, k * 0.21)
  }
  const train = cars.build()
  site.group.add(train)
  site.animate((t) => {
    const p = (t % 30) / 30
    const s = p < 0.5 ? THREE.MathUtils.smoothstep(p, 0.05, 0.45) : 1 - THREE.MathUtils.smoothstep(p, 0.55, 0.95)
    train.position.set(x, deck + 0.015, z0 + 0.05 + (z1 - z0 - 0.55) * s)
  })
}

/** Navy Pier running out into the lake, with its Ferris wheel. */
function navyPier(site: Site) {
  const z0 = 2.3
  const z1 = 4.1
  const x = northBank(z0) - 0.35
  const pier = new RoundedBoxGeometry(0.34, 0.1, z1 - z0, 1, 0.02)
  site.b.add(materials.clay, paint(pier, '#cbbfa8', 0.2, 0.1), x, WATER + 0.03, (z0 + z1) / 2)
  site.b.add(materials.clay, paint(new RoundedBoxGeometry(0.26, 0.12, 0.4, 1, 0.02), '#e6dfd0', 0.2, 0.1), x, WATER + 0.14, z1 - 0.3)
  ferrisWheel(site, x, 3.1, 0.34, 0)
}

/** St Patrick's Day: on the Saturday before it, the river is dyed green from mid-morning. */
function greenRiver(site: Site) {
  const n = 60
  const z0 = -5
  const z1 = 2.2
  const pos: number[] = []
  const index: number[] = []
  for (let i = 0; i <= n; i++) {
    const z = z0 + ((z1 - z0) * i) / n
    pos.push(centre(z) - half(z), 0, z, northBank(z), 0, z)
    if (i < n) index.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(index)
  g.computeVertexNormals()
  const dye = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: '#27b35a', roughness: 0.2, transparent: true, opacity: 0.85, side: THREE.DoubleSide }))
  dye.position.y = WATER + 0.003
  dye.visible = false
  site.group.add(dye)
  const dyed = (m: Moment) => m.month === 3 && m.weekday === 6 && m.date >= 10 && m.date <= 16 && m.hour >= 10
  site.animate((_t, _wind, m) => (dye.visible = dyed(m)))
}

export function buildChicago() {
  const loop = (x: number, z: number) => Math.exp(-((x - LOOP.x) ** 2 / 2 + (z - LOOP.z) ** 2 / 3))
  const riverNorth = (x: number, z: number) => Math.exp(-((x - 1.9) ** 2 / 1.5 + (z - 1.2) ** 2 / 1.2))
  return buildIsland({
    seed: 193,
    heading: Math.PI / 2,
    centre,
    half,
    water: '#3f7f8e',
    parks: [{ x: MILLENNIUM.x, z: MILLENNIUM.z, a: 0.6, c: 0.8, h: 0 }],
    houses: {
      count: 150,
      walls: ['#b9c4cc', '#9aa6b0', '#c9c2b5', '#a9876f', '#b8674f', '#d8d2c6', '#7f8a94'],
      roofs: ['#5a5f66'],
      pitched: 0.08,
      width: [0.26, 0.44],
      floors: (r, x, z) => 2 + Math.floor(r() * (2 + 9 * Math.max(loop(x, z), riverNorth(x, z)))),
      grid: 0,
    },
    trees: { count: 16, park: 26, greens: ['#6f9a52', '#7ea85c', '#5f8a4a'], cypress: 0 },
    landmarks(site) {
      willisTower(site, LOOP.x, LOOP.z)
      marinaCity(site, northBank(1) + 0.35, 1)
      cloudGate(site)
      bascule(site, 1.7, '#6f8a7a')
      bascule(site, -0.3, '#6f8a7a')
      bascule(site, -2.2, '#6f8a7a')
      elevated(site, L_TRACK, -3, 1.6)
      navyPier(site)
      greenRiver(site)
      boat(site, (s) => {
        const z = 1.4 - 5 * s
        return [centre(z) + 0.14, z]
      }, 48, '#2f3b4a', '#e8e4da', 0.75)
    },
  })
}
