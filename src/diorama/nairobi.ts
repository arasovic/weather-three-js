import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { GROUND, house, materials, paint, random } from './kit'
import { BASE, TAU, blockBox, buildIsland, placer, ridge, strut, traffic, type Site } from './island'

// Nairobi seen from the south, as from its national park: giraffes among the acacias
// on the plains, the city's towers behind them and the Nairobi River beyond. The
// Ngong Hills close the view to the south-west, with the wind farm along their crest.
// The island is turned a quarter so the river, laid out along z, runs west to east:
// its north is +x and its east +z.
const HEADING = Math.PI / 2
const centre = (z: number) => 3.4 + 0.15 * Math.sin(0.8 * z + 0.5)
const half = () => 0.17

const KICC = { x: -0.1, z: 0.6 }
const UHURU = { x: 0.35, z: -0.95 }
const BRITAM = { x: -0.75, z: -0.95 }
const PARK = { x: -3, z: 0.1, a: 1.35, c: 1.75 }

const TERRACOTTA = '#d2a77c'
const GREENS = ['#5b8a45', '#6a9550', '#4f7c3d']

/** The Ngong Hills along the south-west edge: a grassy ridge of four knuckles, wooded lower down. */
function ngongHills(site: Site) {
  const knuckle = (u: number, at: number) => 0.24 * Math.exp(-(((u - at) / 0.07) ** 2))
  const hills = ridge({
    from: -2.95,
    to: -1.75,
    depth: 1.3,
    face: [0.08, 0.5],
    height: (u) =>
      (0.5 + knuckle(u, 0.16) + knuckle(u, 0.32) + knuckle(u, 0.48) + knuckle(u, 0.64)) *
      THREE.MathUtils.smoothstep(u, 0, 0.1) *
      (1 - THREE.MathUtils.smoothstep(u, 0.9, 1)),
  })
  const g = hills.geometry
  const pos = g.attributes.position
  const color = new Float32Array(pos.count * 3)
  const forest = new THREE.Color('#5d7d45')
  const grass = new THREE.Color('#a3ad66')
  const c = new THREE.Color()
  for (let i = 0; i < pos.count; i++) c.lerpColors(forest, grass, THREE.MathUtils.smoothstep(pos.getY(i), BASE + 0.3, BASE + 0.6)).toArray(color, i * 3)
  g.setAttribute('color', new THREE.BufferAttribute(color, 3))
  const mesh = new THREE.Mesh(g, materials.clay)
  mesh.castShadow = mesh.receiveShadow = true
  site.group.add(mesh)
  site.block((x, z, r) => hills.covers(x, z, r + 0.1))
  // The crest runs along v = 0.68, from u = 0 in the south to u = 1 in the west.
  return (u: number) => hills.surface(u, 0.68)
}

// The wind farm's 850 kW turbines start turning at 4 m/s, run at about 14 to 31 rpm
// and stop above 25 m/s (Vestas V52 and Gamesa G52 figures).
const CUT_IN = 4
const RATED = 15
const CUT_OUT = 25
// ponytail: the forecast wind is at 10 m in the city, but the hubs stand high on a windy
// ridge; one rough factor stands in for both. Tune it if the turbines idle too often.
const RIDGE_WIND = 1.5

