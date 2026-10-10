import * as THREE from 'three'
import { RoundedBoxGeometry } from './rounded-box'
import { GROUND, house, materials, paint, random } from './kit'
import { blockBox, boat, buildIsland, gable, hip, placer, plantPalm, slab, strut, traffic, type Moment, type Site } from './island'

// Buenos Aires lies flat along the brown Río de la Plata. Puerto Madero's docks run
// between the old centre and the river, with the Plaza de Mayo just inland, Avenida
// 9 de Julio and the Obelisco beyond, Recoleta and its steel flower to the north and
// La Boca to the south. The island is turned so the river, laid out along +x, lies
// to the east-north-east, as it does from the city.
const HEADING = 0.6
const shore = (z: number) => 2.1 + 0.75 * Math.exp(-(((z - 1.1) / 0.9) ** 2)) - 0.3 * THREE.MathUtils.smoothstep(z, 2.6, 4.6)
const SEA = 5
const centre = (z: number) => shore(z) + SEA
const half = () => SEA

// The street grid runs with the compass, so it is turned back against the island.
const GRID = -HEADING
/** The point `east` and `south` of (x, z) along the street grid. */
const grid = (x: number, z: number, east: number, south: number): [number, number] => [
  x + east * Math.cos(HEADING) - south * Math.sin(HEADING),
  z + east * Math.sin(HEADING) + south * Math.cos(HEADING),
]

const FLORALIS = { x: -0.45, z: -2.4 }
const OBELISCO = { x: -1.2, z: -0.6 }
const PLAZA = { x: 0, z: 0.3 }
const BOMBONERA = { x: -0.4, z: 2.8 }
const CAMINITO = { x: -1.35, z: 3.3 }

const RIVER = '#746e58'
const STONE = '#d6cfbf'
const WHITE = '#efebe3'
const GREENS = ['#5f8a4a', '#6c9650', '#577f41']

const water = new THREE.MeshStandardMaterial({ color: RIVER, roughness: 0.15 })

/** A square pillar narrowing from `bottom` to `top` wide, with flat faces, standing on y = 0. */
function pillar(bottom: number, top: number, height: number) {
  const g = new THREE.CylinderGeometry(top * Math.SQRT1_2, bottom * Math.SQRT1_2, height, 4, 1).toNonIndexed()
  g.rotateY(Math.PI / 4)
  g.translate(0, height / 2, 0)
  g.computeVertexNormals()
  return g
}

// The petals open at eight in the morning and close at midnight, but stay open round
// the clock on the national days of 25 May and 9 July. They close early in strong wind.
const nationalDay = (m: Moment) => (m.month === 5 && m.date === 25) || (m.month === 7 && m.date === 9)
const STRONG_WIND = 10

/**
 * Floralis Genérica: a giant flower of polished steel standing in a pool, its six
 * petals opening and closing with the city's day. After dark it glows red inside.
 */
