import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { Batch, GROUND, cypress, house, materials, paint, random, tree } from './kit'

export const R = 6
export const BASE = 0.12 // top of the soil: bottom of the land and the water
export const WATER = 0.27
export const TAU = Math.PI * 2

const rim = (a: number) => R * (1 + 0.025 * Math.sin(3 * a + 1) + 0.018 * Math.sin(7 * a + 2) + 0.01 * Math.sin(13 * a))

export interface Ellipse {
  x: number
  z: number
  a: number
  c: number
  h: number
}

/** What a city's landmarks can use and claim while the island is built. */
export interface Site {
  b: Batch
  group: THREE.Group
  /** The river's centre line and half width along z (north is -z). */
  centre: (z: number) => number
  half: (z: number) => number
  height: (x: number, z: number) => number
  /** Keep houses and trees out of a circle, or out of wherever `test` is true. */
  reserve: (x: number, z: number, r: number) => void
  block: (test: (x: number, z: number, r: number) => boolean) => void
  animate: (fn: (t: number, wind: THREE.Vector2) => void) => void
}

export interface Spec {
  seed: number
  centre: (z: number) => number
  half: (z: number) => number
  hills?: Ellipse[]
  /** Tree-only areas; `h` is unused. */
  parks?: Ellipse[]
  grass?: string
  water?: string
  houses: {
    count: number
    walls: string[]
    roofs: string[]
    /** Share of houses with a pitched roof; the rest are flat. */
    pitched: number
    pitch?: number
    width: [number, number]
    floors: (r: () => number, x: number, z: number) => number
    /** Fixed street-grid angle; houses follow the river when unset. */
    grid?: number
  }
  trees: { count: number; park: number; greens: string[]; cypress: number }
  landmarks: (site: Site) => void
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

/** One bank of the river: the rim arc on that side, closed along the water's edge. */
function bankShape(side: 1 | -1, centre: Spec['centre'], half: Spec['half']) {
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

export function slab(shape: THREE.Shape, bottom: number, top: number, bevel = 0) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: top - bottom - 2 * bevel,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: -bevel,
    bevelSegments: 3,
    curveSegments: 12,
  })
  g.rotateX(-Math.PI / 2)
  g.translate(0, bottom + bevel, 0)
  return g
}

/** Colours faces by orientation: grass on top, stone quay walls on the sides. */
export function grassAndStone(g: THREE.BufferGeometry, grassColor = '#9fb574', stoneColor = '#d6c6a6') {
  const grass = new THREE.Color(grassColor)
  const stone = new THREE.Color(stoneColor)
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

let rippleSource: HTMLCanvasElement | undefined

/** A tileable normal map of small crossing waves. */
function ripples() {
  if (!rippleSource) {
    const n = 128
    const r = random(3)
    const waves = Array.from({ length: 12 }, () => [1 + Math.floor(r() * 7), Math.floor(r() * 9) - 4, r() * TAU, 0.3 + r() * 0.7])
    const h = new Float32Array(n * n)
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        for (const [kx, ky, ph, amp] of waves) h[y * n + x] += amp * Math.sin((TAU * (kx * x + ky * y)) / n + ph)
      }
    }
    rippleSource = document.createElement('canvas')
    rippleSource.width = rippleSource.height = n
    const g = rippleSource.getContext('2d')!
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
  }
  const t = new THREE.CanvasTexture(rippleSource)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(0.7, 0.7)
  return t
}

// ---- Shared landmark helpers --------------------------------------------------

export type Put = (g: THREE.BufferGeometry, color: THREE.ColorRepresentation, y: number, ao?: number) => void

/** Adds painted parts to the landmark batch, placed at (x, y, z) and turned by `rot`. */
export function placer(b: Batch, x: number, y: number, z: number, rot = 0, lx = 0, lz = 0): Put {
  return (g, color, py, ao = 0.15) => {
    g.translate(lx, 0, lz)
    paint(g, color, ao, 0.25)
    b.add(materials.landmark, g, x, y + py, z, rot)
  }
}

