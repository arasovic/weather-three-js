import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { GROUND, cypress, extend, materials, paint, tree } from './kit'
import { blockBox, boat, buildIsland, grassAndStone, placer, slab, type Put, type Site } from './island'

// The Yamuna comes down from the north-west past Agra Fort, then bends east behind the
// Taj Mahal, with Mehtab Bagh on the far bank. The island is turned so the river runs
// its true way: +x here is north and +z east.
const softplus = (u: number) => Math.log1p(Math.exp(1.6 * u)) / 1.6
const centre = (z: number) => 2.48 + 0.78 * softplus(-1.6 - z) + 0.5 * THREE.MathUtils.smoothstep(z, 2.5, 6)
const half = () => 0.62

const MARBLE = '#f3efe7'
const RECESS = '#bdb5a5' // marble in the shade of an arch
const SANDSTONE = '#a65a40'
const DOORWAY = '#6b4433' // sandstone in the shade of an arch
const GOLD = '#c9a24a'

// The mausoleum's centre. The garden runs south from the riverside terrace to the great gate.
const TAJ = { x: 0.7, z: 0.5 }
const RIVERSIDE = 1.66 // the terrace's north edge, over the river
const TERRACE = -0.27 // the terrace's south edge, where the garden ends
const GATE = -2.9
const TANK = (GATE + TERRACE) / 2
const WIDE = 1.85 // half the width of the garden and the terrace

/**
 * The Taj's white marble. It is never floodlit, so unlike other landmarks it stays dark
 * after sunset; on the nights around the full moon it shines in the moonlight.
 */
const marble = extend(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, emissive: '#c4d0ec', emissiveIntensity: 0 }))

/** Like `placer`, for parts in another material, scaled by `s` about (x, y, z). */
const parts = (site: Site, material: THREE.Material, x: number, y: number, z: number, s = 1): Put => (g, color, py, ao = 0.15) =>
  site.b.add(material, paint(g.scale(s, s, s), color, ao, 0.25), x, y + py * s, z)

/** Turns a part built facing +z to face `a` radians from +z towards +x, `d` out from the centre and `u` along the face. */
const onFace = (g: THREE.BufferGeometry, a: number, d: number, u = 0) => g.translate(u, 0, d).rotateY(a)

/** A pointed arch `w` wide and `h` tall, standing on y = 0 and facing +z: the shade inside an arched recess. */
function arch(w: number, h: number) {
  const spring = h - 0.62 * w
  const s = new THREE.Shape()
  s.moveTo(-w / 2, 0)
  s.lineTo(-w / 2, spring)
  s.quadraticCurveTo(-w / 2, h - 0.37 * w, 0, h)
  s.quadraticCurveTo(w / 2, h - 0.37 * w, w / 2, spring)
  s.lineTo(w / 2, 0)
  return new THREE.ExtrudeGeometry(s, { depth: 0.006, bevelEnabled: false, curveSegments: 5 })
}

// An onion dome's outline: radius against height, in drum radii, from the drum up to the tip.
const ONION = [[1, 0], [1.13, 0.17], [1.24, 0.42], [1.27, 0.7], [1.22, 1], [1.08, 1.3], [0.86, 1.6], [0.58, 1.85], [0.3, 2.05], [0.1, 2.2], [0, 2.26]]
const ONION_HEIGHT = 2.26
const onion = (r: number, segments = 12) => new THREE.LatheGeometry(ONION.map(([x, y]) => new THREE.Vector2(x * r, y * r)), segments)

/** A chhatri `r` wide at (lx, y, lz): a domed kiosk on open columns, whose shaded core is all that shows at this size. */
function chhatri(put: Put, lx: number, lz: number, y: number, r: number) {
  const at = (g: THREE.BufferGeometry) => g.translate(lx, 0, lz)
  put(at(new THREE.CylinderGeometry(0.8 * r, 0.8 * r, r, 8)), RECESS, y + 0.5 * r, 0)
  put(at(new THREE.CylinderGeometry(1.1 * r, r, 0.15 * r, 8)), MARBLE, y + 1.05 * r, 0)
  put(at(onion(0.75 * r)), MARBLE, y + 1.1 * r, 0)
  put(at(new THREE.ConeGeometry(0.1 * r, 0.6 * r, 5)), GOLD, y + (1.1 + 0.75 * ONION_HEIGHT + 0.3) * r, 0)
}

