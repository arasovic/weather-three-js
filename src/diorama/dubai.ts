import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { GROUND, house, materials, paint, palm, random } from './kit'
import { TAU, WATER, boat, buildIsland, islet, placer, type Moment, type Site } from './island'
import { createSprites } from './sprites'

// Dubai Creek winds through the old town, Bur Dubai on the west bank and Deira on
// the east, and opens into the Gulf at the north end.
const centre = (z: number) => 0.4 + 0.5 * Math.sin(0.4 * z + 0.2)
const half = (z: number) => 0.5 + 0.9 * THREE.MathUtils.smoothstep(-z, 2.4, 4.6)

const DOWNTOWN = { x: -2.3, z: 1.4 }
// The lake lies beside the tower, clear of its wings.
const LAKE = { x: DOWNTOWN.x + 1.25, z: DOWNTOWN.z + 0.3 }
const SAND = '#e6d6b4'
const FLOOR = 0.2

/**
 * The Burj Khalifa: three wings in a Y around a core, each stepping back in turn so
 * the setbacks spiral up the tower, then the core alone and the spire.
 */
function burjKhalifa(site: Site, x: number, z: number) {
  const r = random(113)
  let y = site.height(x, z) - 0.03
  for (let t = 0; t < 6; t++) {
    const floors = 2
    for (let k = 0; k < 3; k++) {
      const len = 0.62 - 0.07 * t - (t % 3 === k ? 0.05 : 0)
      const a = (k * TAU) / 3 + Math.PI / 2
      house(site.b, x + (Math.cos(a) * len) / 2, y, z - (Math.sin(a) * len) / 2, a, len, 0.15, floors, '#cfd6dc', null, r)
    }
    y += floors * FLOOR + 0.06 + 0.045
  }
  house(site.b, x, y, z, 0, 0.14, 0.14, 2, '#cfd6dc', null, r)
  y += 2 * FLOOR + 0.06 + 0.045
  const put = placer(site.b, x, y, z)
  put(new THREE.CylinderGeometry(0.012, 0.05, 0.6, 8), '#c9ced3', 0.3, 0)
  site.b.add(materials.leds, paint(new THREE.SphereGeometry(0.018, 8, 6), '#f2f4f6', 0), x, y + 0.62, z)
  site.reserve(x, z, 0.65)
}

/** The Dubai Fountain in the lake below the tower: jets dance for five minutes each show. */
function fountain(site: Site, x: number, z: number) {
  const lake = new THREE.Mesh(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2).scale(0.45, 1, 0.9), new THREE.MeshStandardMaterial({ color: '#3f8ea3', roughness: 0.15 }))
  lake.position.set(x, GROUND + 0.004, z)
  lake.receiveShadow = true
  site.group.add(lake)
  site.reserve(x, z, 0.8)
  const n = 26
  const jets = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.006, 0.014, 1, 6, 1, true).translate(0, 0.5, 0),
    new THREE.MeshBasicMaterial({ color: '#eaf6ff', transparent: true, opacity: 0.75, depthWrite: false, fog: false }),
    n,
  )
  jets.frustumCulled = false
  site.group.add(jets)
  const spray = createSprites(n, { color: '#eaf6ff', soft: 0.9 })
  site.group.add(spray.points)
  const m4 = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const p = new THREE.Vector3()
  const s = new THREE.Vector3()
  // Evening shows every half hour from six to eleven, and two in the early afternoon,
  // an hour later on Fridays.
  const showing = (m: Moment) => {
    const minutes = m.hour * 60
    const slot = Math.floor(minutes / 30) * 30
    const afternoon = m.weekday === 5 ? [840, 870] : [780, 810]
    return minutes - slot < 5 && ((slot >= 1080 && slot <= 1380) || afternoon.includes(slot))
  }
  site.animate((t, _wind, m) => {
    jets.visible = spray.points.visible = showing(m)
    if (!jets.visible) return
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1) - 0.5
      p.set(x + Math.sin(u * 2.4) * 0.3, GROUND + 0.004, z + Math.cos(u * 2.4) * 0.5 - 0.35)
      const h = 0.15 + 0.85 * Math.abs(Math.sin(t * 1.6 + u * 6)) ** 2
      jets.setMatrixAt(i, m4.compose(p, q, s.set(1, h, 1)))
      spray.position[i * 3] = p.x
      spray.position[i * 3 + 1] = p.y + h
      spray.position[i * 3 + 2] = p.z
      spray.alpha[i] = 0.8
      spray.size[i] = 0.08 + 0.06 * h
    }
    jets.instanceMatrix.needsUpdate = true
    spray.commit()
  })
}