/** A gabled roof prism with its ridge along x and its base at y = 0. */
export function gable(w: number, h: number, d: number) {
  const profile = new THREE.Shape([new THREE.Vector2(-d / 2, 0), new THREE.Vector2(d / 2, 0), new THREE.Vector2(0, h)])
  const g = new THREE.ExtrudeGeometry(profile, { depth: w, bevelEnabled: false })
  g.translate(0, 0, -w / 2)
  g.rotateY(Math.PI / 2)
  return g
}

const UP = new THREE.Vector3(0, 1, 0)

/** A tapered rod from a to b, radius r0 at a and r1 at b. */
export function strut(a: THREE.Vector3, b: THREE.Vector3, r0: number, r1: number, segments = 6) {
  const d = b.clone().sub(a)
  const g = new THREE.CylinderGeometry(r1, r0, d.length(), segments)
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()))
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2)
  return g
}

/**
 * An Eiffel-style tower: four splayed legs up to a knee, then a square shaft
 * that narrows exponentially to the top. `color` paints the shaft in bands.
 */
export function latticeTower(
  put: Put,
  o: {
    foot: number
    knee: number
    kneeY: number
    top: number
    height: number
    decks: [y: number, size: number, thick: number][]
    color: (y: number) => string
    arches?: boolean
  },
) {
  const leg = o.color(0)
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const g = strut(new THREE.Vector3(sx * o.foot, 0, sz * o.foot), new THREE.Vector3(sx * o.knee, o.kneeY, sz * o.knee), o.foot * 0.2, o.knee * 0.35, 4)
    put(g, leg, 0, 0.2)
  }
  if (o.arches) {
    for (let k = 0; k < 4; k++) {
      const arch = new THREE.TorusGeometry(o.foot * 0.62, o.foot * 0.05, 6, 20, Math.PI)
      arch.translate(0, 0, (o.foot + o.knee) * 0.62)
      arch.rotateY((k * Math.PI) / 2)
      put(arch, leg, o.kneeY * 0.18, 0)
    }
  }
  const shaftHalf = (y: number) => o.knee * (o.top / o.knee) ** ((y - o.kneeY) / (o.height - o.kneeY))
  const bands = 12
  for (let i = 0; i < bands; i++) {
    const y0 = o.kneeY + ((o.height - o.kneeY) * i) / bands
    const y1 = o.kneeY + ((o.height - o.kneeY) * (i + 1)) / bands
    const points = [y0, (y0 + y1) / 2, y1].map((y) => new THREE.Vector2(shaftHalf(y) * Math.SQRT2, y - y0))
    const g = new THREE.LatheGeometry(points, 4).toNonIndexed()
    g.rotateY(Math.PI / 4)
    g.computeVertexNormals()
    put(g, o.color((y0 + y1) / 2), y0, 0)
  }
  for (const [y, size, thick] of o.decks) put(new RoundedBoxGeometry(size, thick, size, 1, 0.01), o.color(y), y, 0)
  put(new THREE.CylinderGeometry(0.008, 0.014, 0.3, 6), o.color(o.height), o.height + 0.15, 0)
}

/** A low stone bridge across the river at z. */
export function stoneBridge(site: Site, z: number, color = '#d9ccb1', width = 0.3) {
  const x0 = site.centre(z) - site.half(z) - 0.3
  const x1 = site.centre(z) + site.half(z) + 0.3
  const put = placer(site.b, (x0 + x1) / 2, GROUND, z)
  put(new RoundedBoxGeometry(x1 - x0, 0.07, width, 2, 0.02), color, 0.02, 0.05)
  const span = x1 - x0 - 0.6
  for (let i = 1; i < 4; i++) {
    const pier = new THREE.CylinderGeometry(0.06, 0.07, GROUND - BASE, 10)
    pier.scale(1, 1, width / 0.13)
    pier.translate(-span / 2 + (span * i) / 4, 0, 0)
    put(pier, color, -(GROUND - BASE) / 2 - 0.02, 0.3)
  }
  site.block((x, bz, r) => Math.abs(bz - z) < width / 2 + r + 0.05 && x > x0 - 0.3 && x < x1 + 0.3)
}