/** A crenellated wall `h` high from (x0, z0) to (x1, z1). */
function rampart(put: Put, x0: number, z0: number, x1: number, z1: number, h: number) {
  const len = Math.hypot(x1 - x0, z1 - z0)
  const a = Math.atan2(x1 - x0, z1 - z0)
  const at = (g: THREE.BufferGeometry, t: number) => g.rotateY(a).translate(x0 + (x1 - x0) * t, 0, z0 + (z1 - z0) * t)
  put(at(new THREE.BoxGeometry(0.045, h, len + 0.02), 0.5), SANDSTONE, h / 2, 0.2)
  for (let t = 0.04 / len; t < 1; t += 0.075 / len) put(at(new THREE.BoxGeometry(0.03, 0.03, 0.035), t), SANDSTONE, h + 0.015, 0)
}

/** An octagonal sandstone tower `h` high at (lx, lz), crowned by a marble chhatri. */
function tower(stone: Put, white: Put, lx: number, lz: number, h: number, r: number) {
  stone(new THREE.CylinderGeometry(r, 1.1 * r, h, 8).translate(lx, 0, lz), SANDSTONE, h / 2, 0.2)
  chhatri(white, lx, lz, h, 0.9 * r)
}

/** The mausoleum on its plinth: a chamfered marble cube under the onion dome, with four chhatris and four minarets. */
function mausoleum(site: Site) {
  const put = parts(site, marble, TAJ.x, GROUND + 0.07, TAJ.z, 1.45)
  put(new RoundedBoxGeometry(1.2, 0.08, 1.2, 1, 0.01), MARBLE, 0.04, 0.2)
  const y = 0.08
  const a = 0.36
  const c = 0.12
  const h = 0.4
  const plan = [[a - c, a], [a, a - c], [a, c - a], [a - c, -a], [c - a, -a], [-a, c - a], [-a, a - c], [c - a, a]]
  put(slab(new THREE.Shape(plan.map(([x, z]) => new THREE.Vector2(x, z))), 0, h), MARBLE, y, 0.2)
  for (let k = 0; k < 4; k++) {
    const f = (k * Math.PI) / 2
    // The pishtaq: a tall frame round the great arch, rising above the parapet.
    put(onFace(new THREE.BoxGeometry(0.34, h + 0.05, 0.03).translate(0, (h + 0.05) / 2, 0), f, a), MARBLE, y, 0)
    put(onFace(arch(0.2, 0.31), f, a + 0.015), RECESS, y + 0.03, 0)
    for (const u of [-0.205, 0.205]) for (const ay of [0.04, 0.22]) put(onFace(arch(0.05, 0.13), f, a, u), RECESS, y + ay, 0)
    for (const ay of [0.04, 0.22]) put(onFace(arch(0.09, 0.14), f + Math.PI / 4, (a - c / 2) * Math.SQRT2), RECESS, y + ay, 0)
    // Pinnacles at the pishtaq's sides and the corners.
    for (const u of [-0.17, 0.17]) put(onFace(new THREE.CylinderGeometry(0.006, 0.009, 0.12, 6), f, a + 0.01, u), MARBLE, y + h + 0.01, 0)
    put(onFace(new THREE.CylinderGeometry(0.006, 0.009, 0.12, 6), f, a, a - c), MARBLE, y + h - 0.01, 0)
    put(onFace(new THREE.CylinderGeometry(0.006, 0.009, 0.12, 6), f, a, c - a), MARBLE, y + h - 0.01, 0)
  }
  put(new THREE.CylinderGeometry(0.15, 0.15, 0.12, 32), MARBLE, y + h + 0.04, 0.1)
  const top = y + h + 0.1
  put(onion(0.15, 32), MARBLE, top, 0)
  const tip = top + ONION_HEIGHT * 0.15
  put(new THREE.CylinderGeometry(0.004, 0.007, 0.12, 6), GOLD, tip + 0.06, 0)
  for (const fy of [0.025, 0.06]) put(new THREE.SphereGeometry(0.011, 8, 6), GOLD, tip + fy, 0)
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    chhatri(put, sx * 0.2, sz * 0.2, y + h, 0.05)
    // The minarets stand at the plinth's corners, a balcony at the top of each of their three stages.
    const at = (g: THREE.BufferGeometry) => g.translate(sx * 0.55, 0, sz * 0.55)
    put(at(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 8)), MARBLE, y + 0.015, 0.2)
    put(at(new THREE.CylinderGeometry(0.03, 0.037, 0.46, 16)), MARBLE, y + 0.26, 0.1)
    for (const ry of [0.17, 0.33, 0.48]) put(at(new THREE.CylinderGeometry(0.05, 0.042, 0.016, 16)), MARBLE, y + ry, 0)
    chhatri(put, sx * 0.55, sz * 0.55, y + 0.49, 0.04)
  }
}

