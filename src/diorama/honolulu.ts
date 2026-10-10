import * as THREE from 'three'
import { RoundedBoxGeometry } from './rounded-box'
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'
import { Batch, GROUND, house, materials, paint, random } from './kit'
import { TAU, WATER, beach, buildIsland, grassAndStone, hip, placer, plantPalm, type Site } from './island'
import { createSprites } from './sprites'

// The south shore of Oahu: Waikiki's beach and hotels along the ocean, the
// harbour and Aloha Tower to the west and Diamond Head on its headland to the east.
// The island is turned so the ocean, laid out along +x, lies to the south; its
// -z then points east.
const HEADING = -Math.PI / 2
const HEAD = -2.9
const shore = (z: number) => 1.9 + 0.2 * Math.sin(0.4 * z + 0.5) + 0.45 * Math.exp(-(((z - HEAD) / 0.9) ** 2))
// The ocean is a band of water reaching past the rim, which leaves land on one side only.
const OCEAN = 5
const centre = (z: number) => shore(z) + OCEAN
const half = () => OCEAN

const BEACH: [number, number] = [-1.3, 1.6]
const DIAMOND_HEAD = { x: shore(HEAD) - 1.35, z: HEAD }

/** Diamond Head: a tuff crater, ridged outside, its rim rising to the summit on the south-west (+x, +z here). */
function diamondHead(site: Site, x: number, z: number) {
  const profile = [[1.25, -0.06], [1.05, 0.2], [0.9, 0.46], [0.8, 0.52], [0.68, 0.4], [0.5, 0.26], [0.25, 0.22], [0, 0.22]]
  const lathe = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 72)
  lathe.deleteAttribute('normal')
  lathe.deleteAttribute('uv')
  const g = mergeVertices(lathe)
  const pos = g.attributes.position
  const summit = Math.atan2(1, 1)
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i)
    const pz = pos.getZ(i)
    const r = Math.hypot(px, pz)
    if (r < 1e-6) continue
    const a = Math.atan2(pz, px)
    const gullies = 1 + 0.05 * Math.sin(16 * a) * THREE.MathUtils.smoothstep(r, 0.82, 1.05)
    pos.setX(i, px * gullies)
    pos.setZ(i, pz * gullies)
    pos.setY(i, pos.getY(i) + 0.2 * Math.max(0, Math.cos(a - summit)) ** 2 * Math.exp(-(((r - 0.8) / 0.22) ** 2)))
  }
  g.computeVertexNormals()
  site.b.add(materials.clay, grassAndStone(g, '#a5a86a', '#9a8468'), x, GROUND, z)
  site.reserve(x, z, 1.3)
}

/** Aloha Tower on the harbour pier: a clock tower with a pyramid cap and a flagpole. */
function alohaTower(site: Site, x: number, z: number) {
  const put = placer(site.b, x, GROUND - 0.02, z)
  put(new RoundedBoxGeometry(0.26, 0.12, 0.26, 1, 0.015), '#e9e2d2', 0.06, 0.3)
  put(new RoundedBoxGeometry(0.17, 0.78, 0.17, 2, 0.012), '#f3eee3', 0.51, 0.25)
  for (let k = 0; k < 4; k++) {
    const face = new THREE.CylinderGeometry(0.045, 0.045, 0.01, 16)
    face.rotateX(Math.PI / 2)
    face.translate(0, 0, 0.087)
    face.rotateY((k * Math.PI) / 2)
    put(face, '#f7f3ea', 0.78, 0)
  }
  put(new RoundedBoxGeometry(0.2, 0.05, 0.2, 1, 0.01), '#e0d8c6', 0.92)
  put(hip(0.19, 0.2), '#7c8a6e', 0.945)
  put(new THREE.CylinderGeometry(0.004, 0.004, 0.18, 5), '#d9d9d9', 1.24, 0)
  site.reserve(x, z, 0.2)
}

