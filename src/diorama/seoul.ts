import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { GROUND, house, materials, paint, random, tree } from './kit'
import { BASE, TAU, WATER, blockBox, boat, buildIsland, grassAndStone, lowest, placer, ridge, slab, stoneBridge, type Moment, type Put, type Site } from './island'
import { createSprites } from './sprites'

// The Han runs west through Seoul, wide and slow, round Yeouido. Namsan and its tower
// rise on the north bank, with the old palace and the mountains behind them; Gangnam
// spreads over the south bank to the Lotte World Tower. The island is turned so the
// river runs east to west, with the old city to the north.
const centre = (z: number) => -0.15 + 0.2 * Math.sin(0.45 * z + 0.6)
// The river widens round Yeouido, its main channel to the north.
const half = (z: number) => 0.7 + 0.45 * THREE.MathUtils.smoothstep(z, -4.9, -4.3) * (1 - THREE.MathUtils.smoothstep(z, -2, -1.4))

const YEOUIDO = { z: -3.1, length: 2.3, width: 0.85, shift: -0.33 }
const BANPO_Z = 0.2
const NAMSAN = { x: 2.2, z: -0.1, a: 0.8, c: 1.05, h: 0.7, grass: '#6a9550', rough: 0.15 }
const PALACE = { x: 3.55, z: -1.5 }
const LOTTE = { x: -1.8, z: 3.5 }

const GREENS = ['#5f8a4a', '#6c9650', '#4f7b3c']
const TILE = '#4a4f57'
const TIMBER = '#8b3a2e'
const WHITES = ['#f1efe9', '#ece6d8', '#e4e4df', '#f3ede2']

// Fine dust (PM2.5) over Namsan, from Open-Meteo's air-quality forecast.
const AIR = 'https://air-quality-api.open-meteo.com/v1/air-quality?latitude=37.55&longitude=126.99&current=pm2_5'
// The tower's four levels of fine dust in µg/m³ and their colours, as its operators list them.
const DUST: [max: number, color: THREE.Color][] = [
  [15, new THREE.Color('#3a7cff')],
  [35, new THREE.Color('#2fcf6a')],
  [75, new THREE.Color('#ffd43a')],
  [Infinity, new THREE.Color('#ff3b30')],
]
const dustColor = (pm: number) => DUST.find(([max]) => Math.round(pm) <= max)![1]
const FLOODLIT = new THREE.Color('#fff1d9')

/**
 * The Seoul Tower on Namsan: a slim white shaft, the drums of its observatory and a
 * tall mast. At night it is lit in the colour of the city's fine dust, as the real one is.
 */
function seoulTower(site: Site, x: number, z: number) {
  const y = site.height(x, z) - 0.02
  const put = placer(site.b, x, y, z)
  const light = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, emissive: 0x000000 })
  const lit: Put = (g, color, py) => site.b.add(light, paint(g, color, 0, 0.25), x, y + py, z)
  put(new THREE.CylinderGeometry(0.12, 0.14, 0.09, 8), '#d8d4cb', 0.045, 0.3)
  lit(new THREE.CylinderGeometry(0.03, 0.048, 0.9, 12), '#efede8', 0.54)
  lit(new THREE.CylinderGeometry(0.075, 0.045, 0.05, 20), '#efede8', 1.015)
  put(new THREE.CylinderGeometry(0.085, 0.085, 0.07, 20), '#5f6f7c', 1.075, 0)
  lit(new THREE.CylinderGeometry(0.075, 0.085, 0.05, 20), '#efede8', 1.135)
  lit(new THREE.CylinderGeometry(0.045, 0.065, 0.04, 16), '#efede8', 1.18)
  put(new THREE.CylinderGeometry(0.006, 0.014, 0.42, 6), '#e9e7e2', 1.41, 0)
  site.reserve(x, z, 0.2)
  let pm: number | undefined
  let asked = -Infinity
  site.animate((t, _wind, m) => {
    // Ask again every half hour while the island is on screen.
    if (t - asked > 1800) {
      asked = t
      fetch(AIR)
        .then((res) => res.json())
        .then((d) => {
          const v = d?.current?.pm2_5
          if (typeof v === 'number' && Number.isFinite(v)) pm = v
        })
        .catch(() => {})
    }
    if (pm === undefined) light.emissive.copy(FLOODLIT).multiplyScalar(m.night * 0.5)
    else light.emissive.copy(dustColor(pm)).multiplyScalar(m.night * 1.3)
  })
}