/** The red sandstone mosque west of the tomb, or its twin the jawab to the east: each faces it under three marble domes. */
function mosque(site: Site, z: number) {
  const stone = parts(site, materials.clay, TAJ.x, GROUND + 0.07, z, 1.2)
  const white = parts(site, marble, TAJ.x, GROUND + 0.07, z, 1.2)
  const f = z < TAJ.z ? 0 : Math.PI
  stone(new RoundedBoxGeometry(0.66, 0.2, 0.26, 1, 0.01), SANDSTONE, 0.1, 0.25)
  stone(onFace(new THREE.BoxGeometry(0.2, 0.25, 0.02).translate(0, 0.125, 0), f, 0.13), SANDSTONE, 0, 0)
  stone(onFace(arch(0.12, 0.19), f, 0.14), DOORWAY, 0.01, 0)
  for (const u of [-0.26, -0.17, 0.17, 0.26]) stone(onFace(arch(0.065, 0.13), f, 0.13, u), DOORWAY, 0.02, 0)
  for (const [u, r] of [[-0.2, 0.05], [0, 0.07], [0.2, 0.05]]) {
    white(new THREE.CylinderGeometry(r, r, 0.05, 16).translate(u, 0, 0), MARBLE, 0.215, 0)
    white(onion(r, 16).translate(u, 0, 0), MARBLE, 0.24, 0)
    white(new THREE.ConeGeometry(0.008, 0.05, 5).translate(u, 0, 0), GOLD, 0.26 + ONION_HEIGHT * r, 0)
  }
  for (const [lx, lz] of [[0.31, 0.11], [0.31, -0.11], [-0.31, 0.11], [-0.31, -0.11]]) tower(stone, white, lx, lz, 0.3, 0.026)
}

/** The great gate: red sandstone framed in marble, with corner towers and a row of eleven chhatris over each face. */
function gate(site: Site) {
  const stone = parts(site, materials.clay, GATE, GROUND - 0.02, TAJ.z, 1.25)
  const white = parts(site, marble, GATE, GROUND - 0.02, TAJ.z, 1.25)
  stone(new RoundedBoxGeometry(0.3, 0.36, 0.56, 1, 0.012), SANDSTONE, 0.18, 0.25)
  for (const f of [Math.PI / 2, -Math.PI / 2]) {
    white(onFace(new THREE.BoxGeometry(0.28, 0.3, 0.012).translate(0, 0.15, 0), f, 0.15), MARBLE, 0.03, 0)
    stone(onFace(arch(0.16, 0.25), f, 0.156), DOORWAY, 0.04, 0)
    for (const u of [-0.21, 0.21]) for (const ay of [0.04, 0.19]) stone(onFace(arch(0.05, 0.1), f, 0.15, u), DOORWAY, ay, 0)
    for (let i = 0; i < 11; i++) {
      const u = -0.2 + i * 0.04
      white(onFace(new THREE.BoxGeometry(0.022, 0.02, 0.022), f, 0.12, u), MARBLE, 0.37, 0)
      white(onFace(onion(0.011, 8), f, 0.12, u), MARBLE, 0.38, 0)
    }
  }
  for (const [lx, lz] of [[0.15, 0.28], [0.15, -0.28], [-0.15, 0.28], [-0.15, -0.28]]) tower(stone, white, lx, lz, 0.42, 0.04)
}

