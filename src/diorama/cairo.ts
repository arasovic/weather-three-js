import * as THREE from 'three'
import { RoundedBoxGeometry } from './rounded-box'
import { Batch, GROUND, materials, paint, random, tree } from './kit'
import { BASE, TAU, WATER, blockBox, buildIsland, footing, grassAndStone, hip, lowest, placer, plantPalm, slab, stoneBridge, type Put, type Site } from './island'

// The Nile runs north through Cairo past Gezira, the island of the Cairo Tower. Downtown
// lies on the east bank with the Citadel above it on a spur of the Mokattam hills; Giza
// lies on the west bank, and beyond it the pyramids on their desert plateau. North is -z.
const centre = (z: number) => 0.3 + 0.12 * Math.sin(0.3 * z)
// The river widens round Gezira, its main channel to the east.
const half = (z: number) => 0.6 + 0.25 * THREE.MathUtils.smoothstep(z, -2.4, -1.8) * (1 - THREE.MathUtils.smoothstep(z, 0.6, 1.2))

const GEZIRA = { z: -0.6, length: 2.6, width: 0.8, shift: -0.15 }
const TOWER_Z = 0.2
const BRIDGE_Z = -2.7
const PLATEAU = { x: -3.1, z: 1.8, a: 2.4, c: 2.3, h: 0.1 }
const CITADEL = { x: 3.7, z: 1.7, a: 1.3, c: 1.5, h: 0.3 }
// Khufu, Khafre and Menkaure from north-east to south-west, square to the compass: [x, z, base, height].
const PYRAMIDS = [[-1.85, 0.3, 1.3, 0.83], [-3.3, 1.75, 1.22, 0.8], [-4.05, 3.05, 0.6, 0.38]]

const GREENS = ['#5d8a45', '#6c9650', '#4f7b3c']
const LIMESTONE = '#e6dfd2'
const LEAD = '#8f979c'
const WALLS = '#cdb48c'

/** Gezira from its north tip (u = -1) to its south tip (u = 1): the middle of the island there, and half its width. */
const geziraAt = (u: number) => {
  const z = GEZIRA.z + (u * GEZIRA.length) / 2
  return { x: centre(z) + GEZIRA.shift, z, across: (GEZIRA.width / 2) * Math.sqrt(Math.max(0, 1 - u * u)) * (1 + 0.2 * u) }
}

/** Gezira: a long garden island in the river, shady with trees, the Cairo Tower towards its south end. */
function gezira(site: Site) {
  const top = GROUND - 0.05
  // Round the shore from the north tip, down the east side and back up the west.
  const outline = Array.from({ length: 64 }, (_, i) => {
    const a = (i / 64) * TAU
    const { x, z, across } = geziraAt(-Math.cos(a))
    return new THREE.Vector2(x + across * Math.sign(Math.sin(a)), -z)
  })
  site.b.add(materials.clay, grassAndStone(slab(new THREE.Shape(outline), BASE, top, 0.02), '#93b066'))
  const tower = geziraAt((2 * (TOWER_Z - GEZIRA.z)) / GEZIRA.length)
  cairoTower(site, tower.x, top - 0.02, tower.z)
  const r = random(331)
  const planted: [number, number][] = []
  for (let i = 0; i < 80 && planted.length < 24; i++) {
    const { x, z, across } = geziraAt(-0.9 + r() * 1.8)
    const tx = x + (r() * 2 - 1) * (across - 0.13)
    if (across < 0.15 || Math.hypot(tx - tower.x, z - tower.z) < 0.3 || planted.some(([px, pz]) => Math.hypot(tx - px, z - pz) < 0.16)) continue
    planted.push([tx, z])
    tree(site.b, tx, top - 0.02, z, 0.55 + r() * 0.2, GREENS[i % 3])
  }
}

/**
 * The Cairo Tower: a concrete shaft in a lattice of crossing ribs, like the stem of a
 * lotus, opening into the flower of its viewing deck. The lattice is lit in changing
 * colours at night.
 */