/** Turns a round lathe into a square with rounded corners in plan. */
function squarer(g: THREE.BufferGeometry) {
  const pos = g.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const a = Math.atan2(pos.getZ(i), pos.getX(i))
    const k = (Math.abs(Math.cos(a)) ** 4 + Math.abs(Math.sin(a)) ** 4) ** -0.25
    pos.setXYZ(i, pos.getX(i) * k, pos.getY(i), pos.getZ(i) * k)
  }
  g.computeVertexNormals()
  return g
}

/** Lotte World Tower: slender glass, tapering in a gentle curve to a lantern lit after dark. */
function lotteTower(site: Site, x: number, z: number) {
  const height = 2.55
  const radius = (u: number) => 0.17 * (1 - 0.7 * u ** 1.5)
  const body = squarer(new THREE.LatheGeometry(Array.from({ length: 21 }, (_, i) => new THREE.Vector2(radius(i / 20), (height * i) / 20)), 32))
  const y = GROUND - 0.03
  site.b.add(materials.landmark, paint(body, '#dfe6ea', 0.25, 0.4), x, y, z, 0.6)
  const lantern = squarer(new THREE.CylinderGeometry(radius(1) * 0.55, radius(1), 0.22, 32, 1, true))
  site.b.add(materials.lamps, paint(lantern, '#eef2f4', 0), x, y + height + 0.11, z, 0.6)
  site.reserve(x, z, 0.3)
}

/** Yeouido from its west tip (u = -1) to its east tip (u = 1): the middle of the island there, and half its width. */
const yeouidoAt = (u: number) => {
  const z = YEOUIDO.z + (u * YEOUIDO.length) / 2
  return { x: centre(z) + YEOUIDO.shift, z, across: (YEOUIDO.width / 2) * Math.sqrt(Math.max(0, 1 - u * u)) * (1 + 0.2 * u) }
}

/**
 * Yeouido: the National Assembly's green dome at the west end, office towers and the
 * gold 63 Building at the east end, and trees between.
 */
function yeouido(site: Site) {
  const top = GROUND - 0.05
  // Round the shore from the west tip, along the north side and back along the south.
  const outline = Array.from({ length: 64 }, (_, i) => {
    const a = (i / 64) * TAU
    const { x, z, across } = yeouidoAt(-Math.cos(a))
    return new THREE.Vector2(x + across * Math.sign(Math.sin(a)), -z)
  })
  site.b.add(materials.clay, grassAndStone(slab(new THREE.Shape(outline), BASE, top, 0.02), '#8fae6a'))
  const y = top - 0.02
  const taken: [number, number, number][] = []

  const assembly = yeouidoAt(-0.55)
  const hall = placer(site.b, assembly.x, y, assembly.z)
  hall(new RoundedBoxGeometry(0.3, 0.1, 0.36, 2, 0.015), '#ebe7de', 0.05, 0.25)
  hall(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 24), '#e2ddd2', 0.115, 0)
  hall(new THREE.SphereGeometry(0.1, 24, 8, 0, TAU, 0, Math.PI / 2), '#7f9e8c', 0.13, 0)
  taken.push([assembly.x, assembly.z, 0.28])

  const r = random(251)
  for (const [u, off, w, floors, wall] of [[0.12, 0.12, 0.2, 5, '#aebdca'], [0.3, 0.14, 0.18, 6, '#c3ccd4'], [0.24, -0.12, 0.2, 4, '#9fb0bf']] as const) {
    const p = yeouidoAt(u)
    house(site.b, p.x + off, y, p.z, 0, w, w, floors, wall, null, r)
    taken.push([p.x + off, p.z, 0.2])
  }

  // The 63 Building: gold glass, its sides curving in towards the top.
  const gold = yeouidoAt(0.7)
  const face = new THREE.Shape()
  face.moveTo(-0.16, 0)
  face.lineTo(0.16, 0)
  face.lineTo(0.15, 0.8)
  face.quadraticCurveTo(0.14, 1.12, 0.07, 1.2)
  face.lineTo(-0.07, 1.2)
  face.quadraticCurveTo(-0.14, 1.12, -0.15, 0.8)
  face.closePath()
  const tower = new THREE.ExtrudeGeometry(face, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 6 })
  tower.translate(0, 0, -0.05)
  placer(site.b, gold.x - 0.12, y, gold.z, Math.PI / 2)(tower, '#d9a63e', 0, 0.1)
  taken.push([gold.x - 0.12, gold.z, 0.22])

  for (let i = 0; i < 90 && taken.length < 30; i++) {
    const { x, z, across } = yeouidoAt(-0.9 + r() * 1.8)
    const tx = x + (r() * 2 - 1) * (across - 0.12)
    if (across < 0.15 || taken.some(([px, pz, pr]) => Math.hypot(tx - px, z - pz) < pr + 0.1)) continue
    taken.push([tx, z, 0.06])
    tree(site.b, tx, y, z, 0.5 + r() * 0.2, GREENS[i % 3])
  }
}