/**
 * The charbagh: four lawns quartered by water channels, the raised marble tank where
 * they cross, cypresses along the long channel to the tomb, and red sandstone walls.
 */
function garden(site: Site) {
  const flat = (w: number, d: number, color: string, x: number, z: number, top: number) =>
    site.b.add(materials.clay, paint(new RoundedBoxGeometry(w, 0.03, d, 1, 0.005), color, 0), x, GROUND + top - 0.015, z)
  const len = TERRACE - GATE
  flat(len, 2 * WIDE, '#86ac58', (GATE + TERRACE) / 2, TAJ.z, 0.006)
  flat(len, 0.3, '#d6bba3', (GATE + TERRACE) / 2, TAJ.z, 0.012)
  flat(0.26, 2 * WIDE, '#d6bba3', TANK, TAJ.z, 0.012)
  flat(len - 0.06, 0.08, '#5f9fb5', (GATE + TERRACE) / 2, TAJ.z, 0.017)
  flat(0.07, 2 * WIDE - 0.06, '#5f9fb5', TANK, TAJ.z, 0.017)
  flat(0.42, 0.42, MARBLE, TANK, TAJ.z, 0.045)
  flat(0.32, 0.32, '#5f9fb5', TANK, TAJ.z, 0.05)

  for (let x = GATE + 0.25; x < TERRACE - 0.15; x += 0.2) {
    if (Math.abs(x - TANK) < 0.32) continue
    for (const s of [-1, 1]) cypress(site.b, x, GROUND - 0.02, TAJ.z + s * 0.22, 0.55)
  }
  const greens = ['#5e8c41', '#6f9a4b', '#4f7d3a']
  let k = 0
  for (const [x0, x1] of [[GATE + 0.05, TANK - 0.13], [TANK + 0.13, TERRACE - 0.05]]) {
    for (const s of [-1, 1]) {
      for (const fx of [0.3, 0.7]) {
        for (const fz of [0.4, 0.8]) tree(site.b, x0 + fx * (x1 - x0), GROUND - 0.02, TAJ.z + s * (0.15 + fz * (WIDE - 0.2)), 0.65, greens[k++ % 3])
      }
    }
  }

  const stone = parts(site, materials.clay, 0, GROUND - 0.02, 0)
  const white = parts(site, marble, 0, GROUND - 0.02, 0)
  for (const s of [-1, 1]) {
    rampart(stone, GATE, TAJ.z + s * WIDE, RIVERSIDE, TAJ.z + s * WIDE, 0.12)
    rampart(stone, GATE, TAJ.z + s * 0.35, GATE, TAJ.z + s * WIDE, 0.12)
    tower(stone, white, GATE, TAJ.z + s * WIDE, 0.2, 0.06)
    tower(stone, white, RIVERSIDE - 0.04, TAJ.z + s * (WIDE - 0.04), 0.3, 0.075)
  }
}