function floralis(site: Site) {
  const { x, z } = FLORALIS
  const put = placer(site.b, x, GROUND - 0.02, z)
  put(new THREE.CylinderGeometry(0.62, 0.63, 0.04, 48), STONE, 0.02, 0.2)
  site.b.add(water, new THREE.CylinderGeometry(0.58, 0.58, 0.02, 48), x, GROUND + 0.012, z)
  const hinge = GROUND + 0.25
  put(new THREE.CylinderGeometry(0.018, 0.03, hinge - GROUND, 8), '#c9ced3', (hinge - GROUND) / 2 + 0.02, 0)
  put(new THREE.CylinderGeometry(0.075, 0.018, 0.075, 16), '#c9ced3', hinge - GROUND - 0.0175, 0)
  site.reserve(x, z, 0.68)

  // The stamens in the middle, their tips lit with the inside of the petals.
  const glow = new THREE.MeshStandardMaterial({ color: '#e8e4e0', roughness: 0.4, emissive: '#ff2a3d', emissiveIntensity: 0 })
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + 0.4
    const tip = new THREE.Vector3(Math.cos(a) * 0.045, 0.285 - 0.03 * (k % 2), Math.sin(a) * 0.045)
    put(strut(new THREE.Vector3(), tip, 0.006, 0.0045, 4), '#c9ced3', hinge - GROUND + 0.02, 0)
    site.b.add(glow, new THREE.SphereGeometry(0.02, 8, 6), x + tip.x, hinge + tip.y, z + tip.z)
  }

  // Each petal is one sixth of a long bud, turned on a lathe and hinged at its foot.
  const foot = 0.052
  const profile = [[foot, 0], [0.12, 0.06], [0.165, 0.15], [0.18, 0.255], [0.168, 0.36], [0.128, 0.45], [0.068, 0.518], [0.018, 0.54]]
  const gap = 0.025
  const petal = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 8, -Math.PI / 6 + gap, Math.PI / 3 - 2 * gap)
  const steel = new THREE.MeshStandardMaterial({ color: '#dfe4e8', roughness: 0.25 })
  const inside = new THREE.MeshStandardMaterial({ color: '#cfd5da', roughness: 0.3, side: THREE.BackSide, emissive: '#ff2a3d', emissiveIntensity: 0 })
  const outer = new THREE.InstancedMesh(petal, steel, 6)
  const inner = new THREE.InstancedMesh(petal, inside, 6)
  outer.castShadow = true
  outer.receiveShadow = inner.receiveShadow = true
  // The petals move, so their bounds are never computed for culling.
  outer.frustumCulled = inner.frustumCulled = false
  site.group.add(outer, inner)
  const m = new THREE.Matrix4()
  const step = new THREE.Matrix4()
  const place = (open: number) => {
    for (let k = 0; k < 6; k++) {
      m.makeTranslation(x, hinge, z)
        .multiply(step.makeRotationY((k * Math.PI) / 3))
        .multiply(step.makeTranslation(0, 0, foot))
        .multiply(step.makeRotationX(1.15 * open))
        .multiply(step.makeTranslation(0, 0, -foot))
      outer.setMatrixAt(k, m)
      inner.setMatrixAt(k, m)
    }
    outer.instanceMatrix.needsUpdate = inner.instanceMatrix.needsUpdate = true
  }

  let open = 0
  let last = -Infinity
  let onScreen = 0
  site.animate((t, wind, moment) => {
    if (t - last > 1) onScreen = 0
    const dt = Math.min(0.1, Math.max(0, t - last))
    last = t
    onScreen += dt
    const target = (moment.hour >= 8 || nationalDay(moment)) && wind.length() < STRONG_WIND ? 1 : 0
    // Settled at once while the island rises into view; after that the petals take six seconds.
    open = onScreen < 3 ? target : open + THREE.MathUtils.clamp(target - open, -dt / 6, dt / 6)
    place(THREE.MathUtils.smoothstep(open, 0, 1))
    inside.emissiveIntensity = glow.emissiveIntensity = 1.6 * moment.night
  })
}

/** Avenida 9 de Julio, broad enough for twenty lanes, with the Obelisco in its middle. */
function nueveDeJulio(site: Site) {
  const length = 3.2
  const [x, z] = grid(OBELISCO.x, OBELISCO.z, 0, 0.35)
  const put = placer(site.b, x, GROUND - 0.02, z, GRID)
  put(new RoundedBoxGeometry(0.34, 0.03, length, 1, 0.01), '#9a968e', 0.015, 0)
  for (const e of [-0.07, 0.07]) put(new RoundedBoxGeometry(0.035, 0.034, length - 0.04, 1, 0.008).translate(e, 0, 0), '#8faa63', 0.017, 0)
  blockBox(site, x, z, 0.42, length, GRID)
  const from = grid(x, z, 0, -length / 2 + 0.05)
  const to = grid(x, z, 0, length / 2 - 0.05)
  traffic(site, (s) => new THREE.Vector3(from[0] + (to[0] - from[0]) * s, GROUND + 0.03, from[1] + (to[1] - from[1]) * s), 0.06, 4)

  const obelisco = placer(site.b, OBELISCO.x, GROUND - 0.02, OBELISCO.z, GRID)
  obelisco(new THREE.CylinderGeometry(0.18, 0.18, 0.036, 32), STONE, 0.018, 0)
  obelisco(pillar(0.12, 0.075, 1.1), WHITE, 0.03, 0.15)
  obelisco(hip(0.075, 0.08), WHITE, 1.13, 0)
}

/**
 * The Plaza de Mayo: the pink Casa Rosada at its east end, the white Cabildo at its
 * west end, and the Pirámide de Mayo among palms between them.
 */
