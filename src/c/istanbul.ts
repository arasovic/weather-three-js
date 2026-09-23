import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { Batch, GROUND, cypress, house, materials, paint, random, tree } from './kit'

export const R = 6
const BASE = 0.12 // top of the soil: bottom of the land and the water
const WATER = 0.27
const TAU = Math.PI * 2

const rim = (a: number) => R * (1 + 0.025 * Math.sin(3 * a + 1) + 0.018 * Math.sin(7 * a + 2) + 0.01 * Math.sin(13 * a))

// The Bosphorus runs north to south (north is -z): centre line and half width along z.
const centre = (z: number) => -0.3 + 0.55 * Math.sin(0.42 * z + 0.3)
const half = (z: number) => 0.78 + 0.14 * Math.sin(0.8 * z + 0.5)
const bearing = (z: number) => Math.atan(0.231 * Math.cos(0.42 * z + 0.3))

// Hills, as flattened domes: Galata on the European side, Çamlıca park on the Asian side.
const hills = [
  { x: -2.4, z: -0.9, a: 1.3, c: 1.1, h: 0.26 },
  { x: 2.9, z: -1.2, a: 1.6, c: 1.6, h: 0.45 },
]

export function height(x: number, z: number) {
  let y = GROUND
  for (const m of hills) {
    const r2 = ((x - m.x) / m.a) ** 2 + ((z - m.z) / m.c) ** 2
    if (r2 < 1) y = Math.max(y, GROUND - m.h + 2 * m.h * Math.sqrt(1 - r2))
  }
  return y
}

// ---- Ground -----------------------------------------------------------------

/** Shapes live in the (x, -z) plane and are extruded upwards. */
function rimShape(scale = 1) {
  const s = new THREE.Shape()
  for (let i = 0; i < 240; i++) {
    const a = (i / 240) * TAU
    const r = rim(a) * scale
    if (i) s.lineTo(Math.cos(a) * r, -Math.sin(a) * r)
    else s.moveTo(Math.cos(a) * r, -Math.sin(a) * r)
  }
  s.closePath()
  return s
}

/** One bank of the strait: the rim arc on that side, closed along the water's edge. */
function bankShape(side: 1 | -1) {
  const pts: THREE.Vector2[] = []
  const start = side < 0 ? 0 : Math.PI // begin on the far side so the arc is contiguous
  for (let i = 0; i <= 720; i++) {
    const a = start + (i / 720) * TAU
    const r = rim(a)
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    if (side * (x - centre(z)) > half(z)) pts.push(new THREE.Vector2(x, -z))
  }
  const from = -pts[pts.length - 1].y
  const to = -pts[0].y
  for (let i = 0; i <= 80; i++) {
    const z = from + ((to - from) * i) / 80
    pts.push(new THREE.Vector2(centre(z) + side * half(z), -z))
  }
  return new THREE.Shape(pts)
}

function slab(shape: THREE.Shape, bottom: number, top: number, bevel = 0) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: top - bottom - 2 * bevel,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: -bevel,
    bevelSegments: 3,
    curveSegments: 1,
  })
  g.rotateX(-Math.PI / 2)
  g.translate(0, bottom + bevel, 0)
  return g
}

