import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { boat, buildIsland, gable, islet, latticeTower, placer, stoneBridge, type Site } from './island'

// The Seine runs north to south and widens around the Île de la Cité.
const CITE = 1.2
const centre = (z: number) => 0.3 + 0.3 * Math.sin(0.3 * z - 0.4)
const half = (z: number) => 0.55 + 0.35 * Math.exp(-(((z - CITE) / 1.1) ** 2))

const STONE = '#ddd2ba'
const LEAD = '#6e7b89'

function eiffel(site: Site, x: number, z: number) {
  latticeTower(placer(site.b, x, site.height(x, z) - 0.02, z, Math.PI / 4), {
    foot: 0.5,
    knee: 0.3,
    kneeY: 0.55,
    top: 0.03,
    height: 3,
    decks: [
      [0.55, 0.74, 0.06],
      [1.15, 0.42, 0.05],
      [2.75, 0.1, 0.04],
    ],
    color: () => '#8a6f55',
    arches: true,
  })
}

/** Notre-Dame on its island: nave, transept, spire and the two west towers. */
function notreDame(site: Site, x: number, z: number) {
  const top = islet(site, x, z, 0.8, 1.9)
  // Local x runs along the nave, west front at -x (towards the south, +z).
  const put = placer(site.b, x, top, z, -Math.PI / 2)
  put(new RoundedBoxGeometry(1, 0.34, 0.3, 2, 0.02), STONE, 0.17, 0.3)
  put(gable(1, 0.18, 0.32), LEAD, 0.34)
  const cross = new RoundedBoxGeometry(0.28, 0.32, 0.54, 2, 0.02)
  cross.translate(0.12, 0, 0)
  put(cross, STONE, 0.16, 0.3)
  const crossRoof = gable(0.56, 0.17, 0.3)
  crossRoof.rotateY(Math.PI / 2)
  crossRoof.translate(0.12, 0, 0)
  put(crossRoof, LEAD, 0.32)
  const spire = new THREE.ConeGeometry(0.035, 0.42, 8)
  spire.translate(0.12, 0, 0)
  put(spire, LEAD, 0.72)
  const apse = new THREE.CylinderGeometry(0.15, 0.15, 0.3, 16, 1, false, 0, Math.PI)
  apse.translate(0.5, 0, 0)
  put(apse, STONE, 0.15, 0.3)
  const front = new RoundedBoxGeometry(0.1, 0.5, 0.34, 2, 0.015)
  front.translate(-0.52, 0, 0)
  put(front, STONE, 0.25, 0.3)
  for (const lz of [-0.12, 0.12]) {
    const tower = new RoundedBoxGeometry(0.14, 0.74, 0.13, 2, 0.015)
    tower.translate(-0.52, 0, lz)
    put(tower, STONE, 0.37, 0.3)
  }
  const rose = new THREE.CylinderGeometry(0.06, 0.06, 0.012, 20)
  rose.rotateZ(Math.PI / 2)
  rose.translate(-0.575, 0, 0)
  put(rose, '#5d6b86', 0.36, 0)
}

export function buildParis() {
  return buildIsland({
    seed: 12,
    centre,
    half,
    water: '#4b8a86',
    // Montmartre on the right bank; the Champ de Mars runs back from the tower.
    hills: [{ x: 2.8, z: -3, a: 1.4, c: 1.2, h: 0.35 }],
    parks: [{ x: -3, z: -0.9, a: 1.6, c: 0.75, h: 0 }],
    houses: {
      count: 100,
      walls: ['#efe6d2', '#e8dcc4', '#f2ead9', '#e3d6bd'],
      roofs: ['#7a8794', '#6e7b89', '#838e99'],
      pitched: 0.92,
      pitch: 0.55,
      width: [0.3, 0.5],
      floors: (r) => 2 + Math.floor(r() * 2.5),
    },
    trees: { count: 34, park: 24, greens: ['#7f9f5a', '#8aa864', '#6f9350'], cypress: 0 },
    landmarks(site) {
      eiffel(site, -2, -0.9)
      site.reserve(-2, -0.9, 0.62)
      notreDame(site, centre(CITE), CITE)
      stoneBridge(site, -1.6)
      stoneBridge(site, 3.4)
      // A bateau-mouche between the bridges, keeping clear of the island.
      const zs = [-1.2, 3]
      boat(
        site,
        (s) => {
          const z = zs[0] + (zs[1] - zs[0]) * s
          return [centre(z) + 0.62 * (1 - THREE.MathUtils.smoothstep(Math.abs(z - CITE), 1, 1.6)), z]
        },
        36,
        '#f1eee6',
        '#3c4a5a',
        0.8,
      )
    },
  })
}
