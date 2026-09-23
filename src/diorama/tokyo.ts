import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { boat, buildIsland, hip, latticeTower, placer, stoneBridge, type Site } from './island'

// The Sumida winds down the east side of the city.
const centre = (z: number) => 1.3 + 0.45 * Math.sin(0.5 * z + 1)
const half = () => 0.62

const VERMILION = '#b8412f'
const TILE = '#3f444b'

function tokyoTower(site: Site, x: number, z: number) {
  const orange = '#e0512f'
  const white = '#f1eee8'
  const band = 2.3 / 12
  latticeTower(placer(site.b, x, site.height(x, z) - 0.02, z, 0.3), {
    foot: 0.42,
    knee: 0.22,
    kneeY: 0.5,
    top: 0.02,
    height: 2.8,
    decks: [
      [1.2, 0.4, 0.12],
      [2.05, 0.18, 0.07],
    ],
    color: (y) => (y >= 0.5 && Math.floor((y - 0.5) / band) % 2 ? white : orange),
  })
}

/** Sensō-ji: a five-storey pagoda beside the main hall. */
function temple(site: Site, x: number, z: number) {
  const pagoda = placer(site.b, x, site.height(x, z) - 0.02, z)
  pagoda(new RoundedBoxGeometry(0.46, 0.08, 0.46, 1, 0.015), '#bdb3a2', 0.04, 0.2)
  let y = 0.08
  for (let i = 0; i < 5; i++) {
    const w = 0.28 - i * 0.03
    pagoda(new RoundedBoxGeometry(w, 0.13, w, 1, 0.01), VERMILION, y + 0.065, 0.2)
    pagoda(hip(w + 0.22, 0.08), TILE, y + 0.12, 0)
    y += 0.17
  }
  pagoda(new THREE.CylinderGeometry(0.01, 0.014, 0.32, 6), '#c9a24a', y + 0.14)
  for (let k = 0; k < 4; k++) pagoda(new THREE.CylinderGeometry(0.024, 0.024, 0.012, 10), '#c9a24a', y + 0.06 + k * 0.05)

  const hz = z - 0.95
  const hall = placer(site.b, x, site.height(x, hz) - 0.02, hz)
  hall(new RoundedBoxGeometry(0.95, 0.08, 0.66, 1, 0.015), '#bdb3a2', 0.04, 0.2)
  hall(new RoundedBoxGeometry(0.74, 0.26, 0.48, 2, 0.015), VERMILION, 0.21, 0.25)
  hall(hip(1.02, 0.36, 0.76), TILE, 0.33, 0)
}

export function buildTokyo() {
  return buildIsland({
    seed: 21,
    centre,
    half,
    water: '#4d8a9c',
    parks: [{ x: -2.3, z: -2.7, a: 1.05, c: 1.25, h: 0 }],
    houses: {
      count: 150,
      walls: ['#f0ede6', '#e2ddd3', '#d6d9dc', '#c9cfd4', '#ece3d3', '#b9c2c9'],
      roofs: [TILE, '#5a5f66', '#6b5a4e'],
      pitched: 0.45,
      pitch: 0.8,
      width: [0.2, 0.38],
      floors: (r) => 1 + Math.floor(r() * r() * 5.5),
    },
    trees: { count: 30, park: 26, greens: ['#7aa35a', '#6a9450', '#f2b8c6', '#88ad62', '#f5c6d2'], cypress: 0 },
    landmarks(site) {
      tokyoTower(site, -1.5, 1)
      site.reserve(-1.5, 1, 0.52)
      temple(site, -2.3, -2.3)
      site.reserve(-2.3, -2.3, 0.3)
      site.reserve(-2.3, -3.25, 0.6)
      stoneBridge(site, -1.2, '#c0473a', 0.26)
      boat(site, (s) => [centre(-0.7 + 4.6 * s) + 0.2, -0.7 + 4.6 * s], 38, '#3a4250', '#c9d3dc', 0.9)
    },
  })
}
