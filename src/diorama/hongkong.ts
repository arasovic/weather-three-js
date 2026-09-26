import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { Batch, GROUND, house, materials, paint, random } from './kit'
import { TAU, WATER, boat, buildIsland, placer, strut, type Site } from './island'

// Victoria Harbour, with Hong Kong Island and the Peak on the west bank and
// Kowloon on the east.
const centre = (z: number) => 0.3 + 0.3 * Math.sin(0.4 * z + 0.5)
const half = (z: number) => 0.95 + 0.12 * Math.sin(0.7 * z - 0.4)

// The Peak stands above even the tallest towers, wooded down to the Mid-Levels.
const FOREST = { grass: '#8fae66', rough: 0.25 }
const PEAK = { x: -3.7, z: 0.2, a: 1.5, c: 2, h: 1.5, ...FOREST }
const SHOULDER = { x: -3.9, z: -1.8, a: 1.1, c: 1, h: 0.9, ...FOREST }
const FLOOR = 0.2

/** Two IFC: setbacks near the top and a crown of fins that change colour at night. Returns the top. */
function ifc(site: Site, x: number, z: number) {
  const r = random(8)
  let y = site.height(x, z) - 0.03
  for (const [w, floors] of [[0.36, 12], [0.31, 1], [0.27, 1]]) {
    house(site.b, x, y, z, 0, w, w, floors, '#c3ccd4', null, r)
    y += floors * FLOOR + 0.06 + 0.045
  }
  for (let k = 0; k < 8; k++) {
    const h = k % 2 ? 0.2 : 0.3
    const fin = new RoundedBoxGeometry(0.03, h, 0.07, 1, 0.01)
    fin.translate(0, h / 2, 0.11)
    site.b.add(materials.leds, paint(fin, '#e9edf0', 0), x, y, z, (k / 8) * TAU)
  }
  return new THREE.Vector3(x, y + 0.3, z)
}

/** The International Commerce Centre, the tallest tower, with a lit crown. Returns the top. */
function icc(site: Site, x: number, z: number) {
  const y = site.height(x, z) - 0.03 + 14 * FLOOR + 0.06
  house(site.b, x, y - 14 * FLOOR - 0.06, z, 0.2, 0.4, 0.4, 14, '#aebccb', null, random(14))
  site.b.add(materials.leds, paint(new RoundedBoxGeometry(0.43, 0.16, 0.43, 2, 0.05), '#dfe6ec', 0), x, y + 0.1, z, 0.2)
  return new THREE.Vector3(x, y + 0.18, z)
}

/**
 * One of the Bank of China Tower's four shafts: a triangle from the centre to
 * two corners, rising to `h` with its top sloping up towards the centre.
 */
function shaft(a: THREE.Vector2, b: THREE.Vector2, h: number, rise: number) {
  // Shapes live in the (x, -z) plane and are extruded upwards.
  const g = new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(a.x, -a.y), new THREE.Vector2(b.x, -b.y)]), { depth: h, bevelEnabled: false })
  g.rotateX(-Math.PI / 2)
  const pos = g.attributes.position
  for (let i = 0; i < pos.count; i++) {
    if (Math.abs(pos.getX(i)) < 1e-6 && Math.abs(pos.getZ(i)) < 1e-6 && pos.getY(i) > h - 1e-6) pos.setY(i, h + rise)
  }
  g.computeVertexNormals()
  return g
}