/** A small island in the river with quay walls and a grass top; returns its top height. */
export function islet(site: Site, x: number, z: number, w: number, d: number, rot = 0) {
  const top = GROUND - 0.05
  const body = new RoundedBoxGeometry(w, top - BASE, d, 3, 0.1)
  body.translate(0, (top + BASE) / 2, 0)
  site.b.add(materials.clay, grassAndStone(body.toNonIndexed()), x, 0, z, rot)
  return top
}

/**
 * A boat that shuttles along `path` (s from 0 to 1), pausing at each end.
 * The hull points along local +x.
 */
export function boat(site: Site, path: (s: number) => [number, number], period: number, hull: string, deck: string, size = 1) {
  const b = new Batch()
  const put = (g: THREE.BufferGeometry, color: string, y: number) => b.add(materials.clay, paint(g, color, 0), 0, y * size, 0)
  put(new RoundedBoxGeometry(0.4 * size, 0.06 * size, 0.16 * size, 2, 0.025 * size), hull, 0.03)
  put(new RoundedBoxGeometry(0.38 * size, 0.06 * size, 0.15 * size, 2, 0.02 * size), deck, 0.08)
  put(new RoundedBoxGeometry(0.26 * size, 0.06 * size, 0.12 * size, 2, 0.02 * size), deck, 0.14)
  const mesh = b.build()
  site.group.add(mesh)
  const a = new THREE.Vector2()
  site.animate((t, wind) => {
    const p = (t % period) / period
    const back = p >= 0.5
    const s = back ? 1 - THREE.MathUtils.smoothstep(p, 0.58, 0.92) : THREE.MathUtils.smoothstep(p, 0.08, 0.42)
    const [x, z] = path(s)
    const [x1, z1] = path(Math.min(1, s + 0.01))
    const [x0, z0] = path(Math.max(0, s - 0.01))
    a.set(x1 - x0, z1 - z0).multiplyScalar(back ? -1 : 1)
    const chop = Math.min(wind.length() / 12, 1)
    mesh.position.set(x, WATER - 0.01 + Math.sin(t * 2.1) * 0.006 * (1 + chop), z)
    mesh.rotation.set(Math.sin(t * 1.7) * 0.03 * (0.3 + chop), Math.atan2(-a.y, a.x), Math.sin(t * 1.3) * 0.02 * (0.3 + chop))
  })
  return mesh
}

// ---- Island -----------------------------------------------------------------

export interface Island {
  group: THREE.Group
  update: (t: number, wind: THREE.Vector2) => void
}