/**
 * A palace roof of dark tiles: hipped, its ridge running `length` along z, its slopes
 * sweeping down and out to eaves that turn up. It stands on y = 0, `depth` deep along x.
 */
function palaceRoof(length: number, height: number, depth: number) {
  const profile = [[0, 0.05], [0.8, 0.13], [0.65, 0.17], [0.5, 0.33], [0.33, 0.6], [0.17, 0.85], [0.001, 1]]
  const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 4).toNonIndexed()
  g.rotateY(Math.PI / 4)
  g.scale(depth, height, depth)
  const pos = g.attributes.position
  for (let i = 0; i < pos.count; i++) pos.setZ(i, pos.getZ(i) + (Math.sign(pos.getZ(i)) * (length - depth)) / 2)
  g.computeVertexNormals()
  return g
}

/**
 * Gyeongbokgung below the mountains: Gwanghwamun in the south wall with its square in
 * front, the throne hall on its stone terraces behind it, and the courtyard walls.
 */
function palace(site: Site) {
  const S = 1.3
  // Parts are laid out round the palace's centre at 1/S and scaled up together.
  const at = (dx: number, dz: number, rot = 0): Put => {
    const put = placer(site.b, PALACE.x + dx * S, GROUND - 0.02, PALACE.z + dz * S, rot)
    return (g, color, py, ao) => put(g.scale(S, S, S), color, py * S, ao)
  }
  at(0, 0)(new RoundedBoxGeometry(0.95, 0.03, 0.75, 1, 0.01), '#d8d0c2', 0.005, 0)
  at(-0.9, 0)(new RoundedBoxGeometry(0.8, 0.03, 0.24, 1, 0.01), '#d8d0c2', 0.005, 0)
  // Ochre walls under tiled copings, with a gap for the gate.
  for (const [x0, z0, x1, z1] of [[-0.5, -0.4, 0.5, -0.4], [-0.5, 0.4, 0.5, 0.4], [0.5, -0.4, 0.5, 0.4], [-0.5, -0.4, -0.5, -0.16], [-0.5, 0.16, -0.5, 0.4]]) {
    const along = Math.hypot(x1 - x0, z1 - z0)
    const wall = at((x0 + x1) / 2, (z0 + z1) / 2, Math.atan2(-(z1 - z0), x1 - x0))
    wall(new RoundedBoxGeometry(along + 0.035, 0.07, 0.035, 1, 0.008), '#c08d6a', 0.035, 0.2)
    wall(new RoundedBoxGeometry(along + 0.055, 0.02, 0.055, 1, 0.008), TILE, 0.075, 0)
  }
  // Gwanghwamun: three arches through a stone base, a two-storey gatehouse above.
  const gate = at(-0.5, 0)
  gate(new RoundedBoxGeometry(0.13, 0.11, 0.34, 1, 0.01), '#cfc7b8', 0.055, 0.2)
  for (const dz of [-0.1, 0, 0.1]) at(-0.566, dz)(new RoundedBoxGeometry(0.012, 0.065, 0.055, 1, 0.004), '#3b3632', 0.035, 0)
  gate(new RoundedBoxGeometry(0.09, 0.05, 0.24, 1, 0.006), TIMBER, 0.135, 0)
  gate(palaceRoof(0.34, 0.06, 0.16), TILE, 0.15, 0)
  gate(new RoundedBoxGeometry(0.06, 0.035, 0.16, 1, 0.006), TIMBER, 0.19, 0)
  gate(palaceRoof(0.26, 0.07, 0.12), TILE, 0.205, 0)
  // Geunjeongjeon, the throne hall, on two terraces.
  const hall = at(0.08, 0)
  hall(new RoundedBoxGeometry(0.46, 0.035, 0.56, 1, 0.008), '#d9d3c7', 0.0175, 0.2)
  hall(new RoundedBoxGeometry(0.38, 0.035, 0.46, 1, 0.008), '#d9d3c7', 0.0525, 0)
  hall(new RoundedBoxGeometry(0.2, 0.11, 0.32, 1, 0.01), TIMBER, 0.125, 0.1)
  hall(palaceRoof(0.46, 0.08, 0.3), TILE, 0.17, 0)
  hall(new RoundedBoxGeometry(0.15, 0.05, 0.26, 1, 0.008), TIMBER, 0.24, 0)
  hall(palaceRoof(0.4, 0.11, 0.24), TILE, 0.255, 0)
  blockBox(site, PALACE.x, PALACE.z, 1.1 * S, 0.9 * S)
  blockBox(site, PALACE.x - 0.9 * S, PALACE.z, 0.85 * S, 0.3 * S)
}

