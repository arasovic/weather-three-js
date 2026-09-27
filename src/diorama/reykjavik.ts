import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { GROUND, house, materials, paint, random } from './kit'
import { BASE, TAU, boat, buildIsland, footing, gable, hip, islet, placer, rim, strut, type Moment, type Site } from './island'

// The town lines the shore of the bay, and Mount Esja rises from the water along
// the far edge. Water on the islands runs north to south, so the bay lies to the east.
const shore = (z: number) => 2 + 0.2 * Math.sin(0.4 * z + 0.6)
// The bay is a band of water reaching past the rim, which leaves land on the west only.
const BAY = 5
const centre = (z: number) => shore(z) + BAY
const half = () => BAY
const OSKJUHLID = { x: -3, z: 2.5, a: 1, c: 0.9, h: 0.35 }
const CONCRETE = '#dcdad4'

/** Hallgrímskirkja: a tower flanked by columns stepping down like basalt, the nave behind. */
function hallgrimskirkja(site: Site, x: number, z: number) {
  // The plinth runs under the tower and the nave behind it.
  const put = placer(site.b, x, footing(site, x - 0.45, z, 1.2, 1, '#c4bfb5'), z)
  const at = (g: THREE.BufferGeometry, lx: number, lz = 0) => (g.translate(lx, 0, lz), g)
  put(at(new RoundedBoxGeometry(0.9, 0.36, 0.34, 2, 0.02), -0.55), CONCRETE, 0.18, 0.3)
  put(at(gable(0.92, 0.3, 0.36), -0.55), '#6f747a', 0.36)
  put(new RoundedBoxGeometry(0.2, 1.5, 0.2, 2, 0.015), CONCRETE, 0.75, 0.3)
  put(new RoundedBoxGeometry(0.13, 0.2, 0.13, 1, 0.01), CONCRETE, 1.6)
  put(hip(0.13, 0.32), '#c9c6bf', 1.7)
  for (let k = 0; k < 4; k++) {
    const face = new THREE.CylinderGeometry(0.035, 0.035, 0.01, 16)
    face.rotateX(Math.PI / 2)
    face.translate(0, 0, 0.102)
    face.rotateY((k * Math.PI) / 2)
    put(face, '#f3efe4', 1.35, 0)
  }
  const w = 0.055
  for (const side of [-1, 1]) {
    for (let k = 1; k <= 6; k++) {
      const h = 0.12 + 1.15 * (1 - k / 7) ** 1.3
      put(at(new RoundedBoxGeometry(0.16, h, w, 1, 0.01), 0, side * (0.1 + (k - 0.5) * w)), CONCRETE, h / 2, 0.3)
    }
  }
}

/** Harpa: a glass block on the harbour whose honeycomb facade changes colour at night. */
function harpa(site: Site, x: number, z: number) {
  // Local x runs along the quay, the roof sloping down to the north; the front faces the water.
  const len = 0.7
  const roof = (lx: number) => 0.35 - 0.2 * lx
  const shape = new THREE.Shape([new THREE.Vector2(-len / 2, 0), new THREE.Vector2(len / 2, 0), new THREE.Vector2(len / 2, roof(len / 2)), new THREE.Vector2(-len / 2, roof(-len / 2))])
  const body = new THREE.ExtrudeGeometry(shape, { depth: 0.5, bevelEnabled: false })
  body.translate(0, 0, -0.25)
  site.b.add(materials.leds, paint(body, '#7a93a8', 0.1, 0.2), x, GROUND - 0.02, z, Math.PI / 2)
  const put = placer(site.b, x, GROUND - 0.02, z, Math.PI / 2)
  const frame = '#3a434c'
  for (let lx = -len / 2 + 0.07; lx < len / 2; lx += 0.07) {
    const bar = new THREE.BoxGeometry(0.012, roof(lx), 0.012)
    bar.translate(lx, roof(lx) / 2, 0.253)
    put(bar, frame, 0, 0)
  }
  for (const y of [0.07, 0.14, 0.21]) {
    const bar = new THREE.BoxGeometry(len, 0.012, 0.012)
    bar.translate(0, y, 0.253)
    put(bar, frame, 0, 0)
  }
  site.reserve(x, z, 0.45)
}

