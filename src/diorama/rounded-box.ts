import * as THREE from 'three'

// Per box side (right, left, top, bottom, front, back): the axis U runs along, whether U is flipped, the same for V.
const ROUNDED_SIDES = [
  [2, false, 1, true],
  [2, true, 1, true],
  [0, true, 2, false],
  [0, true, 2, true],
  [0, true, 1, true],
  [0, false, 1, true],
] as const

type RoundedTemplate = { sign: Int8Array; normal64: Float64Array; normal: Float32Array; arc: Float64Array; ahead: Uint8Array; groups: THREE.BufferGeometry['groups'] }
const roundedTemplates = new Map<number, RoundedTemplate>()

/** The size-independent part of a rounded box: three's construction run once on a unit box. */
function roundedTemplate(segments: number) {
  const cached = roundedTemplates.get(segments)
  if (cached) return cached
  const total = segments * 2 + 1
  const box = new THREE.BoxGeometry(1, 1, 1, total, total, total)
  const positions = box.toNonIndexed().attributes.position.array
  const count = positions.length / 3
  const t: RoundedTemplate = {
    sign: new Int8Array(count * 3),
    normal64: new Float64Array(count * 3),
    normal: new Float32Array(count * 3),
    arc: new Float64Array(count * 2),
    ahead: new Uint8Array(count * 2),
    groups: box.groups,
  }
  const half = 0.5 / total
  const p = new THREE.Vector3()
  const n = new THREE.Vector3()
  const flat = new THREE.Vector3()
  const dir = new THREE.Vector3()
  const axes = ['x', 'y', 'z'] as const
  for (let k = 0; k < count; k++) {
    p.fromArray(positions, k * 3)
    n.copy(p)
    n.x -= Math.sign(n.x) * half
    n.y -= Math.sign(n.y) * half
    n.z -= Math.sign(n.z) * half
    n.normalize()
    for (let a = 0; a < 3; a++) t.sign[k * 3 + a] = Math.sign(p.getComponent(a))
    n.toArray(t.normal64, k * 3)
    n.toArray(t.normal, k * 3)
    const side = Math.floor(k / (count / 6))
    const [uAxis, , vAxis] = ROUNDED_SIDES[side]
    const faceAxis = side >> 1
    dir.set(0, 0, 0).setComponent(faceAxis, side & 1 ? -1 : 1)
    for (const [c, uv, project] of [[0, uAxis, vAxis], [1, vAxis, uAxis]]) {
      flat.copy(n)
      flat[axes[project]] = 0
      flat.normalize()
      t.arc[k * 2 + c] = 1.0 - flat.angleTo(dir) / (Math.PI / 4)
      t.ahead[k * 2 + c] = Math.sign(flat[axes[uv]]) === 1 ? 1 : 0
    }
  }
  roundedTemplates.set(segments, t)
  return t
}

/**
 * three's RoundedBoxGeometry, same vertices, normals and UVs, built from a cached unit template.
 * three's own rebuilds a subdivided box and measures every UV angle again for each part,
 * which was most of an island's build time.
 */
export class RoundedBoxGeometry extends THREE.BufferGeometry {
  constructor(width = 1, height = 1, depth = 1, segments = 2, radius = 0.1) {
    super()
    radius = Math.min(width / 2, height / 2, depth / 2, radius)
    const t = roundedTemplate(segments)
    const count = t.normal.length / 3
    const size = [width, height, depth]
    const box = size.map((s) => s * 0.5 - radius)
    // getUv's per-side constants: the UV share of one arc and of the flat between the arcs.
    const arcLength = (2 * Math.PI * radius) / 4
    const centre = size.map((s) => Math.max(s - 2 * radius, 0))
    const arcUv = centre.map((c) => (0.5 * arcLength) / (arcLength + c))
    const lenUv = centre.map((c) => c / (arcLength + c))
    const position = new Float32Array(count * 3)
    const uv = new Float32Array(count * 2)
    for (let k = 0; k < count * 3; k++) position[k] = box[k % 3] * t.sign[k] + t.normal64[k] * radius
    for (let side = 0, per = count / 6; side < 6; side++) {
      const [uAxis, uFlip, vAxis, vFlip] = ROUNDED_SIDES[side]
      for (let k = side * per; k < (side + 1) * per; k++) {
        for (const [c, axis, flip] of [[0, uAxis, uFlip], [1, vAxis, vFlip]] as const) {
          const a = t.arc[k * 2 + c]
          const g = t.ahead[k * 2 + c] ? a * arcUv[axis] : lenUv[axis] + arcUv[axis] + arcUv[axis] * (1.0 - a)
          uv[k * 2 + c] = flip ? 1.0 - g : g
        }
      }
    }
    this.setAttribute('position', new THREE.BufferAttribute(position, 3))
    this.setAttribute('normal', new THREE.BufferAttribute(t.normal.slice(), 3))
    this.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
    for (const g of t.groups) this.addGroup(g.start, g.count, g.materialIndex)
  }
}
