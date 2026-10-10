import * as THREE from 'three'
import { RoundedBoxGeometry } from './rounded-box'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { GROUND, house, materials, paint, random } from './kit'
import { WATER, blockBox, boat, buildIsland, ferrisWheel, placer, plantPalm, slab, type Moment, type Site } from './island'
import { createSprites } from './sprites'

// The Singapore River opens into Marina Bay, which narrows past the Helix Bridge and
// runs on east towards the sea. The island is turned so the water runs west to east,
// with the CBD and Marina Bay Sands to the south.
const step = THREE.MathUtils.smoothstep
const basin = (z: number) => step(z, -2.85, -2) * (1 - step(z, 0.7, 1.75))
const centre = (z: number) => 0.7 - 0.85 * basin(z) + 0.2 * step(z, 1.2, 2.2) - 0.1 * step(z, 2.8, 4.5)
const half = (z: number) => 0.3 + 1.55 * basin(z) + 0.3 * step(z, 1, 2) + 0.3 * step(z, 2.6, 3.6)

const FLOOR = 0.2
// The middle hotel tower. The towers stand in a row running north (+x here).
const MBS = { x: -1.85, z: 2.3 }
const GROVE = { x: -3.4, z: 3.45 }
const MERLION = { x: -0.3, z: -2.7 }
const FLYER = { x: 2.4, z: 3.3 }
// The Flyer turns towards the city: its wheel faces south-south-east.
const FLYER_TURN = -1.16

/**
 * One Marina Bay Sands hotel tower, `w` wide along x: a straight west leg, and an east
 * leg curving in from its foot to lean on it at level 23, above which they rise as one.
 */
function tower(w: number, h: number) {
  const join = 0.36 * h
  const leg = 0.15
  const splay = (y: number) => 0.32 * (1 - y / join) * (1 - (0.6 * y) / join)
  // Profile in (z, y): up the west face, over the roof, down the east face and the
  // outside of the curved leg, back up its inside, and down the atrium wall.
  const pts = [new THREE.Vector2(-leg, 0), new THREE.Vector2(-leg, h), new THREE.Vector2(leg, h)]
  const n = 10
  for (let i = 0; i <= n; i++) pts.push(new THREE.Vector2(leg + splay((join * (n - i)) / n), (join * (n - i)) / n))
  for (let i = 0; i <= n; i++) pts.push(new THREE.Vector2(splay((join * i) / n), (join * i) / n))
  pts.push(new THREE.Vector2(0, 0))
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: w, bevelEnabled: false })
  g.rotateY(-Math.PI / 2)
  g.translate(w / 2, 0, 0)
  // Window rows and columns as on the houses: one floor per 0.2 up, one window per 0.14 across.
  const pos = g.attributes.position
  const uv = g.attributes.uv
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + pos.getZ(i)) / 1.12, pos.getY(i) / 1.6)
  return g
}

/** The SkyPark: a hull-shaped deck across the tower tops, cantilevered out to the north. */
function skyPark(site: Site, x0: number, x1: number, y: number) {
  const w = 0.19
  const bow = 0.42
  const n = 14
  // Shapes live in the (x, -z) plane: along one edge, round the bow, back along the other.
  const pts: THREE.Vector2[] = []
  for (let i = 0; i <= n; i++) pts.push(new THREE.Vector2(x0 + ((x1 - bow - x0) * i) / n, w))
  for (let i = 1; i < 12; i++) pts.push(new THREE.Vector2(x1 - bow + bow * Math.sin((i / 12) * Math.PI), w * Math.cos((i / 12) * Math.PI)))
  for (let i = n; i >= 0; i--) pts.push(new THREE.Vector2(x0 + ((x1 - bow - x0) * i) / n, -w))
  const deck = slab(new THREE.Shape(pts), 0, 0.09)
  // Deepest in the middle, thinning towards both ends like a hull.
  const mid = (x0 + x1) / 2
  const pos = deck.attributes.position
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) > 0.045) continue
    const u = (pos.getX(i) - mid) / ((x1 - x0) / 2)
    pos.setY(i, 0.05 * u * u)
  }
  deck.computeVertexNormals()
  site.b.add(materials.landmark, paint(deck, '#d6d9da', 0.35, 0.06), 0, y, MBS.z)
  // The infinity pool along the city side, and a garden down the middle.
  site.b.add(materials.clay, paint(new RoundedBoxGeometry(1.2, 0.014, 0.07, 1, 0.005), '#58b6d4', 0), MBS.x + 0.35, y + 0.09, MBS.z - 0.13)
  for (let x = x0 + 0.2; x < x1 - 0.3; x += 0.3) {
    site.b.add(materials.landmark, paint(new THREE.SphereGeometry(0.032, 8, 6), '#5f8f47', 0.2, 0.03), x, y + 0.11, MBS.z + 0.08)
  }
}