/** The wind farm along the crest: white turbines that turn into the wind and spin with it. */
function windFarm(site: Site, crest: (u: number) => THREE.Vector3) {
  const spots = [0.24, 0.36, 0.48, 0.6, 0.72, 0.84].map(crest)
  const hub = 0.42
  for (const p of spots) site.b.add(materials.clay, paint(new THREE.CylinderGeometry(0.008, 0.014, hub, 8), '#efefeb', 0.1, 0.05), p.x, p.y - 0.01 + hub / 2, p.z)

  // Three blades turning about +x, the way the nacelle points, in front of a spinner.
  const blade = (k: number) => new THREE.CylinderGeometry(0.004, 0.012, 0.2, 4).scale(0.45, 1, 1).translate(0, 0.11, 0).rotateX((k * TAU) / 3)
  const rotor = mergeGeometries([blade(0), blade(1), blade(2), new THREE.ConeGeometry(0.016, 0.04, 8).rotateZ(-Math.PI / 2)])
  const white = new THREE.MeshStandardMaterial({ color: '#f1f1ee', roughness: 0.5 })
  const nacelles = new THREE.InstancedMesh(new RoundedBoxGeometry(0.08, 0.032, 0.032, 1, 0.01), white, spots.length)
  const rotors = new THREE.InstancedMesh(rotor, white, spots.length)
  for (const mesh of [nacelles, rotors]) {
    mesh.castShadow = true
    // They turn, so their bounds are never computed for culling.
    mesh.frustumCulled = false
    site.group.add(mesh)
  }

  const m = new THREE.Matrix4()
  const step = new THREE.Matrix4()
  let last = -Infinity
  let onScreen = 0
  let yaw = 0
  let speed = 0
  let turn = 0
  site.animate((t, wind) => {
    if (t - last > 1) onScreen = 0
    const dt = Math.min(0.1, Math.max(0, t - last))
    last = t
    onScreen += dt
    const v = wind.length() * RIDGE_WIND
    const rpm = v < CUT_IN || v > CUT_OUT ? 0 : THREE.MathUtils.mapLinear(Math.min(v, RATED), CUT_IN, RATED, 14, 31)
    // The nacelle's +x, and so the rotor, points to where the wind comes from.
    const into = v > 0.5 ? Math.atan2(wind.y, -wind.x) : yaw
    // Settled at once while the island rises into view; after that they spin up and yaw slowly.
    const settled = onScreen < 3
    const target = (rpm * TAU) / 60
    speed = settled ? target : speed + THREE.MathUtils.clamp(target - speed, -0.4 * dt, 0.4 * dt)
    const off = THREE.MathUtils.euclideanModulo(into - yaw + Math.PI, TAU) - Math.PI
    yaw = settled ? into : yaw + THREE.MathUtils.clamp(off, -0.15 * dt, 0.15 * dt)
    turn += speed * dt
    spots.forEach((p, i) => {
      m.makeTranslation(p.x, p.y + hub, p.z).multiply(step.makeRotationY(yaw))
      nacelles.setMatrixAt(i, m)
      m.multiply(step.makeTranslation(0.056, 0, 0)).multiply(step.makeRotationX(turn + i * 2.1))
      rotors.setMatrixAt(i, m)
    })
    nacelles.instanceMatrix.needsUpdate = rotors.instanceMatrix.needsUpdate = true
  })
}

/** A coat pattern drawn once on a small canvas, for the animals. */
function coat(draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  draw(c.getContext('2d')!)
  const map = new THREE.CanvasTexture(c)
  map.colorSpace = THREE.SRGBColorSpace
  map.wrapS = map.wrapT = THREE.RepeatWrapping
  return new THREE.MeshStandardMaterial({ map, roughness: 0.85 })
}

/** Merges parts that mix indexed and non-indexed geometries. */
const merge = (parts: THREE.BufferGeometry[]) => mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)))

/** A giraffe facing +x, standing on y = 0. */
function giraffe() {
  const legs = [
    [0.038, 0.017],
    [0.038, -0.017],
    [-0.036, 0.017],
    [-0.036, -0.017],
  ].map(([x, z]) => new THREE.CylinderGeometry(0.0045, 0.0055, 0.17, 5).translate(x, 0.085, z))
  return merge([
    ...legs,
    new RoundedBoxGeometry(0.12, 0.068, 0.05, 2, 0.022).rotateZ(0.14).translate(0, 0.19, 0),
    strut(new THREE.Vector3(0.045, 0.2, 0), new THREE.Vector3(0.095, 0.36, 0), 0.016, 0.009),
    new RoundedBoxGeometry(0.05, 0.022, 0.02, 1, 0.008).rotateZ(-0.35).translate(0.112, 0.36, 0),
  ])
}