function plazaDeMayo(site: Site) {
  const { x, z } = PLAZA
  for (const [e, s] of [[-0.25, -0.13], [0.25, -0.13], [-0.25, 0.13], [0.25, 0.13]]) plantPalm(site, ...grid(x, z, e, s), 0.75, e * 9 + s)
  const put = placer(site.b, x, GROUND - 0.02, z, GRID)
  put(new RoundedBoxGeometry(0.8, 0.034, 0.42, 1, 0.01), STONE, 0.017, 0)
  put(new RoundedBoxGeometry(0.05, 0.03, 0.05, 1, 0.005), WHITE, 0.049, 0)
  put(pillar(0.026, 0.014, 0.1), WHITE, 0.064, 0)

  const rosada = placer(site.b, x, GROUND - 0.02, z, GRID, 0.53, 0)
  const pink = '#e2a39a'
  rosada(new RoundedBoxGeometry(0.22, 0.18, 0.5, 2, 0.012), pink, 0.09, 0.3)
  rosada(new RoundedBoxGeometry(0.235, 0.02, 0.515, 1, 0.006), '#f0d8d2', 0.19, 0)
  // The middle and the two ends stand forward and taller, the middle under an arch.
  for (const s of [-0.21, 0, 0.21]) rosada(new RoundedBoxGeometry(0.24, 0.21, 0.1, 2, 0.012).translate(0, 0, s), pink, 0.105, 0.3)
  rosada(new RoundedBoxGeometry(0.02, 0.09, 0.045, 1, 0.006).translate(-0.12, 0, 0), '#7c4440', 0.045, 0)

  const cabildo = placer(site.b, x, GROUND - 0.02, z, GRID, -0.5, 0)
  cabildo(new RoundedBoxGeometry(0.13, 0.13, 0.34, 2, 0.01), WHITE, 0.065, 0.3)
  cabildo(gable(0.34, 0.06, 0.15).rotateY(Math.PI / 2), '#b5603f', 0.13, 0)
  cabildo(new RoundedBoxGeometry(0.075, 0.25, 0.075, 1, 0.008), WHITE, 0.125, 0.2)
  cabildo(hip(0.075, 0.05), '#b5603f', 0.25, 0)
  // Kept clear to the south too, so the Casa Rosada shows from the camera.
  blockBox(site, ...grid(x, z, 0.03, 0.15), 1.25, 0.9, GRID)
}

/**
 * Puerto Madero: three of the old docks in a row, red-brick warehouses along their
 * west quays, glass towers along their east quays, and the Puente de la Mujer's
 * white mast leaning over the middle dock.
 */
function puertoMadero(site: Site) {
  const r = random(331)
  for (let i = 0; i < 3; i++) {
    const [x, z] = grid(PLAZA.x, PLAZA.z, 1.25, (i - 1) * 0.9)
    placer(site.b, x, GROUND - 0.02, z, GRID)(new RoundedBoxGeometry(0.3, 0.04, 0.82, 1, 0.012), '#cfc6b4', 0.02, 0)
    site.b.add(water, new THREE.BoxGeometry(0.24, 0.02, 0.76), x, GROUND + 0.012, z, GRID)
    const [wx, wz] = grid(x, z, -0.25, 0)
    house(site.b, wx, GROUND - 0.03, wz, GRID, 0.13, 0.66, 2 + (i % 2), '#a4553f', null, r)
    for (const s of [-0.2, 0.2]) {
      const [tx, tz] = grid(x, z, 0.3, s)
      house(site.b, tx, GROUND - 0.03, tz, GRID, 0.17, 0.17, 6 + Math.floor(r() * 4), ['#a9bccb', '#c4ced6', '#93a8b8'][Math.floor(r() * 3)], null, r)
    }
    blockBox(site, ...grid(x, z, 0.02, 0), 0.82, 0.86, GRID)
  }

  // The mast leans out over the east quay, between two towers; the cables fan down to the deck.
  const [x, z] = grid(PLAZA.x, PLAZA.z, 1.25, 0)
  const put = placer(site.b, x, GROUND, z, GRID)
  const white = '#f3f2ee'
  put(new RoundedBoxGeometry(0.36, 0.018, 0.05, 1, 0.006), white, 0.03, 0)
  const foot = new THREE.Vector3(0.07, 0.04, 0)
  const top = new THREE.Vector3(0.21, 0.34, 0)
  put(strut(foot, top, 0.012, 0.005), white, 0, 0.05)
  for (let k = 1; k <= 5; k++) put(strut(foot.clone().lerp(top, 0.4 + 0.12 * k), new THREE.Vector3(0.02 - 0.04 * k, 0.04, 0), 0.0025, 0.0025, 3), '#e2e2de', 0, 0)
}