/** Colours faces by orientation: grass on top, stone quay walls on the sides. */
function grassAndStone(g: THREE.BufferGeometry) {
  const grass = new THREE.Color('#9fb574')
  const stone = new THREE.Color('#d6c6a6')
  const n = g.attributes.normal
  const col = new Float32Array(n.count * 3)
  const c = new THREE.Color()
  for (let i = 0; i < n.count; i++) {
    c.lerpColors(stone, grass, THREE.MathUtils.smoothstep(n.getY(i), 0.55, 0.8))
    c.toArray(col, i * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  return g
}

function ripples() {
  const n = 128
  const r = random(3)
  const waves = Array.from({ length: 12 }, () => [1 + Math.floor(r() * 7), Math.floor(r() * 9) - 4, r() * TAU, 0.3 + r() * 0.7])
  const h = new Float32Array(n * n)
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      for (const [kx, ky, ph, amp] of waves) h[y * n + x] += amp * Math.sin((TAU * (kx * x + ky * y)) / n + ph)
    }
  }
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = n
  const g = canvas.getContext('2d')!
  const img = g.createImageData(n, n)
  const at = (x: number, y: number) => h[((y + n) % n) * n + ((x + n) % n)]
  const v = new THREE.Vector3()
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      v.set(-(at(x + 1, y) - at(x - 1, y)) * 0.35, -(at(x, y + 1) - at(x, y - 1)) * 0.35, 1).normalize()
      const i = (y * n + x) * 4
      img.data[i] = (v.x * 0.5 + 0.5) * 255
      img.data[i + 1] = (v.y * 0.5 + 0.5) * 255
      img.data[i + 2] = (v.z * 0.5 + 0.5) * 255
      img.data[i + 3] = 255
    }
  }
  g.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(canvas)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(0.7, 0.7)
  return t
}

// ---- Landmarks --------------------------------------------------------------

type Put = (g: THREE.BufferGeometry, color: THREE.ColorRepresentation, y: number, ao?: number) => void

function placer(b: Batch, x: number, y: number, z: number, rot = 0, lx = 0, lz = 0): Put {
  return (g, color, py, ao = 0.15) => {
    g.translate(lx, 0, lz)
    paint(g, color, ao, 0.25)
    b.add(materials.landmark, g, x, y + py, z, rot)
  }
}

function galata(b: Batch, x: number, z: number) {
  const put = placer(b, x, height(x, z) - 0.12, z)
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

function mosque(b: Batch, x: number, z: number, rot: number) {
  const y = height(x, z) - 0.02
  const put = (lx: number, lz: number) => placer(b, x, y, z, rot, lx, lz)
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

function maidensTower(b: Batch, x: number, z: number) {
  const put = placer(b, x, BASE, z)
  put(new THREE.CylinderGeometry(0.22, 0.27, 0.24, 14), '#8c7d6d', 0.12, 0.3)
  put(new RoundedBoxGeometry(0.26, 0.12, 0.16, 2, 0.015), '#ece5d9', 0.3)
  put(new THREE.CylinderGeometry(0.055, 0.06, 0.34, 16), '#ece5d9', 0.41, 0.1)
  put(new THREE.ConeGeometry(0.068, 0.14, 16), '#8492a1', 0.65)
}

function bridge(b: Batch, cables: Batch, z: number) {
  const xw = centre(z) - half(z) - 0.15
  const xe = centre(z) + half(z) + 0.15
  const deck = 0.95
  const top = 1.78
  const grey = '#d5d8da'
  const put = placer(b, 0, 0, z)
  const piece = (g: THREE.BufferGeometry, px: number, py: number) => {
    g.translate(px, 0, 0)
    put(g, grey, py, 0.05)
  }
  for (const x of [xw, xe]) {
    const y0 = height(x, z) - 0.02
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
    cables.add(bridgeLights, cable, 0, 0, z)
    for (let x = xw + 0.12; x < xe - 0.06; x += 0.12) {
      const y = deck + 0.08 + (top - deck - 0.08) * ((x - mid) / (span / 2)) ** 2
      const hanger = new THREE.CylinderGeometry(0.005, 0.005, y - deck, 4)
      paint(hanger, grey, 0, 1)
      cables.add(bridgeLights, hanger, x, (y + deck) / 2, z + s * 0.1)
    }
  }
}

/** The bridge's cables carry colour-changing LEDs after dark, like the real one. */
export const bridgeLights = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, emissive: 0x000000 })