function cairoTower(site: Site, x: number, y: number, z: number) {
  const put = placer(site.b, x, y, z)
  const shaft = 1.22
  const crown = 0.05 + shaft
  put(new THREE.CylinderGeometry(0.15, 0.17, 0.05, 24), '#cbbba0', 0.025, 0.3)
  put(new THREE.CylinderGeometry(0.06, 0.064, shaft, 16), '#9a7458', 0.05 + shaft / 2, 0.1)
  for (const turn of [-1, 1]) {
    for (let k = 0; k < 8; k++) {
      const pts = Array.from({ length: 41 }, (_, i) => {
        const a = (k / 8) * TAU + (turn * 7 * i) / 40
        return new THREE.Vector3(Math.cos(a) * 0.068, 0.05 + (shaft * i) / 40, Math.sin(a) * 0.068)
      })
      site.b.add(materials.leds, paint(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.007, 3), '#dcc29c', 0), x, y, z)
    }
  }
  const flower = [[0.066, 0], [0.075, 0.04], [0.1, 0.09], [0.128, 0.13]].map(([r, h]) => new THREE.Vector2(r, h))
  put(new THREE.LatheGeometry(flower, 24), '#dcc29c', crown, 0)
  put(new THREE.CylinderGeometry(0.122, 0.122, 0.07, 24), '#56636b', crown + 0.165, 0)
  put(new THREE.CylinderGeometry(0.1, 0.132, 0.035, 24), '#e3d5bf', crown + 0.2175, 0)
  put(new THREE.CylinderGeometry(0.06, 0.07, 0.06, 16), '#e3d5bf', crown + 0.265, 0)
  put(new THREE.CylinderGeometry(0.008, 0.016, 0.3, 6), '#d6d9db', crown + 0.445, 0)
}

/** The pyramids of Giza on the plateau's sand, and the Sphinx below them. */
function giza(site: Site) {
  PYRAMIDS.forEach(([x, z, w, h], i) => {
    const y = lowest(site.height, x, z, w, w) - 0.02
    const put = placer(site.b, x, y, z)
    put(hip(w, h), '#d5ad76', 0, 0.2)
    // Khafre still wears a cap of its white limestone casing.
    if (i === 1) put(hip(w * 0.24 + 0.012, h * 0.24 + 0.008), '#ece2cc', h * 0.76 - 0.004, 0)
    blockBox(site, x, z, w + 0.2, w + 0.2)
  })
  sphinx(site, -1.55, 1.3)
  site.block((x, z, r) => ((x - PLATEAU.x) / (0.9 * PLATEAU.a + r)) ** 2 + ((z - PLATEAU.z) / (0.9 * PLATEAU.c + r)) ** 2 < 1)
}

/** The Sphinx, a lion with a pharaoh's head, lying at the plateau's edge and facing the sunrise. */
function sphinx(site: Site, x: number, z: number) {
  const place = placer(site.b, x, lowest(site.height, x, z, 0.48, 0.14) - 0.01, z)
  const put: Put = (g, color, py, ao) => place(g.scale(1.4, 1.4, 1.4), color, py * 1.4, ao)
  const stone = '#c9a46e'
  put(new RoundedBoxGeometry(0.24, 0.055, 0.085, 2, 0.022), stone, 0.0275, 0.25)
  put(new RoundedBoxGeometry(0.09, 0.08, 0.08, 2, 0.02).translate(0.07, 0, 0), stone, 0.04, 0.25)
  for (const s of [-1, 1]) put(new RoundedBoxGeometry(0.1, 0.022, 0.026, 1, 0.008).translate(0.15, 0, s * 0.026), stone, 0.011, 0.2)
  put(new RoundedBoxGeometry(0.045, 0.055, 0.06, 1, 0.012).translate(0.085, 0, 0), stone, 0.105, 0)
  put(new RoundedBoxGeometry(0.03, 0.04, 0.035, 1, 0.01).translate(0.105, 0, 0), '#d2b07c', 0.1, 0)
}

/** The Citadel's walls and round towers, stepping over the hilltop in short stretches. */
function citadel(site: Site) {
  const { x, z } = CITADEL
  const corners = [[-0.75, -0.5], [0.55, -0.5], [0.55, 0.5], [-0.75, 0.5]]
  corners.forEach(([ax, az], i) => {
    const [bx, bz] = corners[(i + 1) % 4]
    const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.1)
    const len = Math.hypot(bx - ax, bz - az) / n
    const rot = Math.atan2(az - bz, bx - ax)
    for (let j = 0; j < n; j++) {
      const wx = x + ax + ((bx - ax) * (j + 0.5)) / n
      const wz = z + az + ((bz - az) * (j + 0.5)) / n
      const low = lowest(site.height, wx, wz, len, 0.05, rot) - 0.03
      const h = site.height(wx, wz) + 0.09 - low
      placer(site.b, wx, low, wz, rot)(new THREE.BoxGeometry(len + 0.004, h, 0.045), WALLS, h / 2, 0.2)
    }
    const low = lowest(site.height, x + ax, z + az, 0.1, 0.1) - 0.03
    const h = site.height(x + ax, z + az) + 0.13 - low
    placer(site.b, x + ax, low, z + az)(new THREE.CylinderGeometry(0.05, 0.055, h, 12), WALLS, h / 2, 0.2)
  })
  mosque(site, x - 0.1, z)
  blockBox(site, x - 0.1, z, 1.45, 1.15)
}

