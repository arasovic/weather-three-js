// node scripts/check-rounded-box.mjs: the island kit's cached RoundedBoxGeometry must match three's float for float.
import assert from 'node:assert/strict'
import { RoundedBoxGeometry as Three } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { RoundedBoxGeometry as Kit } from '../src/diorama/rounded-box.ts'

const shapes = [[0.5, 0.66, 0.4, 2, 0.035], [1.2, 0.05, 0.8, 1, 0.02], [0.03, 0.4, 2, 1, 0.3], [0.2, 0.2, 0.2, 3, 0.1], [0.7, 1.3, 0.25, 2, 0]]
for (const shape of shapes) {
  const a = new Three(...shape)
  const b = new Kit(...shape)
  for (const name of ['position', 'normal', 'uv']) assert.deepEqual(b.attributes[name].array, a.attributes[name].array, `${name} of ${shape}`)
  assert.deepEqual(b.groups, a.groups)
}
console.log(`rounded box matches three for ${shapes.length} shapes`)
