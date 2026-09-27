import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { Batch, GROUND, house, materials, paint, random, tree } from './kit'
import { TAU, WATER, bloomingTrees, buildIsland, flag, grassAndStone, hip, placer, type Moment, type Site } from './island'
import { createSprites } from './sprites'

// The historic centre, with Xochimilco's canal and its floating gardens along the
// east side, and Popocatépetl smoking at the edge of the valley.
const centre = (z: number) => 3.1 + 0.15 * Math.sin(0.6 * z)
const half = () => 0.32

const ZOCALO = { x0: -0.9, x1: 0.5, z0: -0.2, z1: 1.1 }
const POPO = { x: -3.2, z: 3.1 }
const TEZONTLE = '#8f4a3a'
const CANTERA = '#cdbba0'

function mexicanFlag() {
  const c = document.createElement('canvas')
  c.width = 96
  c.height = 56
  const g = c.getContext('2d')!
  for (const [i, color] of ['#006847', '#ffffff', '#ce1126'].entries()) {
    g.fillStyle = color
    g.fillRect(i * 32, 0, 32, 56)
  }
  // The eagle on its cactus, as a small brown and green emblem.
  g.fillStyle = '#7a5230'
  g.beginPath()
  g.ellipse(48, 26, 7, 8, 0, 0, TAU)
  g.fill()
  g.fillStyle = '#3f7d3a'
  g.fillRect(42, 34, 12, 4)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** The Zócalo: a vast open square with the monumental flag, raised at eight and lowered at six. */
function zocalo(site: Site) {
  const { x0, x1, z0, z1 } = ZOCALO
  site.b.add(materials.clay, paint(new RoundedBoxGeometry(x1 - x0, 0.012, z1 - z0, 1, 0.004), '#d9d0bf', 0), (x0 + x1) / 2, GROUND, (z0 + z1) / 2)
  site.block((x, z, r) => x > x0 - r && x < x1 + r && z > z0 - r && z < z1 + r)
  const x = (x0 + x1) / 2
  const z = (z0 + z1) / 2
  placer(site.b, x, GROUND - 0.02, z)(new THREE.CylinderGeometry(0.008, 0.014, 1.1, 6), '#d9d9d9', 0.55, 0)
  const cloth = flag(site, x, GROUND + 0.95, z, mexicanFlag(), 0.42, 0.25)
  site.animate((_t, _wind, m) => (cloth.visible = m.hour >= 8 && m.hour < 18))
}

/** The Metropolitan Cathedral on the north side of the square: twin bell towers and a dome. */
function cathedral(site: Site, x: number, z: number) {
  const put = placer(site.b, x, GROUND - 0.02, z)
  put(new RoundedBoxGeometry(0.5, 0.3, 0.9, 2, 0.02), CANTERA, 0.15, 0.3)
  for (const lz of [-0.36, 0.36]) {
    const tower = new RoundedBoxGeometry(0.2, 0.62, 0.18, 1, 0.012)
    tower.translate(0.12, 0, lz)
    put(tower, CANTERA, 0.31, 0.3)
    const bell = new THREE.SphereGeometry(0.075, 12, 8, 0, TAU, 0, Math.PI / 2)
    bell.scale(1, 1.4, 1)
    bell.translate(0.12, 0, lz)
    put(bell, '#9aa3a8', 0.62, 0)
  }
  const dome = new THREE.SphereGeometry(0.13, 16, 8, 0, TAU, 0, Math.PI / 2)
  dome.translate(-0.08, 0, 0)
  put(dome, '#b8a58a', 0.3, 0)
  put(new THREE.ConeGeometry(0.03, 0.12, 8).translate(-0.08, 0, 0), '#9aa3a8', 0.48, 0)
  site.reserve(x, z, 0.5)
}

/** The Palace of Fine Arts: white marble under a dome of orange and yellow tiles. */
function bellasArtes(site: Site, x: number, z: number) {
  const put = placer(site.b, x, GROUND - 0.02, z)
  put(new RoundedBoxGeometry(0.6, 0.26, 0.5, 2, 0.02), '#efe9df', 0.13, 0.3)
  put(new THREE.CylinderGeometry(0.15, 0.16, 0.08, 16), '#efe9df', 0.3, 0.1)
  const dome = new THREE.SphereGeometry(0.16, 20, 10, 0, TAU, 0, Math.PI / 2)
  dome.scale(1, 1.25, 1)
  put(dome, '#e0892e', 0.34, 0)
  put(new THREE.CylinderGeometry(0.05, 0.07, 0.06, 12), '#f2c230', 0.53, 0)
  put(new THREE.ConeGeometry(0.03, 0.08, 8), '#e9e4da', 0.6, 0)
  for (const lz of [-0.18, 0.18]) {
    const small = new THREE.SphereGeometry(0.07, 12, 6, 0, TAU, 0, Math.PI / 2)
    small.translate(0.2, 0, lz)
    put(small, '#e0892e', 0.26, 0)
  }
  site.reserve(x, z, 0.4)
}

/** The Angel of Independence: a slender column with the gilded Victory on top. */
function angel(site: Site, x: number, z: number) {
  const put = placer(site.b, x, GROUND - 0.02, z)
  put(new THREE.CylinderGeometry(0.16, 0.18, 0.06, 16), '#b9ad98', 0.03, 0.2)
  put(new RoundedBoxGeometry(0.14, 0.14, 0.14, 1, 0.01), '#d9cfbd', 0.13, 0.2)
  put(new THREE.CylinderGeometry(0.03, 0.035, 0.95, 12), '#e6dccb', 0.67, 0.1)
  put(new THREE.ConeGeometry(0.03, 0.08, 8), '#d9ad3c', 1.18, 0)
  put(new RoundedBoxGeometry(0.1, 0.012, 0.02, 1, 0.004), '#d9ad3c', 1.2, 0)
  site.reserve(x, z, 0.2)
}

/** Popocatépetl at the edge of the valley: a snow-capped cone with a plume of smoke. */
function popocatepetl(site: Site) {
  const { x, z } = POPO
  const profile = [[1.3, -0.05], [1.05, 0.3], [0.7, 0.8], [0.35, 1.25], [0.18, 1.42], [0.1, 1.38], [0, 1.3]]
  const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 40)
  const pos = g.attributes.position
  const col = new Float32Array(pos.count * 3)
  const [rock, snow, c] = [new THREE.Color('#7d7268'), new THREE.Color('#eef2f4'), new THREE.Color()]
  for (let i = 0; i < pos.count; i++) c.lerpColors(rock, snow, THREE.MathUtils.smoothstep(pos.getY(i), 1.0, 1.15)).toArray(col, i * 3)
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  site.b.add(materials.clay, g, x, GROUND - 0.02, z)
  site.block((bx, bz, r) => Math.hypot(bx - x, bz - z) < 1.35 + r)
  const n = 40
  const s = createSprites(n, { color: '#e3e0da', soft: 1 })
  site.group.add(s.points)
  const top = new THREE.Vector3(x, GROUND + 1.42, z)
  site.animate((t, wind, m) => {
    s.shade(1 - 0.65 * m.night)
    for (let i = 0; i < n; i++) {
      const age = (t * 0.05 + i / n) % 1
      s.position[i * 3] = top.x + wind.x * 0.12 * age + 0.1 * Math.sin(i * 1.7) * age
      s.position[i * 3 + 1] = top.y + 1.1 * age
      s.position[i * 3 + 2] = top.z + wind.y * 0.12 * age + 0.1 * Math.cos(i * 2.3) * age
      s.alpha[i] = 0.55 * Math.sin(Math.PI * Math.min(1, age * 1.3)) * (1 - age)
      s.size[i] = 0.25 + 0.9 * age
    }
    s.commit()
  })
}