/**
 * The Muhammad Ali Mosque: an alabaster prayer hall under a cascade of lead domes, the
 * great dome on its drum, a half dome on each side and a small dome at each corner, with
 * two pencil minarets where it meets the courtyard to the west.
 */
function mosque(site: Site, x: number, z: number) {
  const place = placer(site.b, x, footing(site, x, z, 0.95, 0.56, WALLS), z)
  const put: Put = (g, color, py, ao) => place(g.scale(1.35, 1.35, 1.35), color, py * 1.35, ao)
  const hall = 0.15
  put(new RoundedBoxGeometry(0.3, 0.08, 0.32, 1, 0.01).translate(-0.17, 0, 0), LIMESTONE, 0.04, 0.2)
  put(new RoundedBoxGeometry(0.34, 0.14, 0.34, 1, 0.012).translate(hall, 0, 0), LIMESTONE, 0.07, 0.2)
  put(new THREE.CylinderGeometry(0.088, 0.092, 0.06, 24).translate(hall, 0, 0), LIMESTONE, 0.17, 0)
  put(new THREE.SphereGeometry(0.095, 24, 10, 0, TAU, 0, Math.PI / 2).translate(hall, 0, 0), LEAD, 0.2, 0)
  put(new THREE.ConeGeometry(0.008, 0.05, 6).translate(hall, 0, 0), '#c9a24a', 0.32, 0)
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2
    put(new THREE.SphereGeometry(0.075, 16, 6, 0, Math.PI, 0, Math.PI / 2).translate(0, 0, 0.07).rotateY(a).translate(hall, 0, 0), LEAD, 0.14, 0)
    const [sx, sz] = [Math.cos(a + Math.PI / 4), Math.sin(a + Math.PI / 4)].map((v) => Math.sign(v) * 0.115)
    put(new THREE.SphereGeometry(0.045, 12, 6, 0, TAU, 0, Math.PI / 2).translate(hall + sx, 0, sz), LEAD, 0.14, 0)
  }
  for (const s of [-1, 1]) {
    const at = (g: THREE.BufferGeometry) => g.translate(-0.02, 0, s * 0.17)
    put(at(new THREE.CylinderGeometry(0.014, 0.018, 0.46, 10)), LIMESTONE, 0.23, 0.1)
    for (const by of [0.3, 0.42]) put(at(new THREE.CylinderGeometry(0.026, 0.02, 0.012, 10)), LIMESTONE, by, 0)
    put(at(new THREE.ConeGeometry(0.016, 0.11, 10)), LEAD, 0.515, 0)
  }
}

/**
 * Feluccas. The Nile flows north and its wind mostly blows from the north, so boats have
 * always sailed south with the wind and drifted north with the current. While a north
 * wind blows they sail upriver under their lateen sails; when it drops or turns they
 * furl them and drift back down. They come out from under the bridge and go off the
 * island's south edge.
 */
