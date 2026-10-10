import * as THREE from 'three'

/**
 * three's ExtrudeGeometry with its flat normals worked out straight on the arrays. The values are the
 * ones computeVertexNormals and normalizeNormals give for unindexed triangles; their per-vertex Vector3
 * round trips were a quarter of an extrusion's time.
 */
export class Extrusion extends THREE.ExtrudeGeometry {
  computeVertexNormals() {
    const p = this.attributes.position.array
    const n = new Float32Array(p.length)
    for (let i = 0; i < p.length; i += 9) {
      // (C - B) × (A - B), stored as floats, then scaled to unit length from the stored values.
      const cbx = p[i + 6] - p[i + 3]
      const cby = p[i + 7] - p[i + 4]
      const cbz = p[i + 8] - p[i + 5]
      const abx = p[i] - p[i + 3]
      const aby = p[i + 1] - p[i + 4]
      const abz = p[i + 2] - p[i + 5]
      const x = Math.fround(cby * abz - cbz * aby)
      const y = Math.fround(cbz * abx - cbx * abz)
      const z = Math.fround(cbx * aby - cby * abx)
      const k = 1 / (Math.sqrt(x * x + y * y + z * z) || 1)
      n[i] = n[i + 3] = n[i + 6] = x * k
      n[i + 1] = n[i + 4] = n[i + 7] = y * k
      n[i + 2] = n[i + 5] = n[i + 8] = z * k
    }
    this.setAttribute('normal', new THREE.BufferAttribute(n, 3))
  }
}