/** Bukhansan and the hills behind the palace, along the north edge: wooded slopes below bare granite peaks. */
function mountains(site: Site) {
  const peak = (u: number, at: number, w: number, h: number) => h * Math.exp(-(((u - at) / w) ** 2))
  const north = ridge({
    from: -1.15,
    to: 0.7,
    depth: 1.2,
    face: [0.08, 0.5],
    height: (u) =>
      (0.62 + peak(u, 0.2, 0.09, 0.15) + peak(u, 0.43, 0.08, 0.22) + peak(u, 0.68, 0.1, 0.6)) *
      THREE.MathUtils.smoothstep(u, 0, 0.1) *
      (1 - THREE.MathUtils.smoothstep(u, 0.88, 1)),
  })
  const g = north.geometry
  const pos = g.attributes.position
  const normal = g.attributes.normal
  const color = new Float32Array(pos.count * 3)
  const granite = new THREE.Color('#c4bdb1')
  const forest = new THREE.Color('#5c8048')
  const c = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    const bare = Math.max(1 - THREE.MathUtils.smoothstep(normal.getY(i), 0.3, 0.55), THREE.MathUtils.smoothstep(pos.getY(i), BASE + 1, BASE + 1.15))
    c.lerpColors(forest, granite, bare).toArray(color, i * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(color, 3))
  const mesh = new THREE.Mesh(g, materials.clay)
  mesh.castShadow = mesh.receiveShadow = true
  site.group.add(mesh)
  site.block((x, z, r) => north.covers(x, z, r + 0.1))
}

/** A riverside apartment complex: rows of tall white slabs running east to west, facing south. */
function apartments(site: Site, x: number, z: number, rows: number, cols: number, step: number, r: () => number) {
  const spots: [number, number][] = []
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) spots.push([x + i * step, z + j * 0.66])
  for (const [sx, sz] of spots.filter(([sx, sz]) => site.free(sx, sz, 0.3))) {
    house(site.b, sx, lowest(site.height, sx, sz, 0.13, 0.54) - 0.03, sz, 0, 0.13, 0.54, 3 + Math.floor(r() * 2), WHITES[Math.floor(r() * WHITES.length)], null, r)
    blockBox(site, sx, sz, 0.17, 0.58)
  }
}

// Show times from the 2026 season plan: 20 minutes from each start, from 15 March to
// the end of October, with a late show from June to September.
const showing = (m: Moment) => {
  if (m.month < 3 || m.month > 10 || (m.month === 3 && m.date < 15)) return false
  const starts = [720, 1170, 1200, 1230, 1260, ...(m.month >= 6 && m.month <= 9 ? [1290] : [])]
  const minutes = m.hour * 60
  return starts.some((s) => minutes >= s && minutes < s + 20)
}

/**
 * The Moonlight Rainbow Fountain along both sides of Banpo Bridge: jets arc out into
 * the river during each show, white by day and in rainbow colours after dark. Its
 * operators stop it when rain is due or the wind reaches 7 m/s.
 */
function rainbowFountain(site: Site, z: number) {
  const x0 = centre(z) - half(z) + 0.08
  const x1 = centre(z) + half(z) - 0.08
  const JETS = 26
  const DROPS = 9
  const HUES = 6
  const deck = GROUND + 0.01
  const bands = Array.from({ length: HUES }, (_, k) => {
    const xs: number[] = []
    for (let j = 0; j < JETS; j++) if (Math.floor((j * HUES) / JETS) === k) xs.push(x0 + ((x1 - x0) * (j + 0.5)) / JETS)
    const sprites = createSprites(xs.length * 2 * DROPS, { color: '#eef6fb', soft: 0.9 })
    site.group.add(sprites.points)
    return { sprites, xs, hue: k / HUES }
  })
  const white = new THREE.Color('#eef6fb')
  const hue = new THREE.Color()
  let flow = 0
  site.animate((t, wind, m) => {
    flow += ((showing(m) && m.rain < 0.05 && wind.length() < 7 ? 1 : 0) - flow) * 0.02
    for (const band of bands) {
      const s = band.sprites
      s.points.visible = flow > 0.01
      if (!s.points.visible) continue
      s.uniforms.uColor.value.lerpColors(white, hue.setHSL((band.hue + t * 0.04) % 1, 0.85, 0.6), m.night)
      let i = 0
      for (const x of band.xs) {
        const reach = 0.24 * flow * (0.8 + 0.2 * Math.sin(t * 1.5 - x * 5))
        for (const side of [-1, 1]) {
          for (let d = 0; d < DROPS; d++, i++) {
            const u = THREE.MathUtils.euclideanModulo(t * 0.8 + d / DROPS + x * 3.7, 1)
            s.position[i * 3] = x + wind.x * 0.006 * u * u
            s.position[i * 3 + 1] = deck + 0.05 * u - (0.05 + deck - WATER) * u * u
            s.position[i * 3 + 2] = z + side * (0.15 + reach * u) + wind.y * 0.006 * u * u
            s.alpha[i] = flow * (0.85 - 0.45 * u)
            s.size[i] = 0.035 + 0.035 * u
          }
        }
      }
      s.commit()
    }
  })
}