function feluccas(site: Site) {
  const north = BRIDGE_Z + 0.35
  const south = 5.4
  const lanes = [0.5, 0.68, 0.56, 0.7, 0.52, 0.62]
  const hulls = ['#2f6f9f', '#3d8a6a', '#c8553d', '#e2d4b0', '#2f6f9f', '#c8553d']
  // The long yard slants up and aft from the tack at the bow, hung from the masthead. The
  // sail is built along it, so that squashing it towards the yard furls it.
  const tack = new THREE.Vector2(0.13, 0.05)
  const yard = new THREE.Vector2(-0.3, 0.31)
  const slant = Math.atan2(yard.y, yard.x)
  const clew = new THREE.Vector2(-0.26, 0).rotateAround(new THREE.Vector2(), -slant)
  const sail = paint(new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(), new THREE.Vector2(yard.length(), 0), clew])), '#f6f1e4', 0)
  const canvas = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide })
  const pole = paint(new THREE.CylinderGeometry(0.003, 0.004, yard.length(), 4).rotateZ(Math.PI / 2).translate(yard.length() / 2, 0, 0), '#6f5440', 0)
  const fleet = lanes.map((lane, i) => {
    const b = new Batch()
    b.add(materials.clay, paint(new RoundedBoxGeometry(0.27, 0.04, 0.08, 2, 0.02), hulls[i], 0), 0, 0.02, 0)
    b.add(materials.clay, paint(new THREE.CylinderGeometry(0.004, 0.005, 0.12, 4), '#6f5440', 0), 0.05, 0.09, 0)
    // A lantern at the stern, lit after dark.
    b.add(materials.lamps, paint(new THREE.SphereGeometry(0.011, 6, 4), '#f3ead6', 0), -0.11, 0.055, 0)
    const boat = b.build()
    boat.rotation.order = 'YXZ'
    // The rig swings about the mast to let the sail out.
    const rig = new THREE.Group()
    rig.position.x = 0.05
    const spar = new THREE.Group()
    spar.position.set(tack.x - 0.05, tack.y, 0)
    spar.rotation.z = slant
    const cloth = new THREE.Mesh(sail, canvas)
    cloth.castShadow = true
    spar.add(new THREE.Mesh(pole, materials.clay), cloth)
    rig.add(spar)
    boat.add(rig)
    site.group.add(boat)
    return { boat, rig, cloth, lane, phase: i / lanes.length }
  })
  let turn = 1 // 1 sailing south, -1 drifting north
  let travelled = 0
  let swing = 0
  let last = -Infinity
  let onScreen = 0
  site.animate((t, wind) => {
    if (t - last > 1) onScreen = 0
    const dt = Math.min(0.1, Math.max(0, t - last))
    last = t
    onScreen += dt
    // The weather is still settling while the island rises into view; after that the
    // boats come about over a few seconds when the wind changes.
    const target = wind.y > 1.5 ? 1 : -1
    turn = onScreen < 3 ? target : THREE.MathUtils.clamp(turn + Math.sign(target - turn) * dt * 0.25, -1, 1)
    travelled += ((turn > 0 ? 0.08 : 0.03) * turn * dt) / (south - north)
    const yaw = (-turn * Math.PI) / 2
    const set = Math.max(0, turn)
    // The wind across the boat towards starboard, and along it from astern. The sail goes
    // out to leeward, furthest when running before the wind.
    const across = wind.x * Math.sin(yaw) + wind.y * Math.cos(yaw)
    const along = wind.x * Math.cos(yaw) - wind.y * Math.sin(yaw)
    const out = Math.sign(across || 1) * (0.35 + 0.5 * THREE.MathUtils.clamp(along / (wind.length() + 0.1), 0, 1)) * set
    swing += (out - swing) * Math.min(1, dt * 1.5)
    const heel = THREE.MathUtils.clamp(across / 10, -1, 1) * 0.22 * set
    for (const f of fleet) {
      const u = (((travelled + f.phase) % 1) + 1) % 1
      const z = north + (south - north) * u
      f.boat.position.set(centre(z) + f.lane * half(z), WATER - 0.012 + Math.sin(t * 2 + f.phase * 9) * 0.004, z)
      f.boat.rotation.set(heel, yaw, 0)
      f.boat.scale.setScalar(Math.min(THREE.MathUtils.smoothstep(u, 0, 0.05), 1 - THREE.MathUtils.smoothstep(u, 0.95, 1)))
      f.rig.rotation.y = swing
      f.cloth.scale.y = 0.08 + 0.92 * set
    }
  })
}

export function buildCairo() {
  const byRiver = (x: number, z: number) => Math.exp(-((Math.abs(x - centre(z)) - half(z)) ** 2) / 1.5)
  return buildIsland({
    seed: 197,
    centre,
    half,
    grass: '#c4b083',
    water: '#4b8f8f',
    hills: [
      { ...PLATEAU, grass: '#e2c894' },
      { ...CITADEL, grass: '#cbb68a', rock: '#a8916f', rough: 0.25 },
    ],
    // Al-Azhar Park, below the Citadel.
    parks: [{ x: 4, z: -0.3, a: 0.55, c: 0.6, h: 0 }],
    houses: {
      count: 150,
      walls: ['#d8c3a0', '#cfae86', '#e3d6bd', '#c9a27e', '#bfa58a', '#e6dccb', '#d2b49c', '#b9785a'],
      roofs: ['#a9553c'],
      pitched: 0,
      width: [0.22, 0.38],
      floors: (r, x, z) => 1 + Math.floor(r() * (2 + 2.5 * byRiver(x, z))),
    },
    trees: { count: 30, park: 28, greens: GREENS, cypress: 0 },
    landmarks(site) {
      gezira(site)
      giza(site)
      citadel(site)
      stoneBridge(site, BRIDGE_Z)
      // Palms along the corniches.
      const r = random(337)
      for (let z = -5; z < 5.2; z += 0.4) {
        for (const s of [-1, 1]) if (r() < 0.75) plantPalm(site, centre(z) + s * (half(z) + 0.17), z, 0.75 + r() * 0.2, r() * TAU)
      }
      feluccas(site)
    },
  })
}