/** Marina Bay Sands: three towers carrying the SkyPark, with the shops along their foot. */
function marinaBaySands(site: Site) {
  const h = 9 * FLOOR
  const y = GROUND - 0.03
  for (const k of [-1, 0, 1]) site.b.add(materials.walls, paint(tower(0.34, h + 0.04), '#e2e4e3', 0.3, 0.25), MBS.x + k, y, MBS.z)
  skyPark(site, MBS.x - 1.21, MBS.x + 1.75, y + h)
  house(site.b, MBS.x + 0.05, y, MBS.z - 0.52, 0, 2.3, 0.34, 1, '#dcdcd6', null, random(65))
  blockBox(site, MBS.x + 0.3, MBS.z - 0.1, 3.2, 1.3)
}

// Offsets and sizes of the Supertrees; the two at size 1 carry the Skyway between them.
const SUPERTREES: [number, number, number][] = [
  [0, 0, 1.25],
  [-0.45, 0.28, 1],
  [0.4, 0.36, 1],
  [0.05, -0.48, 0.85],
  [-0.5, -0.25, 0.8],
  [0.52, -0.22, 0.75],
  [-0.05, 0.62, 0.8],
  [-0.88, 0.02, 0.7],
  [0.86, 0.12, 0.7],
]
// Radius against height at size 1: a slim trunk flaring into a dished canopy.
const TRUNK = [[0.042, 0], [0.033, 0.05], [0.035, 0.25], [0.046, 0.4], [0.066, 0.48]]
const CANOPY = [[0.066, 0.48], [0.11, 0.54], [0.165, 0.585], [0.17, 0.6], [0.15, 0.6], [0.06, 0.58], [0, 0.575]]
const lathe = (profile: number[][], r = 1) => new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x * r, y)), 14)

/** Garden Rhapsody: for a quarter of an hour from 19:45 and from 20:45. */
const rhapsody = (m: Moment) => {
  const minutes = m.hour * 60
  return (minutes >= 1185 && minutes < 1200) || (minutes >= 1245 && minutes < 1260)
}

/** The Supertree Grove, its canopies lit at night; during Garden Rhapsody, colour ripples through it. */
function supertrees(site: Site) {
  const base = (dx: number, dz: number) => site.height(GROVE.x + dx, GROVE.z + dz) - 0.02
  for (const [dx, dz, s] of SUPERTREES) {
    const x = GROVE.x + dx
    const z = GROVE.z + dz
    site.b.add(materials.landmark, paint(lathe(TRUNK).scale(s, s, s), '#5f6b4c', 0.25, 0.2), x, base(dx, dz), z)
    site.b.add(materials.leds, paint(lathe(CANOPY).scale(s, s, s), '#6b5f58', 0, 0.01), x, base(dx, dz), z)
  }
  const [a, b] = [SUPERTREES[1], SUPERTREES[2]].map(([dx, dz]) => new THREE.Vector3(GROVE.x + dx, GROUND + 0.32, GROVE.z + dz))
  const bend = a.clone().lerp(b, 0.5).add(new THREE.Vector3(-0.2, 0, 0))
  site.b.add(materials.landmark, paint(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, bend, b), 12, 0.01, 4), '#d8d6d0', 0, 0.01))
  site.reserve(GROVE.x, GROVE.z, 1.05)

  // The trunks' lattices glow; the canopies take on the show's colours over their own lights.
  const show = new THREE.InstancedMesh(mergeGeometries([lathe(TRUNK, 1.3), lathe(CANOPY, 1.06)], true), [
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.92, depthWrite: false, side: THREE.DoubleSide, fog: false }),
  ], SUPERTREES.length)
  show.frustumCulled = false
  const m4 = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const p = new THREE.Vector3()
  const scale = new THREE.Vector3()
  const c = new THREE.Color()
  SUPERTREES.forEach(([dx, dz, s], i) => {
    show.setMatrixAt(i, m4.compose(p.set(GROVE.x + dx, base(dx, dz), GROVE.z + dz), q, scale.setScalar(s)))
    show.setColorAt(i, c)
  })
  site.group.add(show)
  site.animate((t, _wind, m) => {
    show.visible = rhapsody(m)
    if (!show.visible) return
    SUPERTREES.forEach(([dx, dz], i) => {
      const d = Math.hypot(dx, dz)
      const beat = Math.max(0, Math.sin(t * 2.4 - d * 5)) ** 2
      show.setColorAt(i, c.setHSL((t * 0.06 + d * 0.3) % 1, 1, 0.45).multiplyScalar(0.35 + 0.65 * beat))
    })
    show.instanceColor!.needsUpdate = true
  })
}

