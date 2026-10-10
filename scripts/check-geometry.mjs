// node scripts/check-geometry.mjs: the island kit's faster geometries and merge must match three's float for float.
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { RoundedBoxGeometry as ThreeRoundedBox } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { RoundedBoxGeometry } from '../src/diorama/rounded-box.ts'
import { Extrusion } from '../src/diorama/extrusion.ts'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { Batch } from '../src/diorama/batch.ts'

const same = (a, b, what) => {
  for (const name of ['position', 'normal', 'uv']) assert.deepEqual(b.attributes[name].array, a.attributes[name].array, `${name} of ${what}`)
  assert.deepEqual(b.groups, a.groups, `groups of ${what}`)
}

const boxes = [[0.5, 0.66, 0.4, 2, 0.035], [1.2, 0.05, 0.8, 1, 0.02], [0.03, 0.4, 2, 1, 0.3], [0.2, 0.2, 0.2, 3, 0.1], [0.7, 1.3, 0.25, 2, 0]]
for (const box of boxes) same(new ThreeRoundedBox(...box), new RoundedBoxGeometry(...box), `box ${box}`)

const blob = new THREE.Shape(Array.from({ length: 300 }, (_, i) => {
  const a = (i / 300) * Math.PI * 2
  return new THREE.Vector2(Math.cos(a) * (5 + Math.sin(a * 7)), -Math.sin(a) * (4 + Math.cos(a * 3)))
}))
blob.holes.push(new THREE.Path().absarc(1, 0.5, 0.8, 0, Math.PI * 2, true))
const extrusions = [{ depth: 0.3, bevelEnabled: false }, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelOffset: -0.04, bevelSegments: 3, curveSegments: 12 }]
for (const options of extrusions) same(new THREE.ExtrudeGeometry(blob, options), new Extrusion(blob, options), `extrusion ${JSON.stringify(options)}`)

// Batch against moving each part with three (unit-length normals, as applyMatrix4 leaves them) and mergeGeometries.
const material = new THREE.MeshBasicMaterial()
const parts = () => {
  const coloured = (g) => g.setAttribute('color', new THREE.BufferAttribute(g.attributes.position.array.map((v) => Math.abs(v)), 3))
  const long = new THREE.ConeGeometry(0.3, 1, 4, 1).toNonIndexed()
  long.attributes.normal.array.forEach((v, i, a) => (a[i] = v * 2.5))
  return [
    [coloured(new THREE.BoxGeometry(1, 2, 3)), 0.5, 0.1, -2, 0.7],
    [coloured(new THREE.SphereGeometry(0.4, 9, 7)), -1, 2, 0.25, 0],
    [coloured(new RoundedBoxGeometry(0.5, 0.66, 0.4, 2, 0.035)), 3, 0, 1, -2.1],
    [coloured(long), 0, 0, 0, Math.PI / 4],
    [coloured(new THREE.CylinderGeometry(0.1, 0.2, 1, 6).toNonIndexed().deleteAttribute('uv')), 1.5, -0.3, 0.8, 3],
  ]
}
const batch = new Batch()
for (const [geo, x, y, z, rotY] of parts()) batch.add(material, geo, x, y, z, rotY)
const reference = parts().map(([geo, x, y, z, rotY]) => {
  const g = geo.index ? geo.toNonIndexed() : geo
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2))
  return g.applyMatrix4(new THREE.Matrix4().makeRotationY(rotY).setPosition(x, y, z))
})
const merged = batch.build().children[0].geometry
const expected = mergeGeometries(reference)
for (const name of ['position', 'normal', 'uv', 'color']) {
  const a = expected.attributes[name].array
  const b = merged.attributes[name].array
  assert.equal(b.length, a.length, `merged ${name} length`)
  // applyMatrix4 rounds the turned point to a float before it adds the move; Batch rounds once.
  for (let i = 0; i < a.length; i++) assert.ok(Math.abs(a[i] - b[i]) <= 1e-6 * Math.max(1, Math.abs(a[i])), `merged ${name}[${i}] ${b[i]} vs ${a[i]}`)
}

console.log(`${boxes.length} rounded boxes and ${extrusions.length} extrusions match three; Batch matches mergeGeometries`)
