// node scripts/check-geometry.mjs: the island kit's faster geometries must match three's float for float.
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { RoundedBoxGeometry as ThreeRoundedBox } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { RoundedBoxGeometry } from '../src/diorama/rounded-box.ts'
import { Extrusion } from '../src/diorama/extrusion.ts'

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

console.log(`${boxes.length} rounded boxes and ${extrusions.length} extrusions match three`)