/** The Merlion: a lion's head on a fish's body, facing east across the bay and spouting into it. */
function merlion(site: Site, x: number, z: number) {
  const size = 1.3
  const place = placer(site.b, x, GROUND - 0.02, z)
  const put = (g: THREE.BufferGeometry, color: string, y: number, ao?: number) => place(g.scale(size, size, size), color, y * size, ao)
  const white = '#eeebe4'
  put(new THREE.CylinderGeometry(0.12, 0.13, 0.06, 16), '#cbc3b4', 0.03, 0.3)
  const waves = new THREE.TorusGeometry(0.075, 0.028, 6, 16)
  waves.rotateX(Math.PI / 2)
  put(waves, white, 0.08, 0.2)
  const body = new THREE.CapsuleGeometry(0.058, 0.14, 4, 12)
  body.rotateX(-0.2)
  put(body, white, 0.2, 0.15)
  // The tail curls up behind.
  const tail = new THREE.TorusGeometry(0.05, 0.017, 6, 14, Math.PI * 1.2)
  tail.rotateY(Math.PI / 2)
  tail.translate(0, 0, -0.1)
  put(tail, white, 0.16, 0)
  const mane = new THREE.SphereGeometry(0.075, 14, 10)
  mane.scale(1, 1.15, 0.75)
  put(mane, white, 0.33, 0)
  const head = new THREE.SphereGeometry(0.05, 12, 8)
  head.scale(0.9, 0.9, 1.1)
  head.translate(0, 0, 0.045)
  put(head, white, 0.33, 0)
  site.reserve(x, z, 0.2 * size)

  const n = 20
  const jet = createSprites(n, { color: '#eef6fb', soft: 0.9 })
  site.group.add(jet.points)
  const mouth = new THREE.Vector3(x, GROUND - 0.02 + 0.32 * size, z + 0.1 * size)
  const drop = mouth.y - WATER
  site.animate((t, _wind, m) => {
    jet.shade(1 - 0.4 * m.night)
    for (let i = 0; i < n; i++) {
      const s = (t * 0.9 + i / n) % 1
      jet.position[i * 3] = mouth.x
      jet.position[i * 3 + 1] = mouth.y + 0.12 * s - (0.12 + drop) * s * s
      jet.position[i * 3 + 2] = mouth.z + 0.42 * s
      jet.alpha[i] = 0.85 - 0.4 * s
      jet.size[i] = 0.035 + 0.03 * s
    }
    jet.commit()
  })
}

export function buildSingapore() {
  // Raffles Place's towers crowd the south bank by the river mouth; the rest of the city stays low.
  const cbd = (x: number, z: number) => Math.exp(-((x + 2.1) ** 2 + (z + 3.9) ** 2) / 2.2)
  return buildIsland({
    seed: 65,
    heading: Math.PI / 2,
    centre,
    half,
    grass: '#94b46c',
    water: '#3e8a8e',
    parks: [{ x: -3.6, z: 3.75, a: 1.3, c: 1.35, h: 0 }],
    houses: {
      count: 150,
      walls: ['#e8e5de', '#d3dade', '#bccad3', '#efe6d6', '#a9bccb', '#dcd4c6', '#c8d4d0', '#f0ebe1'],
      roofs: ['#b9613f'],
      pitched: 0.12,
      width: [0.22, 0.36],
      floors: (r, x, z) => 2 + Math.floor(r() * (1.6 + 6 * cbd(x, z))),
    },
    trees: { count: 60, park: 46, greens: ['#4e8a3e', '#5d9946', '#437a37'], cypress: 0 },
    landmarks(site) {
      marinaBaySands(site)
      supertrees(site)
      merlion(site, MERLION.x, MERLION.z)
      ferrisWheel(site, FLYER.x, FLYER.z, 0.62, FLYER_TURN)
      blockBox(site, FLYER.x, FLYER.z, 1.4, 0.4, FLYER_TURN)
      for (let z = -1.9; z < 0.7; z += 0.42) plantPalm(site, centre(z) - half(z) - 0.16, z, 0.9 + ((z * 7) % 1) * 0.2, z * 3)
      // A bumboat runs between the river and the bay.
      boat(site, (s) => {
        const z = -5.2 + 4.4 * s
        return [centre(z) - 0.5 * basin(z), z]
      }, 60, '#7c4a2d', '#d9b27c', 0.8)
    },
  })
}