/** Sun Voyager, a steel dreamboat on the shore path. */
function sunVoyager(site: Site, x: number, z: number) {
  const put = placer(site.b, x, GROUND - 0.02, z, Math.PI / 2)
  const steel = '#c3c8cc'
  put(new RoundedBoxGeometry(0.36, 0.03, 0.12, 1, 0.01), '#8d8a86', 0.015, 0.2)
  const keel = (lx: number) => 0.06 + 0.1 * (lx / 0.17) ** 4
  const pts = Array.from({ length: 13 }, (_, i) => {
    const lx = -0.17 + (0.34 * i) / 12
    return new THREE.Vector3(lx, keel(lx), 0)
  })
  put(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.008, 5), steel, 0, 0)
  for (let i = -3; i <= 3; i++) {
    const lx = i * 0.045
    for (const s of [-1, 1]) put(strut(new THREE.Vector3(lx, keel(lx), 0), new THREE.Vector3(lx * 1.15, keel(lx) + 0.1 - Math.abs(lx) * 0.25, s * 0.035), 0.005, 0.003, 4), steel, 0, 0)
  }
  site.reserve(x, z, 0.12)
}

/** Perlan: a glass dome on six hot-water tanks, on top of the wooded hill. */
function perlan(site: Site, x: number, z: number) {
  const put = placer(site.b, x, footing(site, x, z, 0.6, 0.6, '#b9bdc1', 0, true), z)
  for (let k = 0; k < 6; k++) {
    const tank = new THREE.CylinderGeometry(0.08, 0.08, 0.2, 16)
    tank.translate(Math.cos((k / 6) * TAU) * 0.2, 0, Math.sin((k / 6) * TAU) * 0.2)
    put(tank, '#c8ccd0', 0.1, 0.25)
  }
  put(new THREE.CylinderGeometry(0.3, 0.3, 0.03, 24), '#b9bdc1', 0.215, 0)
  put(new THREE.SphereGeometry(0.2, 24, 10, 0, TAU, 0, Math.PI / 2), '#9ab6c8', 0.23, 0)
  site.reserve(x, z, 0.34)
}

/**
 * Mount Esja across the bay: a long, flat-topped ridge that follows the island's
 * edge, its face towards the town cut by gullies and falling straight into the
 * water. From November to April snow lies on the top, while the cliffs stay bare.
 */
function esja(site: Site) {
  const nu = 90
  const nv = 24
  const [a0, a1] = [-1.05, 0.25]
  const position: number[] = []
  const index: number[] = []
  for (let i = 0; i <= nu; i++) {
    const u = i / nu
    const a = a0 + (a1 - a0) * u
    const outer = rim(a) * 0.95
    const ends = THREE.MathUtils.smoothstep(u, 0, 0.18) * (1 - THREE.MathUtils.smoothstep(u, 0.82, 1))
    const top = 1 + 0.05 * Math.sin(u * 11) + 0.03 * Math.sin(u * 29)
    for (let j = 0; j <= nv; j++) {
      const v = j / nv
      const r = outer - 1.4 * (1 - v)
      const rise = THREE.MathUtils.smoothstep(v, 0, 0.4) * (1 - THREE.MathUtils.smoothstep(v, 0.85, 1))
      const gully = Math.max(0, Math.sin(u * 47)) ** 3 * Math.exp(-(((v - 0.22) / 0.12) ** 2))
      position.push(Math.cos(a) * r, BASE - 0.03 + top * ends * rise * (1 - 0.35 * gully), Math.sin(a) * r)
      const k = i * (nv + 1) + j
      if (i < nu && j < nv) index.push(k, k + nv + 1, k + 1, k + 1, k + nv + 1, k + nv + 2)
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(position, 3))
  geo.setIndex(index)
  geo.computeVertexNormals()
  const pos = geo.attributes.position
  const normal = geo.attributes.normal
  const summer = new Float32Array(pos.count * 3)
  const winter = new Float32Array(pos.count * 3)
  const [moss, rock, snow, c] = [new THREE.Color('#93a070'), new THREE.Color('#7d766e'), new THREE.Color('#eef2f4'), new THREE.Color()]
  const snowline = BASE + 0.62
  for (let i = 0; i < pos.count; i++) {
    c.lerpColors(rock, moss, THREE.MathUtils.smoothstep(normal.getY(i), 0.55, 0.85)).toArray(summer, i * 3)
    const cover = THREE.MathUtils.smoothstep(pos.getY(i), snowline - 0.08, snowline + 0.04) * THREE.MathUtils.smoothstep(normal.getY(i), 0.3, 0.6)
    c.lerp(snow, cover).toArray(winter, i * 3)
  }
  const color = new THREE.BufferAttribute(summer.slice(), 3)
  geo.setAttribute('color', color)
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2))
  const mesh = new THREE.Mesh(geo, materials.clay)
  mesh.castShadow = mesh.receiveShadow = true
  site.group.add(mesh)
  let snowy: boolean | undefined
  site.animate((_t, _wind, m) => {
    const now = m.month >= 11 || m.month <= 4
    if (now === snowy) return
    snowy = now
    color.set(now ? winter : summer)
    color.needsUpdate = true
  })
}

