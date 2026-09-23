import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { house, materials, paint, random } from './kit'
import { boat, buildIsland, islet, placer, strut, type Site } from './island'

// The Hudson runs down the west side with a strip of New Jersey beyond it,
// widening into the Upper Bay at the south end.
const centre = (z: number) => -3.5 + 0.12 * Math.sin(0.6 * z)
const half = (z: number) => 0.8 + 0.7 * THREE.MathUtils.smoothstep(z, 2.2, 4.4)

const LIMESTONE = '#d6cfbf'

/** Stacked setbacks with lit windows, an LED crown and the mast. */
function empireState(site: Site, x: number, z: number) {
  const r = random(5)
  let y = site.height(x, z) - 0.03
  for (const [w, d, floors] of [[0.72, 0.52, 2], [0.56, 0.42, 2], [0.4, 0.3, 8], [0.3, 0.23, 1], [0.22, 0.17, 1]]) {
    house(site.b, x, y, z, 0, w, d, floors, LIMESTONE, null, r)
    y += floors * 0.2 + 0.06 + 0.045
  }
  for (const [w, h] of [[0.15, 0.14], [0.11, 0.12]]) {
    site.b.add(materials.leds, paint(new RoundedBoxGeometry(w, h, w, 1, 0.01), '#e9e4d8', 0), x, y + h / 2, z)
    y += h
  }
  const put = placer(site.b, x, y, z)
  put(new THREE.CylinderGeometry(0.03, 0.045, 0.12, 8), LIMESTONE, 0.06)
  put(new THREE.CylinderGeometry(0.006, 0.02, 0.42, 6), '#c9ccd0', 0.33)
}

function liberty(site: Site, x: number, z: number) {
  const put = placer(site.b, x, islet(site, x, z, 0.7, 0.7), z, 0.4)
  const stone = '#cfc5ad'
  const green = '#6fa596'
  put(new THREE.CylinderGeometry(0.26, 0.29, 0.08, 11), stone, 0.04, 0.2)
  put(new RoundedBoxGeometry(0.17, 0.34, 0.17, 2, 0.01), stone, 0.25, 0.25)
  put(new THREE.CylinderGeometry(0.045, 0.08, 0.36, 10), green, 0.6, 0.1)
  put(new THREE.SphereGeometry(0.04, 12, 10), green, 0.82)
  put(new THREE.CylinderGeometry(0.05, 0.035, 0.015, 7), green, 0.86)
  put(strut(new THREE.Vector3(0.04, 0.72, 0), new THREE.Vector3(0.07, 0.98, 0), 0.016, 0.012), green, 0)
  put(new THREE.ConeGeometry(0.022, 0.05, 8).rotateX(Math.PI), '#c9a24a', 1.0)
  put(new THREE.SphereGeometry(0.02, 8, 6).translate(0.07, 0, 0), '#e3b654', 1.03)
}

export function buildNewYork() {
  const midtown = (x: number, z: number) => Math.exp(-((x - 0.3) ** 2 + (z - 0.2) ** 2) / 4)
  const downtown = (x: number, z: number) => Math.exp(-((x + 1.2) ** 2 + (z - 3.4) ** 2) / 2.5)
  return buildIsland({
    seed: 9,
    centre,
    half,
    water: '#4a8196',
    parks: [{ x: 1, z: -3, a: 0.75, c: 1.7, h: 0 }],
    houses: {
      count: 135,
      walls: ['#c9c2b5', '#b9b3a8', '#d8d2c6', '#9aa3ad', '#a9876f', '#c7b299', '#8e9aa6'],
      roofs: ['#6b5a4e'],
      pitched: 0.06,
      width: [0.3, 0.5],
      floors: (r, x, z) => 2 + Math.floor(r() * (2 + 7 * Math.max(midtown(x, z), downtown(x, z)))),
      grid: 0,
    },
    trees: { count: 22, park: 46, greens: ['#6f9a52', '#7ea85c', '#5f8a4a'], cypress: 0 },
    landmarks(site) {
      empireState(site, 0.3, 0.2)
      site.reserve(0.3, 0.2, 0.5)
      liberty(site, centre(3.9) + 0.1, 3.9)
      const ferryZ = 0.9
      const from = centre(ferryZ) - half(ferryZ) + 0.3
      const to = centre(ferryZ) + half(ferryZ) - 0.3
      boat(site, (s) => [from + (to - from) * s, ferryZ], 28, '#e8762d', '#f3efe6')
    },
  })
}