/** A rounded rectangle w × d with corners of radius r, traced onto `path`. */
function rounded<T extends THREE.Path>(path: T, w: number, d: number, r: number) {
  const x = w / 2
  const y = d / 2
  path.moveTo(-x + r, -y)
  path.lineTo(x - r, -y)
  path.quadraticCurveTo(x, -y, x, -y + r)
  path.lineTo(x, y - r)
  path.quadraticCurveTo(x, y, x - r, y)
  path.lineTo(-x + r, y)
  path.quadraticCurveTo(-x, y, -x, y - r)
  path.lineTo(-x, -y + r)
  path.quadraticCurveTo(-x, -y, -x + r, -y)
  return path
}

/** La Bombonera, Boca Juniors' stadium: steep stands in blue and gold round the pitch. */
function bombonera(site: Site) {
  const { x, z } = BOMBONERA
  const ring = (w: number, d: number, hw: number, hd: number, top: number) => {
    const s = rounded(new THREE.Shape(), w, d, 0.1)
    s.holes.push(rounded(new THREE.Path(), hw, hd, 0.06))
    return slab(s, GROUND - 0.02, top)
  }
  site.b.add(materials.landmark, paint(ring(0.56, 0.44, 0.42, 0.3, GROUND + 0.14), '#1f4f9c', 0.2), x, 0, z, GRID)
  site.b.add(materials.landmark, paint(ring(0.43, 0.31, 0.32, 0.2, GROUND + 0.08), '#f2c42c', 0.1), x, 0, z, GRID)
  placer(site.b, x, GROUND - 0.02, z, GRID)(new RoundedBoxGeometry(0.33, 0.03, 0.21, 1, 0.01), '#5f9a4a', 0.015, 0)
  blockBox(site, x, z, 0.6, 0.48, GRID)
}

/** Caminito in La Boca: a short lane of tin-roofed houses painted in bright, odd colours. */
function caminito(site: Site) {
  const r = random(337)
  const walls = ['#d9442e', '#f2c230', '#2f6fc0', '#3f9a5c', '#e57d2e', '#8fc1d9', '#c94f7c']
  const roofs = ['#8d4b3a', '#6d7a7f', '#b8643c', '#4f7f8f']
  for (let i = 0; i < 7; i++) {
    for (const side of [-1, 1]) {
      const [x, z] = grid(CAMINITO.x, CAMINITO.z, -0.6 + i * 0.2, side * 0.16)
      const k = i * 2 + (side > 0 ? 1 : 0)
      house(site.b, x, GROUND - 0.03, z, GRID, 0.17, 0.2, 1 + (k % 3 === 0 ? 1 : 0), walls[(k * 3) % walls.length], roofs[k % roofs.length], r, 0.6)
    }
  }
  blockBox(site, CAMINITO.x, CAMINITO.z, 1.5, 0.6, GRID)
}

export function buildBuenosAires() {
  // The old centre and Microcentro rise highest; the rest of the city is mid-rise.
  const busy = (x: number, z: number) => Math.exp(-((x + 0.6) ** 2 + (z + 0.3) ** 2) / 1.4)
  return buildIsland({
    seed: 307,
    heading: HEADING,
    centre,
    half,
    grass: '#a2b671',
    water: RIVER,
    // The gardens round the steel flower, the Bosques de Palermo, and the Reserva
    // Ecológica out on the river beyond Puerto Madero.
    parks: [
      { x: FLORALIS.x, z: FLORALIS.z, a: 1, c: 0.85, h: 0 },
      { x: 0.3, z: -3.9, a: 0.9, c: 0.6, h: 0 },
      { x: 2.35, z: 1.1, a: 0.4, c: 0.8, h: 0 },
    ],
    houses: {
      count: 130,
      walls: ['#ece6d8', '#e3d9c6', '#d9cfbd', '#f0ebe1', '#cfc6b6', '#e8dcc4', '#b9b2a6', '#d7b49e'],
      // Dark slate roofs stand for the Parisian mansards over the old avenues.
      roofs: ['#5d6670', '#6b737c', '#7d6a5c'],
      pitched: 0.22,
      pitch: 0.9,
      width: [0.22, 0.36],
      floors: (r, x, z) => 1 + Math.floor(r() * (2 + 3 * busy(x, z))),
      grid: GRID,
    },
    trees: { count: 35, park: 40, greens: GREENS, cypress: 0 },
    landmarks(site) {
      floralis(site)
      nueveDeJulio(site)
      plazaDeMayo(site)
      puertoMadero(site)
      bombonera(site)
      caminito(site)
      // The ferry out across the river to Uruguay.
      boat(site, (s) => [shore(-1.6) + 0.3 + 2.6 * s, -1.6 - 1.4 * s], 46, '#1f3f7a', '#f2efe6', 0.8)
    },
  })
}