/** A zebra facing +x, standing on y = 0, with its head up or down to the grass. */
function zebra(grazing: boolean) {
  const legs = [
    [0.033, 0.013],
    [0.033, -0.013],
    [-0.033, 0.013],
    [-0.033, -0.013],
  ].map(([x, z]) => new THREE.CylinderGeometry(0.004, 0.0048, 0.065, 5).translate(x, 0.0325, z))
  const nose = grazing ? new THREE.Vector3(0.07, 0.035, 0) : new THREE.Vector3(0.062, 0.13, 0)
  return merge([
    ...legs,
    new RoundedBoxGeometry(0.1, 0.046, 0.04, 2, 0.016).translate(0, 0.082, 0),
    strut(new THREE.Vector3(0.04, 0.088, 0), nose, 0.012, 0.009),
    new RoundedBoxGeometry(0.038, 0.017, 0.016, 1, 0.006).rotateZ(grazing ? -1.1 : -0.5).translate(nose.x + 0.012, nose.y - 0.008, 0),
  ])
}

/** An umbrella thorn: a forked trunk under a wide, flat crown. */
function acacia(site: Site, x: number, z: number, s: number) {
  const bark = '#5a4632'
  const fork = new THREE.Vector3(0.02 * s, 0.13 * s, 0)
  site.b.add(materials.trees, paint(strut(new THREE.Vector3(), fork, 0.012 * s, 0.008 * s, 5), bark, 0.2, 0.1), x, GROUND, z)
  for (const side of [-1, 1]) {
    const tip = new THREE.Vector3((0.02 + side * 0.07) * s, 0.21 * s, side * 0.02 * s)
    site.b.add(materials.trees, paint(strut(fork, tip, 0.007 * s, 0.005 * s, 4), bark, 0, 0.1), x, GROUND, z)
  }
  const crown = new THREE.SphereGeometry(0.17 * s, 12, 6).scale(1, 0.24, 0.85)
  site.b.add(materials.trees, paint(crown, '#62803f', 0.3, 0.05), x + 0.02 * s, GROUND + 0.22 * s, z)
}

/** Nairobi National Park: dry grass plains with acacias, giraffes and a herd of zebras. */
function nationalPark(site: Site) {
  const { x, z, a, c } = PARK
  site.block((bx, bz, r) => ((bx - x) / (a + r)) ** 2 + ((bz - z) / (c + r)) ** 2 < 1)
  site.b.add(materials.clay, paint(new THREE.CylinderGeometry(1, 1, 0.012, 64).scale(a, 1, c), '#cbb872', 0), x, GROUND + 0.004, z)

  const r = random(353)
  const taken: [number, number, number][] = []
  /** A free spot on the plains, `room` clear of everything placed so far. */
  const spot = (room: number) => {
    for (let k = 0; k < 40; k++) {
      const t = r() * TAU
      const d = Math.sqrt(r()) * 0.85
      const px = x + Math.cos(t) * d * a
      const pz = z + Math.sin(t) * d * c
      if (taken.every(([qx, qz, qr]) => Math.hypot(px - qx, pz - qz) > qr + room)) {
        taken.push([px, pz, room])
        return [px, pz] as const
      }
    }
  }
  for (let i = 0; i < 14; i++) {
    const p = spot(0.18)
    if (p) acacia(site, p[0], p[1], 0.85 + r() * 0.4)
  }

  const giraffes = coat((g) => {
    g.fillStyle = '#e9c88f'
    g.fillRect(0, 0, 64, 64)
    g.fillStyle = '#8a4520'
    for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) g.fillRect(col * 16 + 2 + (row % 2) * 4, row * 16 + 2, 11, 12)
  })
  const tall = giraffe().scale(1.45, 1.45, 1.45)
  for (let i = 0; i < 4; i++) {
    const p = spot(0.12)
    if (p) site.b.add(giraffes, tall.clone(), p[0], GROUND, p[1], r() * TAU)
  }

  const zebras = coat((g) => {
    g.fillStyle = '#f4f2ec'
    g.fillRect(0, 0, 64, 64)
    g.fillStyle = '#26262a'
    for (let s = 0; s < 64; s += 8) g.fillRect(s, 0, 4, 64)
  })
  const herd = spot(0.35)
  if (herd) {
    const heading = r() * TAU
    for (let i = 0; i < 6; i++) {
      const t = r() * TAU
      const d = 0.06 + r() * 0.2
      const body = zebra(r() < 0.5).scale(1.9, 1.9, 1.9)
      site.b.add(zebras, body, herd[0] + Math.cos(t) * d, GROUND, herd[1] + Math.sin(t) * d, heading + (r() - 0.5) * 1.2)
    }
  }
}