/** A cruise ship moored along the pier. */
function cruiseShip(site: Site, x: number, z: number) {
  const put = placer(site.b, x, WATER, z, Math.PI / 2)
  put(new RoundedBoxGeometry(1.3, 0.06, 0.265, 2, 0.03), '#26364d', 0.01, 0)
  put(new RoundedBoxGeometry(1.3, 0.12, 0.26, 2, 0.05), '#f4f2ee', 0.08, 0.1)
  put(new RoundedBoxGeometry(1.08, 0.07, 0.22, 2, 0.02), '#f4f2ee', 0.17, 0.1)
  put(new RoundedBoxGeometry(0.88, 0.06, 0.2, 2, 0.02), '#e9eef2', 0.235, 0.1)
  put(new RoundedBoxGeometry(0.6, 0.05, 0.18, 2, 0.02), '#f4f2ee', 0.29, 0.1)
  const funnel = new RoundedBoxGeometry(0.1, 0.1, 0.08, 1, 0.02)
  funnel.translate(-0.3, 0, 0)
  put(funnel, '#2f5a8a', 0.36, 0)
}

/** The Royal Hawaiian, the pink hotel behind the beach. */
function royalHawaiian(site: Site, x: number, z: number) {
  const pink = '#f0a8b8'
  const r = random(19)
  house(site.b, x, GROUND - 0.03, z, Math.PI / 2, 0.7, 0.26, 2, pink, null, r)
  house(site.b, x, GROUND - 0.03, z, 0, 0.2, 0.2, 3, pink, '#d98a9a', r)
  site.reserve(x, z, 0.45)
}

/** Waves rolling in towards Waikiki, with surfers riding them by day. */
function surf(site: Site) {
  const rider = new Batch()
  rider.add(materials.clay, paint(new RoundedBoxGeometry(0.035, 0.012, 0.13, 1, 0.005), '#f2c14e', 0), 0, 0.006, 0)
  rider.add(materials.clay, paint(new THREE.CylinderGeometry(0.011, 0.013, 0.05, 6), '#7a5236', 0), 0, 0.037, 0)
  rider.add(materials.clay, paint(new THREE.SphereGeometry(0.012, 8, 6), '#7a5236', 0), 0, 0.072, 0)
  const surfer = rider.build(false)
  // A crest curving back towards the sea at its ends, with a wash of foam behind it.
  const arc = new THREE.CatmullRomCurve3(Array.from({ length: 9 }, (_, i) => {
    const u = i / 8 - 0.5
    return new THREE.Vector3(0.12 * (2 * u) ** 2, 0, 1.3 * u)
  }))
  const crestGeo = new THREE.TubeGeometry(arc, 32, 0.022, 6).scale(1, 0.6, 1)
  const washGeo = new THREE.PlaneGeometry(0.22, 1.1, 1, 8).rotateX(-Math.PI / 2).translate(0.13, -0.005, 0)
  // The wash fades out towards the sea and at both ends.
  const wp = washGeo.attributes.position
  washGeo.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: wp.count }, (_, i) => [0.91, 0.96, 0.96, (1 - (wp.getX(i) - 0.02) / 0.22) * (1 - (wp.getZ(i) / 0.55) ** 2)]).flat(), 4))
  const sets = [1.1, 0.1, -0.8].map((zc, i) => {
    const crest = new THREE.Mesh(crestGeo, new THREE.MeshStandardMaterial({ color: '#f4f8f8', roughness: 0.6, transparent: true }))
    const wash = new THREE.Mesh(washGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, transparent: true, depthWrite: false }))
    crest.add(wash)
    const board = surfer.clone()
    site.group.add(crest, board)
    return { zc, crest, wash, board, phase: i / 3 }
  })
  site.animate((t, wind, m) => {
    const swell = Math.min(2, 0.6 + wind.length() / 8)
    for (const s of sets) {
      const p = (t / 11 + s.phase) % 1
      const outer = shore(s.zc) + 1.5
      const inner = shore(s.zc) + 0.32
      const x = outer + (inner - outer) * p
      s.crest.position.set(x, WATER + 0.005, s.zc)
      s.crest.scale.set(1, swell, 1)
      s.crest.material.opacity = 0.85 * Math.sin(Math.PI * p)
      s.wash.material.opacity = 0.5 * Math.sin(Math.PI * p)
      s.board.visible = m.day > 0.3 && p > 0.15 && p < 0.85
      s.board.position.set(x + 0.05, WATER + 0.01 + 0.004 * Math.sin(t * 3), s.zc + (p - 0.5) * 0.8)
      s.board.rotation.y = 0.35
    }
  })
}