function ferry() {
  const b = new Batch()
  const put = (g: THREE.BufferGeometry, color: string, y: number) => b.add(materials.clay, paint(g, color, 0), 0, y, 0)
  put(new RoundedBoxGeometry(0.4, 0.06, 0.16, 2, 0.025), '#2c3139', 0.03)
  put(new RoundedBoxGeometry(0.38, 0.06, 0.15, 2, 0.02), '#f3f1ec', 0.08)
  put(new RoundedBoxGeometry(0.26, 0.06, 0.12, 2, 0.02), '#f3f1ec', 0.14)
  put(new THREE.CylinderGeometry(0.022, 0.025, 0.08, 10), '#f3f1ec', 0.2)
  put(new THREE.CylinderGeometry(0.023, 0.023, 0.025, 10), '#2c3139', 0.25)
  const boat = b.build()
  boat.traverse((o) => (o.castShadow = true))
  return boat
}

// ---- Island -----------------------------------------------------------------

const WALLS = ['#e8c9a0', '#d98e73', '#efe3cf', '#c9d4c5', '#e3b7a0', '#b8c7d6', '#f0dcc0']
const ROOFS = ['#b5573f', '#a44e3a', '#bd6446']
const GREENS = ['#7fa45a', '#6b9150', '#8bb262']