/** The Burj Al Arab on its island at the creek's mouth: a white sail with its mast and helipad. */
function burjAlArab(site: Site, x: number, z: number) {
  const top = islet(site, x, z, 0.5, 0.5)
  const put = placer(site.b, x, top, z, -0.5)
  const sail = new THREE.Shape()
  sail.moveTo(0, 0)
  sail.lineTo(0.34, 0)
  sail.quadraticCurveTo(0.34, 0.9, 0, 1.55)
  sail.lineTo(0, 0)
  const body = new THREE.ExtrudeGeometry(sail, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2 })
  body.translate(-0.12, 0, -0.1)
  // Lit in changing colours at night.
  site.b.add(materials.leds, paint(body, '#f3f1ec', 0.2, 0.25), x, top, z, -0.5)
  const mast = new THREE.CylinderGeometry(0.018, 0.024, 1.8, 8)
  mast.translate(-0.15, 0, 0)
  put(mast, '#dfe3e6', 0.9, 0)
  const helipad = new THREE.CylinderGeometry(0.09, 0.09, 0.015, 20)
  helipad.translate(0.2, 0, 0)
  put(helipad, '#e9ecef', 1.05, 0)
  site.reserve(x, z, 0.35)
}

/** The Museum of the Future: a silver ring standing on a green mound. */
function museumOfTheFuture(site: Site, x: number, z: number) {
  const put = placer(site.b, x, site.height(x, z) - 0.02, z, 0.6)
  put(new THREE.SphereGeometry(0.34, 20, 6, 0, TAU, 0, Math.PI / 2).scale(1, 0.35, 0.6), '#8fae66', 0, 0)
  const ring = new THREE.TorusGeometry(0.3, 0.11, 14, 40)
  ring.scale(1, 0.8, 0.9)
  put(ring, '#c9cdd2', 0.33, 0.1)
  site.reserve(x, z, 0.4)
}

/** Al Fahidi: low sand-coloured courtyard houses by the creek, each with a wind tower. */
function alFahidi(site: Site, cx: number, cz: number) {
  const r = random(127)
  const placed: [number, number][] = []
  for (let tries = 0; tries < 200 && placed.length < 12; tries++) {
    const x = cx + (r() - 0.5) * 1.1
    const z = cz + (r() - 0.5) * 1.3
    if (Math.abs(x - centre(z)) < half(z) + 0.3 || placed.some(([px, pz]) => Math.hypot(x - px, z - pz) < 0.3)) continue
    placed.push([x, z])
    const floors = 1 + Math.floor(r() * 2)
    house(site.b, x, GROUND - 0.03, z, 0, 0.26, 0.22, floors, '#dcc8a0', null, r)
    const tower = placer(site.b, x + 0.07, GROUND - 0.03 + floors * FLOOR + 0.06, z - 0.05)
    tower(new RoundedBoxGeometry(0.07, 0.14, 0.07, 1, 0.008), '#d6c196', 0.07, 0.1)
    tower(new RoundedBoxGeometry(0.08, 0.015, 0.08, 1, 0.004), '#c9b489', 0.145, 0)
    site.reserve(x, z, 0.18)
  }
}

