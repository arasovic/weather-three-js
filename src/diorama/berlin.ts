import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { Batch, GROUND, materials, paint, random, tree } from './kit'
import { BASE, TAU, boat, buildIsland, islet, placer, traffic, type Put, type Site } from './island'

// The Spree runs through the middle and splits around Museum Island.
const ISLAND = -0.6
const centre = (z: number) => 0.2 + 0.35 * Math.sin(0.35 * z + 0.5)
const half = (z: number) => 0.55 + 0.4 * Math.exp(-(((z - ISLAND) / 1.2) ** 2))
const shore = (z: number) => centre(z) - half(z)

const SANDSTONE = '#dccfb2'
const COPPER = '#6f9a8a'
const BRICK = '#a54a36'
const TEMPELHOF = { x: -2.3, z: 3.1, a: 1.1, c: 0.7 }

/** A dome: a stone drum, a copper cap and a lantern. */
function dome(put: Put, r: number, y: number, lx = 0, lz = 0) {
  const at = (g: THREE.BufferGeometry) => (g.translate(lx, 0, lz), g)
  put(at(new THREE.CylinderGeometry(r * 0.8, r * 0.85, r * 0.6, 16)), SANDSTONE, y + r * 0.3, 0.2)
  put(at(new THREE.SphereGeometry(r * 0.82, 16, 8, 0, TAU, 0, Math.PI / 2)), COPPER, y + r * 0.6, 0)
  put(at(new THREE.CylinderGeometry(r * 0.12, r * 0.15, r * 0.4, 8)), COPPER, y + r * 1.55, 0)
}

/** Museum Island: the Berliner Dom and the colonnade of the Altes Museum across the Lustgarten. */
function museumIsland(site: Site) {
  const x = centre(ISLAND)
  const top = islet(site, x, ISLAND, 0.75, 1.6)
  const put = placer(site.b, x, top, ISLAND + 0.3)
  put(new RoundedBoxGeometry(0.46, 0.3, 0.42, 2, 0.02), '#b8ad98', 0.15, 0.3)
  dome(put, 0.2, 0.3)
  put(new THREE.CylinderGeometry(0.004, 0.004, 0.08, 4), '#d4a73a', 0.72, 0)
  for (const [lx, lz] of [[-0.2, -0.18], [0.2, -0.18], [-0.2, 0.18], [0.2, 0.18]]) {
    const tower = new RoundedBoxGeometry(0.1, 0.4, 0.1, 1, 0.01)
    tower.translate(lx, 0, lz)
    put(tower, '#b8ad98', 0.2, 0.3)
    dome(put, 0.06, 0.4, lx, lz)
  }
  const museum = placer(site.b, x, top, ISLAND - 0.45)
  museum(new RoundedBoxGeometry(0.55, 0.18, 0.28, 2, 0.015), '#e7dcc6', 0.09, 0.3)
  for (let i = 0; i < 9; i++) {
    const column = new THREE.CylinderGeometry(0.012, 0.013, 0.16, 8)
    column.translate(-0.24 + i * 0.06, 0, 0.16)
    museum(column, '#efe6d4', 0.08, 0)
  }
  const roof = new RoundedBoxGeometry(0.58, 0.03, 0.34, 1, 0.01)
  roof.translate(0, 0, 0.02)
  museum(roof, '#e7dcc6', 0.185, 0)
}

/**
 * The Fernsehturm, with a cross of sunlight on its ball: the steel panels catch the
 * sun in a cross, which Berliners call the Pope's revenge.
 */