/**
 * The Kenyatta International Convention Centre: a ribbed terracotta tower crowned by
 * its helipad, the amphitheatre under a cone roof like a hut's at its foot, and the
 * plenary hall beside it.
 */
function kicc(site: Site) {
  const { x, z } = KICC
  const height = 1.4
  const shaft = new THREE.CylinderGeometry(0.1, 0.1, height, 24, 1, true)
  // Narrow windows between the ribs, one row for each storey of the island's houses.
  const uv = shaft.attributes.uv
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 3, uv.getY(i) * (height / 0.2 / 8))
  site.b.add(materials.walls, paint(shaft, TERRACOTTA, 0.3, 0.3), x, GROUND - 0.02 + height / 2, z)
  const put = placer(site.b, x, GROUND - 0.02, z)
  put(new THREE.CylinderGeometry(0.2, 0.1, 0.12, 24), '#c4966a', height + 0.06, 0)
  put(new THREE.CylinderGeometry(0.21, 0.21, 0.03, 24), '#e6dccd', height + 0.135, 0)
  put(new RoundedBoxGeometry(0.9, 0.02, 0.9, 1, 0.008).translate(-0.12, 0, -0.05), '#d8d0c0', 0.01, 0)

  const amphitheatre = placer(site.b, x - 0.36, GROUND - 0.02, z + 0.05)
  amphitheatre(new THREE.CylinderGeometry(0.2, 0.21, 0.12, 24), TERRACOTTA, 0.06, 0.25)
  amphitheatre(new THREE.ConeGeometry(0.25, 0.22, 24), '#9b5a3c', 0.23, 0)
  const plenary = placer(site.b, x + 0.05, GROUND - 0.02, z - 0.36)
  plenary(new RoundedBoxGeometry(0.3, 0.16, 0.22, 2, 0.012), TERRACOTTA, 0.08, 0.25)
  plenary(new RoundedBoxGeometry(0.32, 0.02, 0.24, 1, 0.006), '#e6dccd', 0.165, 0)
  blockBox(site, x - 0.12, z - 0.05, 0.95, 0.95)
}

/** Britam Tower on Upper Hill: glass sloping up to a mast at the top. */
function britam(site: Site) {
  const { x, z } = BRITAM
  const floors = 7
  house(site.b, x, GROUND - 0.03, z, 0, 0.22, 0.22, floors, '#9fb4c4', null, random(359))
  const top = GROUND - 0.03 + floors * 0.2 + 0.06
  const wedge = new THREE.Shape([new THREE.Vector2(-0.11, 0), new THREE.Vector2(0.11, 0), new THREE.Vector2(-0.11, 0.3)])
  const put = placer(site.b, x, top, z)
  put(new THREE.ExtrudeGeometry(wedge, { depth: 0.22, bevelEnabled: false }).translate(0, 0, -0.11), '#a9bccb', 0, 0)
  put(strut(new THREE.Vector3(-0.1, 0.28, 0), new THREE.Vector3(-0.1, 0.56, 0), 0.008, 0.003), '#d8dde0', 0, 0)
  site.reserve(x, z, 0.2)
}

/** The boating lake in Uhuru Park. */
function uhuruLake(site: Site) {
  const { x, z } = UHURU
  const water = new THREE.MeshStandardMaterial({ color: '#5f8c8a', roughness: 0.15 })
  site.b.add(materials.clay, paint(new THREE.CylinderGeometry(1, 1, 0.016, 40).scale(0.33, 1, 0.2), '#c9bfa8', 0), x, GROUND + 0.002, z)
  site.b.add(water, new THREE.CylinderGeometry(1, 1, 0.02, 40).scale(0.3, 1, 0.17), x, GROUND + 0.005, z)
  site.reserve(x, z, 0.34)
}