/** The Bank of China Tower: four glass shafts ending at different heights, braced in white. Returns the top. */
function bankOfChina(site: Site, x: number, z: number) {
  const put = placer(site.b, x, site.height(x, z) - 0.02, z, 0.3)
  const s = 0.21
  const corners = [[s, -s], [s, s], [-s, s], [-s, -s]].map(([cx, cz]) => new THREE.Vector2(cx, cz))
  const heights = [2.45, 1.95, 1.45, 0.95]
  const rise = 0.3
  corners.forEach((a, k) => {
    const b = corners[(k + 1) % 4]
    const h = heights[k]
    put(shaft(a, b, h, rise), '#7f92a6', 0, 0.25)
    // X-bracing on the outer face, one cross per square module.
    const out = a.clone().add(b).normalize().multiplyScalar(0.006)
    const at = (p: THREE.Vector2, y: number) => new THREE.Vector3(p.x + out.x, y, p.y + out.y)
    for (let y = 0; y + 2 * s <= h + 1e-6; y += 2 * s) {
      put(strut(at(a, y), at(b, y + 2 * s), 0.008, 0.008, 4), '#eef0f2', 0, 0)
      put(strut(at(b, y), at(a, y + 2 * s), 0.008, 0.008, 4), '#eef0f2', 0, 0)
    }
  })
  for (const m of [-1, 1]) {
    const mast = new THREE.CylinderGeometry(0.005, 0.01, 0.4, 5)
    mast.translate(m * 0.03, 0, 0)
    put(mast, '#d9dde0', heights[0] + rise + 0.18, 0)
  }
  return new THREE.Vector3(x, site.height(x, z) + heights[0] + rise, z)
}

/** The Peak Tower, a wok-shaped lookout on the ridge. */
function peakTower(site: Site, x: number, z: number) {
  const put = placer(site.b, x, site.height(x, z) - 0.03, z)
  put(new RoundedBoxGeometry(0.2, 0.14, 0.2, 2, 0.02), '#d8d2c6', 0.07, 0.3)
  put(new THREE.CylinderGeometry(0.3, 0.13, 0.12, 24), '#bdb8ae', 0.2, 0.1)
}

/** The old railway clock tower on the Tsim Sha Tsui waterfront. */
function clockTower(site: Site, x: number, z: number) {
  const put = placer(site.b, x, GROUND - 0.02, z)
  const cream = '#efe6d4'
  put(new RoundedBoxGeometry(0.13, 0.62, 0.13, 2, 0.012), '#c07a5c', 0.31, 0.3)
  for (const y of [0.2, 0.42]) put(new RoundedBoxGeometry(0.14, 0.02, 0.14, 1, 0.005), cream, y, 0)
  put(new RoundedBoxGeometry(0.12, 0.12, 0.12, 1, 0.01), cream, 0.68)
  for (let k = 0; k < 4; k++) {
    const face = new THREE.CylinderGeometry(0.035, 0.035, 0.01, 16)
    face.rotateX(Math.PI / 2)
    face.translate(0, 0, 0.062)
    face.rotateY((k * Math.PI) / 2)
    put(face, '#f6f1e4', 0.68, 0)
  }
  put(new THREE.CylinderGeometry(0.045, 0.05, 0.06, 12), cream, 0.77)
  put(new THREE.SphereGeometry(0.047, 12, 6, 0, TAU, 0, Math.PI / 2), '#8a9aa6', 0.8)
  put(new THREE.CylinderGeometry(0.004, 0.006, 0.12, 5), '#6d6f72', 0.9)
  site.reserve(x, z, 0.14)
}

/** A junk under red battened sails, cruising the harbour. */
function junk(site: Site, path: (s: number) => [number, number]) {
  const hull = boat(site, path, 70, '#5d3f2c', '#8a6448', 0.8)
  const rig = new Batch()
  for (const [lx, h] of [[0.08, 0.34], [-0.1, 0.26]]) {
    const sail = new THREE.Shape([new THREE.Vector2(-0.09, 0), new THREE.Vector2(0.06, 0), new THREE.Vector2(0.09, h), new THREE.Vector2(-0.03, h + 0.04)])
    const g = new THREE.ExtrudeGeometry(sail, { depth: 0.008, bevelEnabled: false })
    g.translate(lx, 0.15, -0.004)
    rig.add(materials.clay, paint(g, '#b8432d', 0), 0, 0, 0)
    rig.add(materials.clay, paint(new THREE.CylinderGeometry(0.005, 0.006, h + 0.08, 5), '#4a3526', 0), lx + 0.07, 0.12 + (h + 0.08) / 2, 0)
  }
  hull.add(rig.build())
}