/** The Taj Mahal: the tomb and its two flanking buildings on the riverside terrace, the garden, and the great gate. */
function tajMahal(site: Site) {
  const terrace = new RoundedBoxGeometry(RIVERSIDE - TERRACE, 0.1, 2 * WIDE, 1, 0.01)
  site.b.add(materials.clay, grassAndStone(terrace, '#d9c4ae', SANDSTONE), (RIVERSIDE + TERRACE) / 2, GROUND + 0.02, TAJ.z)
  mausoleum(site)
  for (const s of [-1, 1]) mosque(site, TAJ.z + s * 1.4)
  garden(site)
  gate(site)
  // Keep the town out of the walls and the forecourt before the gate, and the lamps off the riverfront.
  blockBox(site, (GATE - 0.5 + RIVERSIDE + 0.2) / 2, TAJ.z, RIVERSIDE + 0.2 - (GATE - 0.5), 2 * WIDE + 0.24)
}

/**
 * Agra Fort upstream: double red sandstone ramparts in a half circle, its straight side
 * along the river, where the white marble palaces and the octagonal Musamman Burj look
 * down the Yamuna towards the Taj.
 */
function agraFort(site: Site, z0: number) {
  // Lay the fort out along the bank: lx runs downstream, lz inland.
  const along = new THREE.Vector2(centre(z0 + 0.01) - centre(z0 - 0.01), 0.02).normalize()
  const x = centre(z0) - half() - along.y * 0.32
  const z = z0 + along.x * 0.32
  const turn = Math.atan2(-along.y, along.x)
  const k = 1.25
  const place = placer(site.b, x, GROUND - 0.02, z, turn)
  const put: Put = (g, color, py, ao) => place(g.scale(k, k, k), color, py * k, ao)
  const R = 0.85
  const MOAT = 0.17
  const arc = (r: number, a: number) => [r * Math.cos(a), r * Math.sin(a)]
  const band = (r0: number, r1: number) => {
    const outline: THREE.Vector2[] = []
    for (let i = 0; i <= 24; i++) outline.push(new THREE.Vector2(...arc(r1, (i / 24) * Math.PI)))
    for (let i = 24; i >= 0 && r0 > 0; i--) outline.push(new THREE.Vector2(...arc(r0, (i / 24) * Math.PI)))
    return new THREE.Shape(outline.map((v) => v.set(v.x, -v.y)))
  }
  site.b.add(materials.clay, grassAndStone(slab(band(0, R - 0.05), GROUND - 0.03, GROUND + 0.04).scale(k, 1, k), '#b3b273', SANDSTONE), x, 0, z, turn)
  // The dry moat round the landward walls.
  site.b.add(materials.clay, grassAndStone(slab(band(R + 0.03, R + MOAT), GROUND - 0.03, GROUND + 0.003).scale(k, 1, k), '#7f8c50', '#7f8c50'), x, 0, z, turn)
  for (const [r, h] of [[R, 0.12], [R - 0.09, 0.2]]) {
    for (let i = 0; i < 14; i++) {
      const [ax, az] = arc(r, (i / 14) * Math.PI)
      const [bx, bz] = arc(r, ((i + 1) / 14) * Math.PI)
      rampart(put, ax, az, bx, bz, h)
    }
  }
  rampart(put, -R, 0, R, 0, 0.2)
  for (let i = 0; i <= 4; i++) {
    const [lx, lz] = arc(R, (i * Math.PI) / 4)
    put(new THREE.CylinderGeometry(0.07, 0.075, 0.16, 12).translate(lx, 0, lz), SANDSTONE, 0.08, 0.2)
  }
  // Amar Singh Gate in the south and Delhi Gate in the west: each a pair of octagonal towers.
  for (const g of [0.5, Math.PI - 0.7]) {
    for (const d of [-0.09, 0.09]) {
      const [lx, lz] = arc(R, g + d)
      put(new THREE.CylinderGeometry(0.05, 0.055, 0.27, 8).translate(lx, 0, lz), SANDSTONE, 0.135, 0.2)
      put(onion(0.035).translate(lx, 0, lz), '#c98c6c', 0.27, 0)
    }
  }
  // The Khas Mahal between its two golden-roofed pavilions, and the Musamman Burj on its bastion.
  put(new RoundedBoxGeometry(0.22, 0.09, 0.11, 1, 0.008).translate(0.28, 0, 0.12), MARBLE, 0.085, 0.2)
  for (const lx of [0.13, 0.43]) {
    put(new RoundedBoxGeometry(0.07, 0.08, 0.08, 1, 0.006).translate(lx, 0, 0.1), MARBLE, 0.08, 0.2)
    put(new THREE.CylinderGeometry(0.042, 0.042, 0.075, 12, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).translate(lx, 0, 0.1), GOLD, 0.12, 0)
  }
  put(new THREE.CylinderGeometry(0.1, 0.11, 0.22, 16).translate(0.62, 0, 0), SANDSTONE, 0.11, 0.2)
  put(new THREE.CylinderGeometry(0.065, 0.065, 0.1, 8).translate(0.62, 0, 0), MARBLE, 0.27, 0.1)
  put(onion(0.05).translate(0.62, 0, 0), MARBLE, 0.32, 0)
  put(new THREE.ConeGeometry(0.007, 0.05, 5).translate(0.62, 0, 0), GOLD, 0.32 + ONION_HEIGHT * 0.05 + 0.02, 0)
  // The Jahangiri Mahal in red sandstone, the Diwan-i-Am, and the Moti Masjid under three domes.
  put(new RoundedBoxGeometry(0.3, 0.15, 0.18, 1, 0.01).translate(0.42, 0, 0.45), SANDSTONE, 0.115, 0.2)
  for (const lx of [0.29, 0.55]) put(onion(0.03).translate(lx, 0, 0.36), '#c98c6c', 0.19, 0)
  put(new RoundedBoxGeometry(0.36, 0.1, 0.18, 1, 0.01).translate(-0.1, 0, 0.32), '#ece6da', 0.09, 0.2)
  put(new RoundedBoxGeometry(0.22, 0.09, 0.12, 1, 0.008).translate(-0.47, 0, 0.3), MARBLE, 0.085, 0.2)
  for (const [lx, r] of [[-0.55, 0.026], [-0.47, 0.034], [-0.39, 0.026]]) put(onion(r).translate(lx, 0, 0.3), MARBLE, 0.13, 0)

  site.block((bx, bz, r) => {
    const dx = bx - x
    const dz = bz - z
    const lz = dz * along.x - dx * along.y
    return lz > -r - 0.1 && Math.hypot(dx * along.x + dz * along.y, lz) < k * (R + MOAT) + r + 0.04
  })
}