/** Tiki torches along the beach, lit at sunset until late evening. */
function torches(site: Site) {
  const flames: THREE.Vector3[] = []
  for (let z = BEACH[0] + 0.3; z < BEACH[1]; z += 0.32) {
    const x = shore(z) + 0.06
    site.b.add(materials.clay, paint(new THREE.CylinderGeometry(0.006, 0.008, 0.14, 5), '#5a4030', 0.1, 0.1), x, WATER + 0.035 + 0.07, z)
    flames.push(new THREE.Vector3(x, WATER + 0.035 + 0.15, z))
  }
  const s = createSprites(flames.length, { color: '#ffae4a', additive: true, soft: 0.8 })
  flames.forEach((f, i) => f.toArray(s.position, i * 3))
  site.group.add(s.points)
  let lit = 0
  site.animate((t, _wind, m) => {
    lit += ((m.night > 0.15 && m.hour >= 17 && m.hour < 23 && m.rain < 0.3 ? 1 : 0) - lit) * 0.02
    s.points.visible = lit > 0.01
    if (!s.points.visible) return
    flames.forEach((_, i) => {
      s.alpha[i] = lit * (0.75 + 0.25 * Math.sin(t * 11 + i * 1.7))
      s.size[i] = 0.07 + 0.015 * Math.sin(t * 7 + i)
    })
    s.commit()
  })
}

export function buildHonolulu() {
  const waikiki = (x: number, z: number) => Math.exp(-((x - shore(z) + 0.9) ** 2 / 0.8 + (z - 0.1) ** 2 / 3))
  return buildIsland({
    seed: 79,
    heading: HEADING,
    centre,
    half,
    grass: '#9fbe6a',
    water: '#2f95a8',
    // Kapiolani Park at the foot of Diamond Head.
    parks: [{ x: DIAMOND_HEAD.x - 1.9, z: HEAD + 0.3, a: 0.6, c: 0.7, h: 0 }],
    houses: {
      count: 140,
      walls: ['#f4f1ea', '#efe3cf', '#e7f0ee', '#f6e7c8', '#dfe9f0', '#f3d6c8'],
      roofs: ['#5e6b73', '#8a6f5e', '#b8603f'],
      pitched: 0.4,
      pitch: 0.7,
      width: [0.22, 0.4],
      floors: (r, x, z) => 1 + Math.floor(r() * (2 + 8 * waikiki(x, z))),
    },
    trees: { count: 12, park: 18, greens: ['#5f9048', '#6c9a4f', '#7aa35a'], cypress: 0 },
    landmarks(site) {
      diamondHead(site, DIAMOND_HEAD.x, DIAMOND_HEAD.z)
      beach(site, BEACH[0], BEACH[1])
      royalHawaiian(site, shore(-1) - 0.5, -1)
      alohaTower(site, shore(3) - 0.3, 3)
      cruiseShip(site, shore(3.2) + 0.36, 3.2)
      torches(site)
      surf(site)
      const r = random(83)
      for (let placed = 0, tries = 0; placed < 26 && tries < 300; tries++) {
        const x = (r() * 2 - 1) * 5
        const z = (r() * 2 - 1) * 5
        if (Math.hypot(x, z) > 5.2 || Math.abs(x - centre(z)) < half() + 0.3 || Math.hypot(x - DIAMOND_HEAD.x, z - DIAMOND_HEAD.z) < 1.4) continue
        if (plantPalm(site, x, z, 0.8 + r() * 0.4, r() * TAU)) placed++
      }
    },
  })
}