/**
 * The Nairobi Expressway on its pillars: in from the airport road in the south-east,
 * up the city's west side past Uhuru Park, and over the river to Westlands.
 */
function expressway(site: Site) {
  const route = new THREE.CatmullRomCurve3(
    [
      [-3.75, 3.65],
      [-2.3, 2.1],
      [-1.15, 0.8],
      [-0.5, -0.35],
      [0.85, -0.5],
      [2.1, -1.25],
      [3.1, -2.15],
      [4.1, -2.9],
    ].map(([x, z]) => new THREE.Vector3(x, 0, z)),
  )
  // It rises from the ground at both ends.
  const lift = (s: number) => GROUND + 0.36 * THREE.MathUtils.smoothstep(s, 0, 0.07) * (1 - THREE.MathUtils.smoothstep(s, 0.93, 1))
  const at = (s: number) => route.getPointAt(s).setY(lift(s))
  const n = 90
  const pts = Array.from({ length: n + 1 }, (_, i) => at(i / n))
  for (let i = 0; i < n; i++) {
    const p = pts[i]
    const q = pts[i + 1]
    const len = Math.hypot(q.x - p.x, q.z - p.z)
    const deck = new RoundedBoxGeometry(len + 0.012, 0.03, 0.12, 1, 0.008).rotateZ(Math.atan2(q.y - p.y, len))
    site.b.add(materials.clay, paint(deck, '#bdb9b0', 0.1, 0.02), (p.x + q.x) / 2, (p.y + q.y) / 2 - 0.015, (p.z + q.z) / 2, Math.atan2(p.z - q.z, q.x - p.x))
    if (i % 5 === 2 && p.y > GROUND + 0.12) {
      const pillar = strut(new THREE.Vector3(0, GROUND - 0.02, 0), new THREE.Vector3(0, p.y - 0.03, 0), 0.022, 0.02)
      site.b.add(materials.clay, paint(pillar, '#bdb8ae', 0.2, 0.1), p.x, 0, p.z)
    }
  }
  site.block((x, z, r) => pts.some((p) => Math.hypot(x - p.x, z - p.z) < 0.1 + r))
  traffic(site, (s) => at(s).setY(lift(s) + 0.012), 0.035, 6)
}

export function buildNairobi() {
  // The city centre and the towers of Upper Hill rise highest.
  const busy = (x: number, z: number) =>
    Math.min(1, Math.exp(-((x - 0.45) ** 2 + (z - 0.45) ** 2) / 0.5) + 0.8 * Math.exp(-((x + 0.75) ** 2 + (z + 0.85) ** 2) / 0.3))
  return buildIsland({
    seed: 367,
    heading: HEADING,
    centre,
    half,
    grass: '#9fb06a',
    water: '#6b8a7a',
    // Uhuru Park beside the centre, and Karura Forest north of the river.
    parks: [
      { x: UHURU.x, z: UHURU.z, a: 0.6, c: 0.42, h: 0 },
      { x: 4.6, z: 1.3, a: 0.75, c: 1.2, h: 0 },
    ],
    houses: {
      count: 150,
      walls: ['#e9e4d8', '#ddd3c0', '#cfc7b8', '#f1ece2', '#c8b79e', '#b8c2c8', '#d9c9a8', '#a9b5bd'],
      roofs: ['#a4553f', '#8e4a38', '#6d6a66'],
      pitched: 0.35,
      pitch: 0.8,
      width: [0.2, 0.34],
      floors: (r, x, z) => 1 + Math.floor(r() * (1.5 + 8 * busy(x, z))),
    },
    trees: { count: 45, park: 34, greens: GREENS, cypress: 0 },
    landmarks(site) {
      windFarm(site, ngongHills(site))
      nationalPark(site)
      kicc(site)
      britam(site)
      uhuruLake(site)
      expressway(site)
    },
  })
}