/** Some Sevit: three glass pavilions floating by the south bank below Banpo Bridge, lit in changing colours at night. */
function someSevit(site: Site) {
  for (const [dz, size] of [[-0.55, 1], [-0.85, 0.8], [-1.08, 0.65]]) {
    const z = BANPO_Z + dz
    const x = centre(z) - half(z) + 0.2
    site.b.add(materials.clay, paint(new THREE.CylinderGeometry(0.1 * size, 0.1 * size, 0.03, 20), '#cfd3d6', 0), x, WATER + 0.005, z)
    const glass = new THREE.SphereGeometry(0.085 * size, 16, 8, 0, TAU, 0, Math.PI / 2)
    glass.scale(1, 1.3, 1)
    site.b.add(materials.leds, paint(glass, '#e3eef3', 0), x, WATER + 0.02, z)
  }
}

export function buildSeoul() {
  // Downtown below Namsan stays lower than Gangnam, so the palace and the hill show over it.
  const busy = (x: number, z: number) => Math.max(0.65 * Math.exp(-((x - 3.2) ** 2 + (z + 0.2) ** 2) / 0.8), Math.exp(-((x + 3.2) ** 2 + (z - 1.4) ** 2) / 1.2))
  return buildIsland({
    seed: 211,
    heading: Math.PI / 2,
    centre,
    half,
    grass: '#9cb46f',
    water: '#4d8b96',
    hills: [NAMSAN],
    // Namsan's woods, and Seoul Forest on the north bank.
    parks: [
      { x: NAMSAN.x, z: NAMSAN.z, a: NAMSAN.a * 0.85, c: NAMSAN.c * 0.85, h: 0 },
      { x: 1.35, z: 3.2, a: 0.45, c: 0.55, h: 0 },
    ],
    houses: {
      count: 120,
      walls: ['#ecebe6', '#e2ddd2', '#d9cdb6', '#c9c8c3', '#b8705a', '#a95f4a', '#e6dccb', '#cfd3d6'],
      roofs: [TILE],
      pitched: 0.05,
      pitch: 0.8,
      width: [0.2, 0.36],
      floors: (r, x, z) => 1 + Math.floor(r() * (1.5 + 3 * busy(x, z))),
    },
    trees: { count: 30, park: 40, greens: GREENS, cypress: 0 },
    landmarks(site) {
      mountains(site)
      yeouido(site)
      seoulTower(site, NAMSAN.x, NAMSAN.z)
      palace(site)
      lotteTower(site, LOTTE.x, LOTTE.z)
      stoneBridge(site, BANPO_Z, '#cfcac0')
      rainbowFountain(site, BANPO_Z)
      stoneBridge(site, -1.3, '#cfcac0', 0.26)
      stoneBridge(site, 3, '#cfcac0', 0.26)
      someSevit(site)
      // Banpo Hangang Park: open lawns on the south bank in front of the fountain.
      site.block((x, z, r) => ((x + 1.3) / (0.55 + r)) ** 2 + ((z - 0.85) / (0.65 + r)) ** 2 < 1)
      const r = random(223)
      apartments(site, -1.25, -1.35, 2, 2, -0.34, r)
      apartments(site, -1.25, 1.8, 2, 2, -0.34, r)
      apartments(site, 1.3, -2.6, 2, 2, 0.34, r)
      apartments(site, 1.05, 1.4, 2, 2, 0.34, r)
      // A river cruise between Banpo Bridge and the next one east.
      boat(site, (s) => [centre(0.85 + 1.3 * s) + 0.25, 0.85 + 1.3 * s], 40, '#f2efe6', '#2f5a8a', 0.8)
    },
  })
}
