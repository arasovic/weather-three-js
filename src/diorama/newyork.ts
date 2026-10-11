import * as THREE from 'three'
import { RoundedBoxGeometry } from './rounded-box'
import { house, materials, paint, random, tree } from './kit'
import { TAU, boat, buildIsland, islet, placer, slab, strut, type Site } from './island'

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

const GRANITE = '#cfc5ad'
const COPPER = '#86bfae'
const lathe = (profile: number[][], segments: number) => new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segments)

/** A square block narrowing from `bottom` to `top` wide, with flat faces. */
function frustum(bottom: number, top: number, h: number) {
  const g = new THREE.CylinderGeometry(top * Math.SQRT1_2, bottom * Math.SQRT1_2, h, 4).toNonIndexed().rotateY(Math.PI / 4)
  g.computeVertexNormals()
  return g
}

/**
 * The Statue of Liberty on Hunt's pedestal inside the eleven-pointed star of Fort Wood, facing the
 * Narrows to the south-east. She is built facing +z, so her raised right arm is on -x.
 */
function liberty(site: Site, x: number, z: number) {
  const ground = islet(site, x, z, 1, 0.9)
  const facing = Math.PI / 4
  const put = placer(site.b, x, ground, z, facing)

  const star = new THREE.Shape()
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * TAU
    const r = i % 2 ? 0.25 : 0.33
    if (i) star.lineTo(Math.cos(a) * r, Math.sin(a) * r)
    else star.moveTo(r, 0)
  }
  put(slab(star, 0, 0.07, 0.01), '#c9c3b6', 0, 0.2)

  // The pedestal: a stepped base, a shaft with a dark loggia on each face, the cornice and the balcony.
  put(new RoundedBoxGeometry(0.27, 0.04, 0.27, 1, 0.01), GRANITE, 0.09)
  put(frustum(0.23, 0.18, 0.06), GRANITE, 0.14)
  put(new RoundedBoxGeometry(0.172, 0.2, 0.172, 2, 0.01), GRANITE, 0.27)
  put(new RoundedBoxGeometry(0.175, 0.09, 0.062, 1, 0.004), '#9d9384', 0.28, 0)
  put(new RoundedBoxGeometry(0.062, 0.09, 0.175, 1, 0.004), '#9d9384', 0.28, 0)
  put(new RoundedBoxGeometry(0.2, 0.025, 0.2, 1, 0.008), GRANITE, 0.382, 0)
  put(new RoundedBoxGeometry(0.18, 0.035, 0.18, 1, 0.008), GRANITE, 0.41, 0)

  // The figure, from her feet on the balcony floor: a robe broad with drapery, the head and the seven rays of the crown.
  const feet = 0.42
  const robe = [[0, 0], [0.066, 0], [0.069, 0.014], [0.066, 0.06], [0.062, 0.14], [0.059, 0.22], [0.06, 0.28], [0.061, 0.32], [0.055, 0.348], [0.036, 0.366], [0.017, 0.374], [0.015, 0.392], [0, 0.392]]
  put(lathe(robe, 20).scale(1, 1, 0.72), COPPER, feet, 0.1)
  put(new THREE.SphereGeometry(0.029, 14, 12).scale(1, 1.22, 0.95), COPPER, feet + 0.42, 0)
  put(new THREE.CylinderGeometry(0.031, 0.03, 0.01, 16), COPPER, feet + 0.43, 0)
  for (let k = -3; k <= 3; k++) {
    put(new THREE.ConeGeometry(0.005, 0.038, 5).translate(0, 0.047, 0).rotateZ(k * 0.42).rotateX(-0.3), COPPER, feet + 0.432, 0)
  }

  // The right arm raised with the torch, its gilded flame lit at night like the street lamps.
  const shoulder = new THREE.Vector3(-0.046, 0.34, 0)
  const hand = new THREE.Vector3(-0.08, 0.507, 0.012)
  put(strut(shoulder, hand, 0.02, 0.011, 8), COPPER, feet, 0)
  put(new THREE.SphereGeometry(0.0125, 10, 8).translate(hand.x, 0, hand.z), COPPER, feet + hand.y, 0)
  put(new THREE.CylinderGeometry(0.0075, 0.0065, 0.032, 8).translate(hand.x, 0, hand.z), COPPER, feet + hand.y + 0.018, 0)
  put(new THREE.CylinderGeometry(0.016, 0.008, 0.016, 10).translate(hand.x, 0, hand.z), COPPER, feet + hand.y + 0.042, 0)
  put(new THREE.CylinderGeometry(0.021, 0.021, 0.004, 14).translate(hand.x, 0, hand.z), COPPER, feet + hand.y + 0.051, 0)
  const flame = lathe([[0, 0], [0.009, 0.004], [0.012, 0.012], [0.01, 0.022], [0.005, 0.032], [0, 0.04]], 10)
  site.b.add(materials.lamps, paint(flame.translate(hand.x, 0, hand.z), '#e8b84a', 0), x, ground + feet + hand.y + 0.05, z, facing)

  // The left arm down her side and the tablet held against her hip, its face turned forward and its top leaning out.
  put(strut(new THREE.Vector3(0.05, 0.335, -0.005), new THREE.Vector3(0.066, 0.245, -0.012), 0.0145, 0.012, 8), COPPER, feet, 0)
  put(new RoundedBoxGeometry(0.009, 0.096, 0.054, 1, 0.003).rotateY(-0.45).rotateZ(-0.3).translate(0.064, 0, 0.012), COPPER, feet + 0.285, 0)

  // A few trees on the lawns behind and beside the fort, none in front of her.
  for (const [dx, dz, green] of [[-0.39, -0.33, '#6f9a52'], [0.39, -0.33, '#5f8a4a'], [-0.39, 0.33, '#7ea85c']] as const) {
    tree(site.b, x + dx, ground - 0.01, z + dz, 0.4, green)
  }
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
    *landmarks(site) {
      empireState(site, 0.3, 0.2)
      yield
      site.reserve(0.3, 0.2, 0.5)
      yield
      liberty(site, centre(3.9) + 0.1, 3.9)
      yield
      const ferryZ = 0.9
      const from = centre(ferryZ) - half(ferryZ) + 0.3
      const to = centre(ferryZ) + half(ferryZ) - 0.3
      boat(site, (s) => [from + (to - from) * s, ferryZ], 28, '#e8762d', '#f3efe6')
    },
  })
}