/** Wooden dhows moored along the Deira quay. */
function dhows(site: Site) {
  for (const [z, lean] of [[-1.3, 0.1], [-0.6, -0.05], [0.1, 0.08]]) {
    const x = centre(z) + half(z) - 0.12
    const put = placer(site.b, x, WATER - 0.02, z, Math.PI / 2 + lean)
    put(new RoundedBoxGeometry(0.42, 0.07, 0.13, 2, 0.03), '#8a5a3a', 0.035, 0.1)
    put(new RoundedBoxGeometry(0.3, 0.04, 0.11, 1, 0.01), '#b98a5c', 0.08, 0)
    put(new THREE.CylinderGeometry(0.005, 0.007, 0.3, 5), '#5a3e2b', 0.25, 0)
  }
}

/** Sand blown off the desert on windy, dry days, drifting low over the town. */
function dust(site: Site) {
  const n = 110
  const s = createSprites(n, { color: '#d9c29a', soft: 1 })
  const r = random(131)
  const home = Array.from({ length: n }, () => [(r() * 2 - 1) * 6, 0.4 + r() * 1.4, (r() * 2 - 1) * 6, r() * 100])
  site.group.add(s.points)
  let shown = 0
  site.animate((t, wind, m) => {
    shown += ((wind.length() > 8 && m.rain < 0.05 ? 1 : 0) - shown) * 0.01
    s.points.visible = shown > 0.01
    if (!s.points.visible) return
    home.forEach(([x, y, z, seed], i) => {
      const px = ((x + wind.x * t * 0.05 + 6) % 12 + 12) % 12 - 6
      const pz = ((z + wind.y * t * 0.05 + 6) % 12 + 12) % 12 - 6
      s.position[i * 3] = px
      s.position[i * 3 + 1] = y + 0.1 * Math.sin(t * 0.5 + seed)
      s.position[i * 3 + 2] = pz
      s.alpha[i] = shown * 0.35 * THREE.MathUtils.smoothstep(5.8 - Math.hypot(px, pz), 0, 1)
      s.size[i] = 0.9 + (seed % 1) * 0.6
    })
    s.commit()
  })
}

export function buildDubai() {
  const tall = (x: number, z: number) => Math.exp(-((x - DOWNTOWN.x) ** 2 / 1.2 + (z - DOWNTOWN.z) ** 2 / 3))
  return buildIsland({
    seed: 137,
    centre,
    half,
    grass: '#d4c69a',
    water: '#3f9aa5',
    parks: [{ x: LAKE.x, z: LAKE.z, a: 0.6, c: 1, h: 0 }],
    houses: {
      count: 130,
      walls: ['#efe6d4', SAND, '#f3efe6', '#d9dde0', '#c9d3da', '#e9dcc0'],
      roofs: ['#b8a07a'],
      pitched: 0,
      width: [0.24, 0.42],
      floors: (r, x, z) => 1 + Math.floor(r() * (2 + 7 * tall(x, z))),
    },
    trees: { count: 0, park: 0, greens: ['#6c9a4f'], cypress: 0 },
    landmarks(site) {
      burjKhalifa(site, DOWNTOWN.x, DOWNTOWN.z)
      fountain(site, LAKE.x, LAKE.z)
      burjAlArab(site, centre(-4) + 0.5, -4)
      museumOfTheFuture(site, 2.9, 1.6)
      alFahidi(site, centre(-1) - half(-1) - 0.75, -1)
      dhows(site)
      for (const [z, period] of [[-1.8, 18], [-0.2, 22], [0.9, 16]]) {
        const from = centre(z) - half(z) + 0.15
        const to = centre(z) + half(z) - 0.15
        boat(site, (s) => [from + (to - from) * s, z], period, '#7a4a2e', '#d9b77a', 0.55)
      }
      dust(site)
      const r = random(139)
      for (let placed = 0, tries = 0; placed < 40 && tries < 400; tries++) {
        const x = (r() * 2 - 1) * 5
        const z = (r() * 2 - 1) * 5
        const shore = Math.abs(x - centre(z)) - half(z)
        if (Math.hypot(x, z) > 5.2 || shore < 0.25 || (shore > 0.55 && r() < 0.7)) continue
        palm(site.b, x, GROUND - 0.02, z, 0.8 + r() * 0.35, r() * TAU)
        site.reserve(x, z, 0.08)
        placed++
      }
    },
  })
}
