import * as THREE from 'three'

type Part = { geo: THREE.BufferGeometry; x: number; y: number; z: number; c: number; s: number }

/** Collects static parts per material and merges them into one mesh each. */
export class Batch {
  private parts = new Map<THREE.Material, Part[]>()

  add(material: THREE.Material, geo: THREE.BufferGeometry, x = 0, y = 0, z = 0, rotY = 0) {
    if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2))
    const list = this.parts.get(material) ?? []
    list.push({ geo, x, y, z, c: Math.cos(rotY), s: Math.sin(rotY) })
    this.parts.set(material, list)
  }

  build(shadows = true) {
    const steps = this.building(shadows)
    for (;;) {
      const step = steps.next()
      if (step.done) return step.value
    }
  }

  /** The same as build, a part at a time, for a build spread over frames. */
  *building(shadows = true) {
    const group = new THREE.Group()
    for (const [material, list] of this.parts) {
      const mesh = new THREE.Mesh(yield* merge(list), material)
      mesh.castShadow = shadows
      mesh.receiveShadow = true
      group.add(mesh)
    }
    return group
  }
}

/**
 * Writes every part, turned about Y and moved, straight into one unindexed geometry. Moving each part
 * with applyMatrix4 and then mergeGeometries went over every array twice and copied indexed parts once
 * more; the values are the same. Normals are rescaled to unit length as applyMatrix4 does, since some
 * parts arrive with longer ones.
 */
function* merge(parts: Part[]) {
  let count = 0
  for (const { geo } of parts) count += geo.index ? geo.index.count : geo.attributes.position.count
  const attributes = Object.entries(parts[0].geo.attributes).map(([name, first]) => ({
    name,
    size: first.itemSize,
    normalized: first.normalized,
    out: new (first.array.constructor as Float32ArrayConstructor)(count * first.itemSize),
  }))
  let start = 0
  for (const { geo, x, y, z, c, s } of parts) {
    const index = geo.index?.array
    const n = index ? index.length : geo.attributes.position.count
    for (const { name, size, out } of attributes) {
      const a = geo.attributes[name].array
      let o = start * size
      if (name === 'position') {
        for (let v = 0; v < n; v++, o += 3) {
          const j = (index ? index[v] : v) * 3
          out[o] = c * a[j] + s * a[j + 2] + x
          out[o + 1] = a[j + 1] + y
          out[o + 2] = c * a[j + 2] - s * a[j] + z
        }
      } else if (name === 'normal') {
        for (let v = 0; v < n; v++, o += 3) {
          const j = (index ? index[v] : v) * 3
          const nx = c * a[j] + s * a[j + 2]
          const ny = a[j + 1]
          const nz = c * a[j + 2] - s * a[j]
          const k = 1 / (Math.sqrt(nx * nx + ny * ny + nz * nz) || 1)
          out[o] = nx * k
          out[o + 1] = ny * k
          out[o + 2] = nz * k
        }
      } else if (index) {
        for (let v = 0; v < n; v++) for (let e = 0, j = index[v] * size; e < size; e++) out[o++] = a[j + e]
      } else out.set(a, o)
    }
    start += n
    yield
  }
  const merged = new THREE.BufferGeometry()
  for (const { name, size, normalized, out } of attributes) merged.setAttribute(name, new THREE.BufferAttribute(out, size, normalized))
  return merged
}