export function buildIsland(spec: Spec): Island {
  const { centre, half } = spec
  const hills = spec.hills ?? []
  const parks = spec.parks ?? []
  const grass = spec.grass ?? '#9fb574'
  const group = new THREE.Group()
  const b = new Batch()
  const r = random(spec.seed)
  const taken: { x: number; z: number; r: number }[] = []
  const blocks: ((x: number, z: number, r: number) => boolean)[] = []
  const updates: ((t: number, wind: THREE.Vector2) => void)[] = []

  const height = (x: number, z: number) => {
    let y = GROUND
    for (const m of hills) {
      const r2 = ((x - m.x) / m.a) ** 2 + ((z - m.z) / m.c) ** 2
      if (r2 < 1) y = Math.max(y, GROUND - m.h + 2 * m.h * Math.sqrt(1 - r2))
    }
    return y
  }
  const bearing = (z: number) => Math.atan((centre(z + 0.01) - centre(z - 0.01)) / 0.02)

  b.add(materials.clay, paint(slab(rimShape(1), -0.08, BASE), '#a07a58', 0.2, 0.2))
  b.add(materials.clay, paint(slab(rimShape(0.985), -0.34, -0.08), '#86705e', 0.15, 0.26))
  b.add(materials.clay, paint(slab(rimShape(0.97), -0.6, -0.34), '#76665a', 0.15, 0.26))
  for (const side of [-1, 1] as const) b.add(materials.clay, grassAndStone(slab(bankShape(side, centre, half), BASE, GROUND, 0.04), grass))
  for (const m of hills) {
    const dome = new THREE.SphereGeometry(1, 40, 10, 0, TAU, 0, Math.PI / 2)
    dome.scale(m.a, 2 * m.h, m.c)
    b.add(materials.clay, paint(dome, grass, 0), m.x, GROUND - m.h, m.z)
  }

  const water = new THREE.MeshStandardMaterial({ color: spec.water ?? '#3f8ea3', roughness: 0.14, normalMap: ripples() })
  const sea = new THREE.Mesh(slab(rimShape(0.985), 0.1, WATER), water)
  sea.receiveShadow = true
  group.add(sea)

  spec.landmarks({
    b,
    group,
    centre,
    half,
    height,
    reserve: (x, z, rad) => taken.push({ x, z, r: rad }),
    block: (test) => blocks.push(test),
    animate: (fn) => updates.push(fn),
  })

  const free = (x: number, z: number, rad: number, bank: number) => {
    if (Math.hypot(x, z) > rim(Math.atan2(z, x)) - 0.3 - rad) return false
    if (Math.abs(x - centre(z)) - half(z) < bank + rad) return false
    if (blocks.some((test) => test(x, z, rad))) return false
    return taken.every((t) => Math.hypot(x - t.x, z - t.z) > t.r + rad + 0.03)
  }
  const inPark = (x: number, z: number) => parks.some((p) => ((x - p.x) / p.a) ** 2 + ((z - p.z) / p.c) ** 2 < 1)
  const pick = <T>(list: T[]) => list[Math.floor(r() * list.length)]

  const h = spec.houses
  for (let tries = 0, count = 0; tries < 8000 && count < h.count; tries++) {
    const x = (r() * 2 - 1) * R
    const z = (r() * 2 - 1) * R
    const w = h.width[0] + r() * (h.width[1] - h.width[0])
    const d = h.width[0] + r() * (h.width[1] - h.width[0]) * 0.8
    const rad = Math.max(w, d) * 0.62
    if (inPark(x, z) || !free(x, z, rad, 0.22)) continue
    taken.push({ x, z, r: rad })
    count++
    const rot = h.grid ?? bearing(z) + (r() < 0.3 ? Math.PI / 2 : 0) + (r() - 0.5) * 0.2
    const roof = r() < h.pitched ? pick(h.roofs) : null
    house(b, x, height(x, z) - 0.03, z, rot, w, d, h.floors(r, x, z), pick(h.walls), roof, r, h.pitch)
  }

  // Parks fill with trees first; the rest fill gaps between houses.
  const t = spec.trees
  for (const p of parks) {
    for (let i = 0; i < t.park; i++) {
      const a = r() * TAU
      const d = Math.sqrt(r()) * 0.9
      const x = p.x + Math.cos(a) * d * p.a
      const z = p.z + Math.sin(a) * d * p.c
      if (!free(x, z, 0.12, 0.2)) continue
      taken.push({ x, z, r: 0.12 })
      tree(b, x, height(x, z) - 0.02, z, 0.8 + r() * 0.5, pick(t.greens))
    }
  }
  for (let tries = 0, count = 0; tries < 3000 && count < t.count; tries++) {
    const x = (r() * 2 - 1) * R
    const z = (r() * 2 - 1) * R
    if (!free(x, z, 0.1, 0.18)) continue
    taken.push({ x, z, r: 0.1 })
    count++
    if (r() < t.cypress) cypress(b, x, height(x, z) - 0.02, z, 0.7 + r() * 0.4)
    else tree(b, x, height(x, z) - 0.02, z, 0.6 + r() * 0.4, pick(t.greens))
  }

  group.add(b.build())
  const drift = new THREE.Vector2()
  return {
    group,
    update(time, wind) {
      drift.copy(wind).multiplyScalar(0.0012 * time)
      water.normalMap!.offset.set(time * 0.004 + drift.x, time * 0.011 - drift.y)
      water.normalScale.setScalar(0.3 + 0.5 * Math.min(wind.length() / 12, 1))
      for (const fn of updates) fn(time, wind)
    },
  }
}