/** Xochimilco: chinampa gardens on the far bank, and painted trajineras punted along the canal. */
function xochimilco(site: Site) {
  const r = random(233)
  for (let z = -3.4; z < 3.4; z += 0.45) {
    const x = centre(z) + half() + 0.35
    if (Math.hypot(x, z) > 5.3) continue
    const bed = new RoundedBoxGeometry(0.5, 0.03, 0.3, 1, 0.01)
    site.b.add(materials.clay, grassAndStone(bed, r() < 0.5 ? '#7fa35a' : '#9bb86a', '#8a6f55'), x, GROUND + 0.005, z)
    for (let k = 0; k < 3; k++) tree(site.b, x - 0.18 + k * 0.18, GROUND, z + 0.13, 0.35 + r() * 0.1, '#4f7f3f')
    site.reserve(x, z, 0.22)
  }
  const colors = ['#e94f37', '#f6c85f', '#3f88c5', '#6fb07f', '#e27fa0']
  const boats = colors.map((color, i) => {
    const b = new Batch()
    b.add(materials.clay, paint(new RoundedBoxGeometry(0.28, 0.04, 0.09, 1, 0.012), '#3f7d4f', 0), 0, 0.02, 0)
    b.add(materials.clay, paint(new RoundedBoxGeometry(0.24, 0.015, 0.1, 1, 0.004), color, 0), 0, 0.11, 0)
    for (const lx of [-0.1, 0.1]) {
      for (const lz of [-0.04, 0.04]) b.add(materials.clay, paint(new THREE.CylinderGeometry(0.003, 0.003, 0.07, 4), '#f2efe9', 0), lx, 0.075, lz)
    }
    b.add(materials.clay, paint(new RoundedBoxGeometry(0.02, 0.05, 0.1, 1, 0.004), color, 0), 0.13, 0.08, 0)
    const mesh = b.build(false)
    site.group.add(mesh)
    return { mesh, phase: i / colors.length }
  })
  site.animate((t) => {
    for (const { mesh, phase } of boats) {
      const p = (t / 80 + phase) % 1
      const s = p < 0.5 ? p * 2 : 2 - p * 2
      const z = -3.2 + 6.4 * s
      mesh.position.set(centre(z) + (p < 0.5 ? -0.1 : 0.1), WATER - 0.01, z)
      mesh.rotation.y = p < 0.5 ? -Math.PI / 2 : Math.PI / 2
    }
  })
}