export function buildIstanbul() {
  const group = new THREE.Group()
  const b = new Batch()
  const cables = new Batch()
  const r = random(7)

  b.add(materials.clay, paint(slab(rimShape(1), -0.08, BASE), '#a07a58', 0.2, 0.2))
  b.add(materials.clay, paint(slab(rimShape(0.985), -0.34, -0.08), '#86705e', 0.15, 0.26))
  b.add(materials.clay, paint(slab(rimShape(0.97), -0.6, -0.34), '#76665a', 0.15, 0.26))
  for (const side of [-1, 1] as const) b.add(materials.clay, grassAndStone(slab(bankShape(side), BASE, GROUND, 0.04)))
  for (const m of hills) {
    const dome = new THREE.SphereGeometry(1, 40, 10, 0, TAU, 0, Math.PI / 2)
    dome.scale(m.a, 2 * m.h, m.c)
    b.add(materials.clay, paint(dome, '#9fb574', 0), m.x, GROUND - m.h, m.z)
  }

  const water = new THREE.MeshStandardMaterial({ color: '#3f8ea3', roughness: 0.14, normalMap: ripples() })
  water.normalScale.set(0.45, 0.45)
  const sea = new THREE.Mesh(slab(rimShape(0.985), 0.1, WATER), water)
  sea.receiveShadow = true
  group.add(sea)

  // Landmarks, and the ground they keep clear of houses.
  const galataAt = { x: -2.3, z: -0.8 }
  const mosqueAt = { x: -2.6, z: 2.3 }
  const bridgeZ = -3.4
  const ferryZ = 1.0
  galata(b, galataAt.x, galataAt.z)
  mosque(b, mosqueAt.x, mosqueAt.z, -Math.PI / 2)
  maidensTower(b, centre(3.3) + 0.3, 3.3)
  bridge(b, cables, bridgeZ)
  for (const side of [-1, 1]) {
    const pier = new RoundedBoxGeometry(0.34, 0.05, 0.14, 1, 0.01)
    b.add(materials.clay, paint(pier, '#8a6f55', 0), centre(ferryZ) + side * (half(ferryZ) - 0.1), WATER + 0.03, ferryZ)
  }

  const taken: { x: number; z: number; r: number }[] = [
    { ...galataAt, r: 0.45 },
    { x: mosqueAt.x - 0.45, z: mosqueAt.z, r: 1.25 },
    { x: centre(ferryZ) - half(ferryZ), z: ferryZ, r: 0.35 },
    { x: centre(ferryZ) + half(ferryZ), z: ferryZ, r: 0.35 },
  ]
  const park = hills[1]
  const free = (x: number, z: number, rad: number, bank: number) => {
    const a = Math.atan2(z, x)
    if (Math.hypot(x, z) > rim(a) - 0.3 - rad) return false
    if (Math.abs(x - centre(z)) - half(z) < bank + rad) return false
    if (Math.abs(z - bridgeZ) < 0.32 + rad && x > centre(bridgeZ) - half(bridgeZ) - 2.1 && x < centre(bridgeZ) + half(bridgeZ) + 2.1)
      return false
    return taken.every((t) => Math.hypot(x - t.x, z - t.z) > t.r + rad + 0.03)
  }
  const inPark = (x: number, z: number) => ((x - park.x) / park.a) ** 2 + ((z - park.z) / park.c) ** 2 < 0.8

  for (let tries = 0, count = 0; tries < 6000 && count < 120; tries++) {
    const x = (r() * 2 - 1) * R
    const z = (r() * 2 - 1) * R
    const w = 0.24 + r() * 0.22
    const d = 0.22 + r() * 0.18
    const rad = Math.max(w, d) * 0.62
    if (inPark(x, z) || !free(x, z, rad, 0.22)) continue
    taken.push({ x, z, r: rad })
    count++
    const floors = 1 + Math.floor(r() * r() * 4.5)
    const rot = bearing(z) + (r() < 0.3 ? Math.PI / 2 : 0) + (r() - 0.5) * 0.2
    const roof = r() < 0.75 ? ROOFS[Math.floor(r() * ROOFS.length)] : null
    house(b, x, height(x, z) - 0.03, z, rot, w, d, floors, WALLS[Math.floor(r() * WALLS.length)], roof, r)
  }

  // Çamlıca park fills with trees; cypresses frame the mosque; the rest fill gaps.
  for (let i = 0; i < 26; i++) {
    const a = r() * TAU
    const d = Math.sqrt(r()) * 0.85
    const x = park.x + Math.cos(a) * d * park.a
    const z = park.z + Math.sin(a) * d * park.c
    if (!free(x, z, 0.12, 0.2)) continue
    taken.push({ x, z, r: 0.12 })
    tree(b, x, height(x, z) - 0.02, z, 0.8 + r() * 0.5, GREENS[Math.floor(r() * GREENS.length)])
  }
  for (let i = 0; i < 14; i++) {
    const a = r() * TAU
    const x = mosqueAt.x - 0.45 + Math.cos(a) * 1.35
    const z = mosqueAt.z + Math.sin(a) * 1.35
    if (!free(x, z, 0.06, 0.2)) continue
    taken.push({ x, z, r: 0.06 })
    cypress(b, x, height(x, z) - 0.02, z, 0.8 + r() * 0.4)
  }
  for (let tries = 0, count = 0; tries < 3000 && count < 30; tries++) {
    const x = (r() * 2 - 1) * R
    const z = (r() * 2 - 1) * R
    if (!free(x, z, 0.1, 0.18)) continue
    taken.push({ x, z, r: 0.1 })
    count++
    if (r() < 0.35) cypress(b, x, height(x, z) - 0.02, z, 0.7 + r() * 0.4)
    else tree(b, x, height(x, z) - 0.02, z, 0.6 + r() * 0.4, GREENS[Math.floor(r() * GREENS.length)])
  }

  group.add(b.build(), cables.build())
  const boat = ferry()
  group.add(boat)

  const from = centre(ferryZ) - half(ferryZ) + 0.32
  const to = centre(ferryZ) + half(ferryZ) - 0.32
  const tilt = new THREE.Vector2()

  return {
    group,
    water,
    update(t: number, wind: THREE.Vector2) {
      // A 30-second round trip with a pause at each pier.
      const p = (t % 30) / 30
      const s = p < 0.5 ? THREE.MathUtils.smoothstep(p, 0.08, 0.42) : 1 - THREE.MathUtils.smoothstep(p, 0.58, 0.92)
      const chop = Math.min(wind.length() / 12, 1)
      boat.position.set(from + (to - from) * s, WATER - 0.01 + Math.sin(t * 2.1) * 0.006 * (1 + chop), ferryZ)
      boat.rotation.set(Math.sin(t * 1.7) * 0.03 * (0.3 + chop), p < 0.5 ? 0 : Math.PI, Math.sin(t * 1.3) * 0.02 * (0.3 + chop))
      tilt.copy(wind).multiplyScalar(0.0012 * t)
      water.normalMap!.offset.set(t * 0.004 + tilt.x, t * 0.011 - tilt.y)
      water.normalScale.setScalar(0.3 + 0.5 * chop)
    },
  }
}