function fernsehturm(site: Site, x: number, z: number) {
  const put = placer(site.b, x, GROUND - 0.02, z)
  put(new RoundedBoxGeometry(0.5, 0.08, 0.5, 1, 0.02), '#c9c6bf', 0.04, 0.3)
  put(new THREE.CylinderGeometry(0.055, 0.085, 2.35, 24), '#dcdcd6', 0.08 + 1.175, 0.2)
  put(new THREE.SphereGeometry(0.2, 32, 20), '#b9c0c8', 2.55, 0)
  put(new THREE.CylinderGeometry(0.203, 0.203, 0.05, 32), '#3b4450', 2.5, 0)
  for (let i = 0; i < 6; i++) put(new THREE.CylinderGeometry(0.018 - i * 0.002, 0.02 - i * 0.002, 0.1, 8), i % 2 ? '#f2efe9' : '#d8463a', 2.8 + i * 0.1, 0)
  const uniforms = { uSun: { value: new THREE.Vector3(0, 1, 0) }, uStrength: { value: 0 } }
  const shine = new THREE.Mesh(
    new THREE.SphereGeometry(0.204, 48, 32),
    new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        varying vec3 vNormal;
        varying vec3 vWorld;
        void main() {
          vNormal = normalize(mat3(modelMatrix) * normal);
          vec4 world = modelMatrix * vec4(position, 1.0);
          vWorld = world.xyz;
          gl_Position = projectionMatrix * viewMatrix * world;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uSun;
        uniform float uStrength;
        varying vec3 vNormal;
        varying vec3 vWorld;
        void main() {
          // Centred where the ball mirrors the sun to the eye, arms along the panel seams.
          vec3 h = normalize(uSun + normalize(cameraPosition - vWorld));
          vec3 east = normalize(cross(vec3(0.0, 1.0, 0.0), h));
          vec3 north = cross(h, east);
          vec3 d = normalize(vNormal) - h;
          float u = abs(dot(d, east));
          float v = abs(dot(d, north));
          float arms = max((1.0 - smoothstep(0.05, 0.08, u)) * (1.0 - smoothstep(0.38, 0.48, v)), (1.0 - smoothstep(0.05, 0.08, v)) * (1.0 - smoothstep(0.26, 0.34, u)));
          gl_FragColor = vec4(vec3(1.0, 0.97, 0.88) * arms * uStrength, 1.0);
        }`,
    }),
  )
  shine.position.set(x, GROUND - 0.02 + 2.55, z)
  site.group.add(shine)
  site.animate((_t, _wind, m) => {
    uniforms.uSun.value.copy(m.sun)
    uniforms.uStrength.value = 2.2 * m.day * m.clear
    shine.visible = uniforms.uStrength.value > 0.01
  })
  site.reserve(x, z, 0.35)
}

/** The Brandenburg Gate with its Quadriga, and Unter den Linden running east to the river. */
function brandenburgGate(site: Site, x: number, z: number) {
  const put = placer(site.b, x, GROUND - 0.02, z)
  put(new RoundedBoxGeometry(0.22, 0.04, 0.76, 1, 0.01), '#cfc3a6', 0.02, 0.2)
  for (let i = 0; i < 6; i++) {
    for (const lx of [-0.06, 0.06]) {
      const column = new THREE.CylinderGeometry(0.018, 0.02, 0.26, 10)
      column.translate(lx, 0, -0.3 + i * 0.12)
      put(column, SANDSTONE, 0.17, 0.2)
    }
  }
  put(new RoundedBoxGeometry(0.2, 0.06, 0.74, 1, 0.01), SANDSTONE, 0.33, 0)
  put(new RoundedBoxGeometry(0.16, 0.06, 0.4, 1, 0.01), SANDSTONE, 0.39, 0)
  for (const lz of [-0.46, 0.46]) {
    const wing = new RoundedBoxGeometry(0.2, 0.2, 0.14, 1, 0.01)
    wing.translate(0, 0, lz)
    put(wing, SANDSTONE, 0.12, 0.3)
  }
  // The Quadriga: four horses abreast and the goddess behind them, facing east.
  for (let i = 0; i < 4; i++) {
    const horse = new RoundedBoxGeometry(0.06, 0.04, 0.02, 1, 0.006)
    horse.translate(0.02, 0, -0.045 + i * 0.03)
    put(horse, '#5f8a78', 0.44, 0)
  }
  const goddess = new THREE.ConeGeometry(0.018, 0.08, 8)
  goddess.translate(-0.03, 0, 0)
  put(goddess, '#5f8a78', 0.46, 0)
  site.reserve(x + 0.2, z, 0.5)
  const east = shore(z) - 0.25
  site.block((bx, bz, r) => Math.abs(bz - z) < 0.2 + r && bx > x && bx < east)
  for (let lx = x + 0.3; lx < east; lx += 0.2) {
    for (const s of [-1, 1]) tree(site.b, lx, GROUND - 0.02, z + s * 0.14, 0.55, '#7ea85c')
  }
}

/** The Reichstag with its glass dome, lit from within after dark. */
function reichstag(site: Site, x: number, z: number) {
  const put = placer(site.b, x, GROUND - 0.02, z)
  const stone = '#cfc4ad'
  put(new RoundedBoxGeometry(0.8, 0.28, 0.55, 2, 0.02), stone, 0.14, 0.3)
  for (const [lx, lz] of [[-0.38, -0.25], [0.38, -0.25], [-0.38, 0.25], [0.38, 0.25]]) {
    const tower = new RoundedBoxGeometry(0.16, 0.36, 0.16, 1, 0.012)
    tower.translate(lx, 0, lz)
    put(tower, stone, 0.18, 0.3)
  }
  for (let i = 0; i < 6; i++) {
    const column = new THREE.CylinderGeometry(0.014, 0.015, 0.22, 8)
    column.translate(-0.1 + i * 0.04, 0, 0.29)
    put(column, '#e3dac6', 0.13, 0)
  }
  site.b.add(materials.lamps, paint(new THREE.SphereGeometry(0.17, 24, 10, 0, TAU, 0, Math.PI / 2), '#cfe0e8', 0, 0.01), x, GROUND + 0.26, z)
  site.reserve(x + 0.1, z, 0.6)
}

/** The Victory Column in the Tiergarten, with its gilded goddess. */
function siegessaule(site: Site, x: number, z: number) {
  const put = placer(site.b, x, GROUND - 0.02, z)
  put(new RoundedBoxGeometry(0.24, 0.14, 0.24, 1, 0.015), '#9b5b4b', 0.07, 0.3)
  put(new THREE.CylinderGeometry(0.035, 0.045, 0.7, 12), '#d9c9a5', 0.49, 0.2)
  for (const y of [0.32, 0.46, 0.6]) put(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 12), '#d4a73a', y, 0)
  put(new THREE.ConeGeometry(0.025, 0.12, 8), '#e3b654', 0.9, 0)
  put(new RoundedBoxGeometry(0.1, 0.012, 0.02, 1, 0.004), '#e3b654', 0.92, 0)
  site.reserve(x, z, 0.2)
}

/** The Oberbaumbrücke: red brick arches, twin towers, and the yellow U-Bahn crossing on top. */
function oberbaumbrucke(site: Site, z: number) {
  const x0 = shore(z) - 0.3
  const x1 = centre(z) + half(z) + 0.3
  const c = (x0 + x1) / 2
  const put = placer(site.b, 0, 0, z)
  const at = (g: THREE.BufferGeometry, x: number, lz = 0) => (g.translate(x, 0, lz), g)
  const deck = GROUND + 0.02
  const rail = GROUND + 0.24
  put(at(new RoundedBoxGeometry(x1 - x0, 0.07, 0.34, 1, 0.015), c), BRICK, deck, 0.1)
  put(at(new RoundedBoxGeometry(x1 - x0, 0.05, 0.12, 1, 0.012), c, -0.1), BRICK, rail, 0.05)
  for (let x = x0 + 0.1; x < x1; x += 0.2) put(at(new RoundedBoxGeometry(0.05, rail - deck, 0.1, 1, 0.01), x, -0.1), BRICK, (rail + deck) / 2, 0.1)
  for (let i = 1; i < 4; i++) {
    const x = x0 + ((x1 - x0) * i) / 4
    put(at(new RoundedBoxGeometry(0.1, deck - BASE, 0.36, 1, 0.02), x), BRICK, (deck + BASE) / 2 - 0.03, 0.3)
  }
  for (const s of [-1, 1]) {
    put(at(new RoundedBoxGeometry(0.12, 0.44, 0.12, 1, 0.012), c + s * 0.12, -0.13), BRICK, deck + 0.22, 0.2)
    put(at(new THREE.ConeGeometry(0.09, 0.22, 4).rotateY(Math.PI / 4), c + s * 0.12, -0.13), '#5b5f66', deck + 0.55, 0)
  }
  site.block((bx, bz, r) => Math.abs(bz - z) < 0.22 + r && bx > x0 - 0.3 && bx < x1 + 0.3)
  traffic(site, (s) => new THREE.Vector3(x0 + (x1 - x0) * s, deck + 0.05, z + 0.04), 0.05)

  const cars = new Batch()
  for (const lx of [-0.13, 0.13]) {
    cars.add(materials.clay, paint(new RoundedBoxGeometry(0.24, 0.07, 0.08, 2, 0.02), '#f2c230', 0), lx, 0.035, 0)
    cars.add(materials.clay, paint(new RoundedBoxGeometry(0.2, 0.025, 0.082, 1, 0.006), '#3b3f45', 0), lx, 0.05, 0)
  }
  const train = cars.build()
  site.group.add(train)
  site.animate((t) => {
    const p = (t % 24) / 24
    const s = p < 0.5 ? THREE.MathUtils.smoothstep(p, 0.05, 0.45) : 1 - THREE.MathUtils.smoothstep(p, 0.55, 0.95)
    train.position.set(x0 + 0.3 + (x1 - x0 - 0.6) * s, rail + 0.025, z - 0.1)
  })
}

/** The East Side Gallery: a stretch of the Wall along the river, painted in murals. */
function eastSideGallery(site: Site, z0: number, z1: number) {
  const colors = ['#e94f37', '#f6c85f', '#6fb07f', '#3f88c5', '#b784a7', '#f2efe6', '#ff9f1c', '#2ec4b6']
  const r = random(37)
  for (let z = z0; z < z1; z += 0.1) {
    const x = centre(z) + half(z) + 0.22
    site.b.add(materials.clay, paint(new RoundedBoxGeometry(0.025, 0.13, 0.1, 1, 0.004), colors[Math.floor(r() * colors.length)], 0.2, 0.1), x, GROUND + 0.065, z)
  }
  site.block((bx, bz, rad) => bz > z0 - 0.1 && bz < z1 + 0.1 && Math.abs(bx - (centre(bz) + half(bz) + 0.22)) < 0.08 + rad)
}

/** Tempelhofer Feld: the old airport's runways, where kites fly on windy days. */
function tempelhof(site: Site) {
  const { x, z, a, c } = TEMPELHOF
  site.block((bx, bz, r) => ((bx - x) / (a + r)) ** 2 + ((bz - z) / (c + r)) ** 2 < 1)
  for (const [dz, rot] of [[-0.2, 0.12], [0.22, 0.12]]) {
    site.b.add(materials.clay, paint(new RoundedBoxGeometry(1.7, 0.012, 0.12, 1, 0.004), '#a9a8a2', 0), x, GROUND + 0.004, z + dz, rot)
  }
  const colors = ['#e94f37', '#3f88c5', '#f6c85f', '#6fb07f']
  const shape = new THREE.Shape([new THREE.Vector2(0, 0.08), new THREE.Vector2(0.05, 0), new THREE.Vector2(0, -0.07), new THREE.Vector2(-0.05, 0)])
  const kites = colors.map((color, i) => {
    const kite = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: 0.7 }))
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: '#e8e4dc' }))
    const anchor = new THREE.Vector3(x - 0.6 + i * 0.4, GROUND + 0.03, z + (i % 2 ? 0.3 : -0.35))
    site.group.add(kite, line)
    return { kite, line, anchor, phase: i * 1.9 }
  })
  let flying = 0
  site.animate((t, wind, m) => {
    flying += ((wind.length() > 4 && m.rain < 0.1 ? 1 : 0) - flying) * 0.02
    for (const k of kites) {
      k.kite.visible = k.line.visible = flying > 0.01
      if (!k.kite.visible) continue
      const drift = wind.clone().normalize().multiplyScalar(0.5)
      const lift = 0.9 + 0.3 * Math.sin(t * 0.7 + k.phase)
      k.kite.position.set(k.anchor.x + drift.x + 0.08 * Math.sin(t * 1.3 + k.phase), k.anchor.y + lift * flying, k.anchor.z + drift.y + 0.08 * Math.cos(t * 1.1 + k.phase))
      k.kite.lookAt(k.anchor.x, k.kite.position.y, k.anchor.z)
      k.kite.rotation.z += 0.3 * Math.sin(t * 2 + k.phase)
      const pos = k.line.geometry.attributes.position
      pos.setXYZ(0, k.anchor.x, k.anchor.y, k.anchor.z)
      pos.setXYZ(1, k.kite.position.x, k.kite.position.y - 0.05, k.kite.position.z)
      pos.needsUpdate = true
    }
  })
}

export function buildBerlin() {
  return buildIsland({
    seed: 89,
    centre,
    half,
    water: '#4f7f8a',
    // The Tiergarten, west of the Gate.
    parks: [{ x: -3.5, z: -0.3, a: 1, c: 1.5, h: 0 }],
    houses: {
      count: 115,
      walls: ['#e6d9c3', '#d9c7a5', '#cfc3b0', '#e8e0d0', '#c9b79c', '#b8b1a6', '#eadfcb'],
      roofs: ['#8a5a44', '#6b6f75'],
      pitched: 0.35,
      pitch: 0.5,
      width: [0.26, 0.46],
      // Berlin's blocks keep to one eaves height, about five storeys.
      floors: (r) => 3 + Math.floor(r() * 2.2),
    },
    trees: { count: 45, park: 40, greens: ['#6f9a52', '#7ea85c', '#5f8a4a'], cypress: 0 },
    landmarks(site) {
      museumIsland(site)
      fernsehturm(site, centre(-0.9) + half(-0.9) + 1.4, -0.9)
      brandenburgGate(site, -2.3, -0.4)
      reichstag(site, -2.3, -1.65)
      siegessaule(site, -3.5, -0.3)
      oberbaumbrucke(site, 2.9)
      eastSideGallery(site, 1.2, 2.6)
      tempelhof(site)
      boat(
        site,
        (s) => {
          const bz = -3 + 5.4 * s
          return [centre(bz) + 0.66 * (1 - THREE.MathUtils.smoothstep(Math.abs(bz - ISLAND), 1, 1.6)), bz]
        },
        40,
        '#f1eee6',
        '#2f5a8a',
        0.8,
      )
    },
  })
}