/**
 * The Day of the Dead: from the 31st of October to the 2nd of November, marigold
 * petals line the square and candles glow around it after dark.
 */
function diaDeMuertos(site: Site) {
  const { x0, x1, z0, z1 } = ZOCALO
  const edge: THREE.Vector3[] = []
  for (let t = 0; t < 1; t += 0.02) {
    edge.push(new THREE.Vector3(x0 + (x1 - x0) * t, GROUND + 0.02, z0), new THREE.Vector3(x0 + (x1 - x0) * t, GROUND + 0.02, z1))
    edge.push(new THREE.Vector3(x0, GROUND + 0.02, z0 + (z1 - z0) * t), new THREE.Vector3(x1, GROUND + 0.02, z0 + (z1 - z0) * t))
  }
  const petals = createSprites(edge.length, { color: '#f28c1a', soft: 0.5 })
  const candles = createSprites(edge.length / 2, { color: '#ffd27a', additive: true, soft: 0.8 })
  edge.forEach((p, i) => {
    p.toArray(petals.position, i * 3)
    petals.alpha[i] = 1
    petals.size[i] = 0.07
  })
  for (let i = 0; i < edge.length / 2; i++) edge[i * 2].toArray(candles.position, i * 3)
  petals.commit()
  site.group.add(petals.points, candles.points)
  const season = (m: Moment) => (m.month === 10 && m.date === 31) || (m.month === 11 && m.date <= 2)
  site.animate((t, _wind, m) => {
    petals.points.visible = season(m)
    candles.points.visible = petals.points.visible && m.night > 0.4
    petals.shade(1 - 0.65 * m.night)
    if (!candles.points.visible) return
    for (let i = 0; i < edge.length / 2; i++) {
      candles.alpha[i] = 0.7 + 0.3 * Math.sin(t * 9 + i * 1.3)
      candles.size[i] = 0.05
    }
    candles.commit()
  })
}

export function buildMexicoCity() {
  const reforma = (x: number, z: number) => Math.exp(-((x + 2.2) ** 2 / 1.2 + (z + 1.6) ** 2 / 1.5))
  const r = random(239)
  const jacarandas: [number, number, number][] = []
  for (let i = 0; i < 24; i++) {
    const x = -4 + r() * 6
    const z = -4.4 + r() * 6
    if (Math.hypot(x, z) < 4.9) jacarandas.push([x, z, 0.8 + r() * 0.3])
  }
  return buildIsland({
    seed: 241,
    centre,
    half,
    grass: '#a8b878',
    water: '#5f8f6a',
    // The Alameda beside Bellas Artes, and Chapultepec.
    parks: [
      { x: -1.6, z: -0.3, a: 0.45, c: 0.35, h: 0 },
      { x: -3.4, z: -1.2, a: 0.7, c: 0.9, h: 0 },
    ],
    houses: {
      count: 160,
      walls: ['#e8b48a', '#f2d7b6', '#c96a4f', '#f3e7c4', '#dfe9ea', '#e27f7a', '#7fb3a8', '#f0c9b0', TEZONTLE],
      roofs: ['#b8603f'],
      pitched: 0.1,
      width: [0.22, 0.4],
      floors: (rr, x, z) => 1 + Math.floor(rr() * (2 + 7 * reforma(x, z))),
    },
    trees: { count: 20, park: 26, greens: ['#5f8a4a', '#6f9a52', '#7ea85c'], cypress: 0.1 },
    landmarks(site) {
      zocalo(site)
      cathedral(site, (ZOCALO.x0 + ZOCALO.x1) / 2, ZOCALO.z0 - 0.5)
      bellasArtes(site, -1.6, 0.35)
      angel(site, -2.3, -1.9)
      // The Torre Latinoamericana, the old tallest tower, near Bellas Artes.
      house(site.b, -1, GROUND - 0.03, -0.9, 0, 0.26, 0.26, 9, '#9aa6b0', null, r)
      placer(site.b, -1, GROUND - 0.03 + 9 * 0.2 + 0.06, -0.9)(hip(0.12, 0.3), '#c9cdd2', 0.02, 0)
      site.reserve(-1, -0.9, 0.2)
      popocatepetl(site)
      xochimilco(site)
      diaDeMuertos(site)
      // Jacarandas flower purple across the city in March.
      bloomingTrees(site, jacarandas, '#5f8a4a', '#9b7ad6', (m) => m.month === 3)
    },
  })
}