/** Lit from John Lennon's birthday to the day he died, over the winter holidays and around the spring equinox. */
const peaceNight = (m: Moment) =>
  (m.month === 10 && m.date >= 9) ||
  m.month === 11 ||
  (m.month === 12 && (m.date <= 8 || m.date >= 21)) ||
  (m.month === 3 && m.date >= 20 && m.date <= 27)

/** Viðey with Imagine Peace Tower: a column of light rising from the island on those evenings. */
function videy(site: Site, x: number, z: number) {
  const top = islet(site, x, z, 0.62, 0.42, 0.3)
  const put = placer(site.b, x, top, z)
  put(new THREE.CylinderGeometry(0.08, 0.09, 0.05, 16), '#e9e6de', 0.025, 0.2)
  house(site.b, x + 0.17, top - 0.01, z + 0.06, 0.3, 0.2, 0.12, 1, '#f2efe8', '#3b3b3b', random(5), 1.2)
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.05, 12, 12, 1, true).translate(0, 6, 0),
    new THREE.MeshBasicMaterial({ color: '#dde6ff', transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }),
  )
  beam.position.set(x, top + 0.05, z)
  beam.visible = false
  site.group.add(beam)
  // From dusk until midnight, and on through New Year's night.
  site.animate((_t, _wind, m) => {
    beam.visible = m.night > 0.5 && ((peaceNight(m) && m.hour >= 12) || (m.month === 1 && m.date === 1 && m.hour < 6))
  })
}

/**
 * Northern lights on clear, dark nights: folded green curtains, violet at the top,
 * hanging in rings around the island. Only the part beyond the island shows, so
 * they stay behind it as the view turns.
 */