export function buildAgra() {
  return buildIsland({
    seed: 78,
    heading: Math.PI / 2,
    centre,
    half,
    grass: '#aab574',
    water: '#4d8a84',
    // Mehtab Bagh, the Moonlight Garden, across the river from the Taj.
    parks: [{ x: 4.15, z: TAJ.z, a: 0.8, c: 1.1, h: 0 }],
    houses: {
      count: 130,
      walls: ['#e6cfa8', '#d9a98a', '#efe4d0', '#c99474', '#e3d3b4', '#d4b7a0', '#f2ebdf', '#c3cdb6'],
      roofs: ['#a9553c'],
      pitched: 0.06,
      width: [0.22, 0.38],
      floors: (r) => 1 + Math.floor(r() * r() * 3),
    },
    trees: { count: 45, park: 30, greens: ['#5e8c41', '#6f9a4b', '#4f7d3a'], cypress: 0.1 },
    landmarks(site) {
      tajMahal(site)
      agraFort(site, -3.1)
      // A boat crosses between the Taj and Mehtab Bagh.
      const z = 2.75
      boat(site, (s) => [centre(z) - half() + 0.3 + s * (2 * half() - 0.6), z], 40, '#6b4a33', '#b48a5a', 0.75)
      site.animate((_t, _wind, m) => {
        // A phase within 0.085 of full is about two and a half days either side of the full moon.
        marble.emissiveIntensity = Math.abs(m.moon - 0.5) < 0.085 ? 0.3 * m.night * (0.25 + 0.75 * m.clear) : 0
      })
    },
  })
}