/** A Symphony of Lights: for ten minutes from eight each night, lasers sweep from the rooftops. */
function lightShow(site: Site, tops: THREE.Vector3[]) {
  const beam = new THREE.CylinderGeometry(0.006, 0.02, 5, 5, 1, true)
  beam.translate(0, 2.5, 0)
  const n = tops.length * 2
  const material = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })
  const lasers = new THREE.InstancedMesh(beam, material, n)
  lasers.frustumCulled = false
  lasers.visible = false
  const c = new THREE.Color()
  for (let i = 0; i < n; i++) lasers.setColorAt(i, c.setHSL(i / n, 0.9, 0.6))
  site.group.add(lasers)
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const e = new THREE.Euler()
  const one = new THREE.Vector3(1, 1, 1)
  site.animate((t, _wind, moment) => {
    lasers.visible = moment.night > 0.5 && moment.hour >= 20 && moment.hour < 20 + 10 / 60
    if (!lasers.visible) return
    for (let i = 0; i < n; i++) {
      e.set(0.3 + 0.25 * Math.sin(t * 0.7 + i), (i % 2 ? 1 : -1) * t * 0.5 + i * 1.3, 0, 'YXZ')
      lasers.setMatrixAt(i, m.compose(tops[i >> 1], q.setFromEuler(e), one))
      lasers.setColorAt(i, c.setHSL((t * 0.05 + i / n) % 1, 0.9, 0.6))
    }
    lasers.instanceMatrix.needsUpdate = true
    lasers.instanceColor!.needsUpdate = true
  })
}

export function buildHongKong() {
  // Towers rise tallest along the island's harbour front; Kowloon, long under the
  // old airport's flight path, stays lower.
  const front = (x: number, z: number) => Math.exp(-((Math.abs(x - centre(z)) - half(z)) ** 2) / 2)
  const ferryZ = 0.4
  return buildIsland({
    seed: 27,
    centre,
    half,
    water: '#3f7f95',
    hills: [PEAK, SHOULDER],
    parks: [
      { x: PEAK.x, z: PEAK.z, a: 1.25, c: 1.7, h: 0 },
      { x: SHOULDER.x, z: SHOULDER.z, a: 0.85, c: 0.75, h: 0 },
    ],
    houses: {
      count: 170,
      walls: ['#e9e6df', '#d5d9dc', '#c4ccd3', '#e6d9c6', '#b8c3cc', '#dcd2c8', '#a9b6c1', '#efe9dc'],
      roofs: ['#6b6f75'],
      pitched: 0.03,
      width: [0.22, 0.36],
      floors: (r, x, z) => 2 + Math.floor(r() * (x < centre(z) ? 2 + 7 * front(x, z) : 3.5)),
    },
    trees: { count: 20, park: 48, greens: ['#5f9048', '#6c9a4f', '#4f7f3f'], cypress: 0 },
    landmarks(site) {
      const tops = [ifc(site, centre(-0.8) - half(-0.8) - 0.45, -0.8), bankOfChina(site, -1.6, 0.7), icc(site, 1.65, -2.4)]
      site.reserve(tops[0].x, tops[0].z, 0.3)
      site.reserve(-1.6, 0.7, 0.34)
      site.reserve(1.65, -2.4, 0.34)
      peakTower(site, PEAK.x + 0.45, PEAK.z - 0.2)
      site.reserve(PEAK.x + 0.45, PEAK.z - 0.2, 0.36)
      clockTower(site, centre(1.3) + half(1.3) + 0.25, 1.3)
      lightShow(site, tops)
      for (const side of [-1, 1]) {
        const x = centre(ferryZ) + side * (half(ferryZ) - 0.1)
        site.b.add(materials.clay, paint(new RoundedBoxGeometry(0.34, 0.05, 0.14, 1, 0.01), '#8a6f55', 0), x, WATER + 0.03, ferryZ)
        site.reserve(x + side * 0.1, ferryZ, 0.35)
      }
      const from = centre(ferryZ) - half(ferryZ) + 0.32
      const to = centre(ferryZ) + half(ferryZ) - 0.32
      boat(site, (s) => [from + (to - from) * s, ferryZ], 30, '#2f6b4f', '#f2efe6')
      junk(site, (s) => {
        const z = -3.2 + 2.8 * s
        return [centre(z) + 0.3, z]
      })
    },
  })
}