function aurora(site: Site) {
  const n = 240
  const position: number[] = []
  const uv: number[] = []
  const index: number[] = []
  for (const [radius, y0, y1, phase] of [[11, 0.4, 6.5, 0], [13.5, 1.4, 7.5, 0.37]]) {
    const base = position.length / 3
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * TAU
      for (const [y, v] of [[y0, 0], [y1, 1]]) {
        position.push(Math.cos(a) * radius, y, Math.sin(a) * radius)
        uv.push(i / n + phase, v)
      }
      const k = base + i * 2
      if (i < n) index.push(k, k + 2, k + 1, k + 1, k + 2, k + 3)
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(position, 3))
  geo.setAttribute('aUv', new THREE.Float32BufferAttribute(uv, 2))
  geo.setIndex(index)
  const uniforms = { uTime: { value: 0 }, uIntensity: { value: 0 } }
  const mesh = new THREE.Mesh(
    geo,
    new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        attribute vec2 aUv;
        uniform float uTime;
        varying vec2 vUv;
        varying float vFar;
        void main() {
          vUv = aUv;
          vec3 p = position;
          float u = aUv.x * 6.2832;
          p.xz += normalize(p.xz) * (0.9 * sin(u * 7.0 + uTime * 0.2) + 0.3 * sin(u * 19.0 - uTime * 0.35));
          // The lower edge rises and falls along the curtain; the top sways.
          p.y += (1.0 - aUv.y) * (0.9 * sin(u * 3.0 + uTime * 0.06) + 0.4 * sin(u * 8.0 - uTime * 0.1));
          p.y += aUv.y * 0.6 * sin(u * 5.0 + uTime * 0.15);
          vec4 world = modelMatrix * vec4(p, 1.0);
          vFar = smoothstep(0.05, 0.55, dot(normalize(world.xz), -normalize(cameraPosition.xz)));
          gl_Position = projectionMatrix * viewMatrix * world;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uIntensity;
        varying vec2 vUv;
        varying float vFar;
        void main() {
          float u = vUv.x * 6.2832;
          float v = vUv.y;
          float rays = 0.65 + 0.35 * (0.5 * sin(u * 57.0 + 2.0 * sin(u * 7.0 + uTime * 0.3)) + 0.3 * sin(u * 131.0 + uTime * 0.8) + 0.2 * sin(u * 23.0 - uTime * 0.2));
          // Brightest in a band along the lower edge, with a long faint tail above.
          float glow = smoothstep(0.0, 0.05, v) * (0.25 * (1.0 - v) + 0.75 * exp(-v * 5.0));
          float patches = smoothstep(0.1, 0.9, 0.5 + 0.5 * sin(u * 2.0 + uTime * 0.05) * sin(u * 3.7 - uTime * 0.03 + 1.3) + 0.3 * sin(u * 9.0 + uTime * 0.11));
          vec3 col = mix(vec3(0.2, 1.0, 0.55), vec3(0.6, 0.25, 0.9), smoothstep(0.4, 1.0, v));
          gl_FragColor = vec4(col * rays * glow * patches * vFar * uIntensity, 1.0);
        }`,
    }),
  )
  mesh.frustumCulled = false
  mesh.visible = false
  site.group.add(mesh)
  let shown = 0
  site.animate((t, _wind, m) => {
    shown += ((m.night > 0.7 && m.clear > 0.5 ? 1 : 0) - shown) * 0.01
    mesh.visible = shown > 0.01
    uniforms.uTime.value = t
    uniforms.uIntensity.value = shown * (0.8 + 0.4 * Math.sin(t * 0.05))
  })
}

export function buildReykjavik() {
  const harbourZ = -1.6
  return buildIsland({
    seed: 53,
    centre,
    half,
    grass: '#9fb07a',
    water: '#3f7890',
    // Skólavörðuholt under the church, Öskjuhlíð under Perlan, and Esja across the bay.
    hills: [{ x: -1.6, z: 0.4, a: 1.1, c: 1, h: 0.32 }, OSKJUHLID],
    parks: [{ x: OSKJUHLID.x, z: OSKJUHLID.z, a: 0.9, c: 0.8, h: 0 }],
    houses: {
      count: 160,
      walls: ['#f2efe6', '#e8d27a', '#c9483b', '#6d8fb3', '#e9e1d0', '#9bb8a0', '#e3a25a'],
      roofs: ['#c0392b', '#2f6f5e', '#3d5a80', '#7b3b3b', '#555b63'],
      pitched: 0.85,
      pitch: 1.1,
      width: [0.2, 0.36],
      floors: (r) => 1 + Math.floor(r() * r() * 3),
    },
    trees: { count: 10, park: 30, greens: ['#6f8f55', '#7e9a5e', '#5f7f4a'], cypress: 0 },
    landmarks(site) {
      esja(site)
      hallgrimskirkja(site, -1.15, 0.4)
      site.reserve(-1.6, 0.4, 0.66)
      harpa(site, shore(0.6) - 0.4, 0.6)
      sunVoyager(site, shore(-0.9) - 0.16, -0.9)
      perlan(site, OSKJUHLID.x, OSKJUHLID.z)
      videy(site, 2.9, -2.4)
      aurora(site)
      boat(site, (s) => [shore(harbourZ + 3.4 * s) + 0.45, harbourZ + 3.4 * s], 44, '#2f3b4a', '#e8e4da', 0.9)
    },
  })
}
