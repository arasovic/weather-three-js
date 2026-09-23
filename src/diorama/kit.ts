import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

/** Height of the grass surface; everything on the island stands on it. */
export const GROUND = 0.41

/** Uniforms shared by every island material, driven by the weather each frame. */
export const world = {
  uTime: { value: 0 },
  uWind: { value: new THREE.Vector2() }, // m/s along world x and z
  uSnow: { value: 0 }, // 0-1, snow lying on upward-facing surfaces
  uGlow: { value: 0 }, // 0-1, night floodlighting on landmarks
}

export function random(seed: number) {
  let s = seed
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

// ---- Materials --------------------------------------------------------------

/**
 * Adds snow cover to every material, plus wind sway for trees and floodlight
 * glow for landmarks. Merged meshes keep an identity transform, so object space
 * is world space in the vertex shader.
 */
function extend(mat: THREE.MeshStandardMaterial, opts: { sway?: boolean; glow?: boolean } = {}) {
  mat.customProgramCacheKey = () => `island-${opts.sway}-${opts.glow}`
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, world)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform vec2 uWind;\nvarying float vUp;')
      .replace(
        '#include <beginnormal_vertex>',
        '#include <beginnormal_vertex>\nvUp = normalize(mat3(modelMatrix) * objectNormal).y;',
      )
      .replace(
        '#include <begin_vertex>',
        opts.sway
          ? `#include <begin_vertex>
{
  float lift = max(transformed.y - ${GROUND.toFixed(3)}, 0.0);
  float gust = 0.65 + 0.35 * sin(uTime * 1.9 + transformed.x * 1.7 + transformed.z * 1.3);
  transformed.xz += uWind * 0.02 * gust * lift * lift;
}`
          : '#include <begin_vertex>',
      )
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uSnow;\nuniform float uGlow;\nvarying float vUp;')
      .replace(
        '#include <color_fragment>',
        '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.92, 0.94, 0.97), uSnow * smoothstep(0.35, 0.75, vUp));',
      )
      .replace(
        '#include <emissivemap_fragment>',
        opts.glow
          ? '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * vec3(1.0, 0.82, 0.6) * uGlow * 0.6;'
          : '#include <emissivemap_fragment>',
      )
  }
  return mat
}

function windowTextures() {
  const size = 256
  const cell = size / 8
  const day = document.createElement('canvas')
  const night = document.createElement('canvas')
  day.width = day.height = night.width = night.height = size
  const d = day.getContext('2d')!
  const n = night.getContext('2d')!
  d.fillStyle = '#fff'
  d.fillRect(0, 0, size, size)
  n.fillStyle = '#000'
  n.fillRect(0, 0, size, size)
  const r = random(11)
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const wx = x * cell + cell * 0.3
      const wy = y * cell + cell * 0.22
      const ww = cell * 0.4
      const wh = cell * 0.48
      d.fillStyle = '#6d7684'
      d.fillRect(wx, wy, ww, wh)
      if (r() < 0.5) {
        n.fillStyle = r() < 0.8 ? '#ffc680' : '#fff0d0'
        n.fillRect(wx, wy, ww, wh)
      }
    }
  }
  const tex = (c: HTMLCanvasElement) => {
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.anisotropy = 4
    return t
  }
  return { day: tex(day), night: tex(night) }
}

const windows = windowTextures()

export const materials = {
  clay: extend(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 })),
  walls: extend(
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.85,
      map: windows.day,
      emissive: 0xffffff,
      emissiveMap: windows.night,
      emissiveIntensity: 0,
    }),
  ),
  trees: extend(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }), { sway: true }),
  landmark: extend(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 }), { glow: true }),
  /** Street lamp heads, lit at night. */
  lamps: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, emissive: 0xffc27a, emissiveIntensity: 0 }),
  /** Colour-changing night lights: bridge cables, skyscraper crowns. */
  leds: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, emissive: 0x000000 }),
}

// ---- Geometry batching ------------------------------------------------------

/**
 * Bakes a colour into vertex colours, darkened towards the part's base: a cheap
 * stand-in for ambient occlusion where things meet the ground.
 */
export function paint(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation, ao = 0.3, reach = 0.3) {
  const c = new THREE.Color(color)
  geo.computeBoundingBox()
  const base = geo.boundingBox!.min.y
  const pos = geo.attributes.position
  const col = new Float32Array(pos.count * 3)
  for (let i = 0; i < pos.count; i++) {
    const t = THREE.MathUtils.smoothstep(pos.getY(i) - base, 0, reach)
    const k = 1 - ao * (1 - t)
    col[i * 3] = c.r * k
    col[i * 3 + 1] = c.g * k
    col[i * 3 + 2] = c.b * k
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
  return geo
}

/** Collects static parts per material and merges them into one mesh each. */
export class Batch {
  private parts = new Map<THREE.Material, THREE.BufferGeometry[]>()

  add(material: THREE.Material, geo: THREE.BufferGeometry, x = 0, y = 0, z = 0, rotY = 0) {
    const g = geo.index ? geo.toNonIndexed() : geo
    g.rotateY(rotY)
    g.translate(x, y, z)
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2))
    const list = this.parts.get(material) ?? []
    list.push(g)
    this.parts.set(material, list)
  }

  build(shadows = true) {
    const group = new THREE.Group()
    for (const [material, list] of this.parts) {
      const mesh = new THREE.Mesh(mergeGeometries(list), material)
      mesh.castShadow = shadows
      mesh.receiveShadow = true
      group.add(mesh)
    }
    return group
  }
}

// ---- Parts ------------------------------------------------------------------

const FLOOR = 0.2

/** A small city block house: rounded walls with windows and a hip or flat roof. */
export function house(
  batch: Batch,
  x: number,
  y: number,
  z: number,
  rot: number,
  w: number,
  d: number,
  floors: number,
  wall: THREE.ColorRepresentation,
  roof: THREE.ColorRepresentation | null,
  r: () => number,
  pitch = 1,
) {
  const h = floors * FLOOR + 0.06
  const body = new RoundedBoxGeometry(w, h, d, 2, 0.035)
  // Stretch window UVs so each face shows whole windows, one row per floor.
  const uv = body.attributes.uv
  const cols = Math.max(1, Math.round(Math.max(w, d) / 0.14))
  const ou = Math.floor(r() * 8) / 8
  const ov = Math.floor(r() * 8) / 8
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (cols / 8) + ou, uv.getY(i) * (floors / 8) + ov)
  paint(body, wall, 0.35, 0.25)
  batch.add(materials.walls, body, x, y + h / 2, z, rot)

  if (roof) {
    const radius = Math.SQRT1_2
    const cap = new THREE.ConeGeometry(radius, 1, 4, 1).toNonIndexed()
    cap.rotateY(Math.PI / 4)
    const rise = (0.16 + Math.min(w, d) * 0.25) * pitch
    cap.scale(w + 0.06, rise, d + 0.06)
    cap.computeVertexNormals()
    paint(cap, roof, 0.15, 0.1)
    batch.add(materials.clay, cap, x, y + h + rise / 2, z, rot)
  } else {
    const cap = new RoundedBoxGeometry(w + 0.04, 0.05, d + 0.04, 1, 0.02)
    paint(cap, '#d9d4cc', 0, 0.01)
    batch.add(materials.clay, cap, x, y + h + 0.02, z, rot)
  }
}

/** A round deciduous tree. */
export function tree(batch: Batch, x: number, y: number, z: number, s: number, green: THREE.ColorRepresentation) {
  const trunk = new THREE.CylinderGeometry(0.025 * s, 0.035 * s, 0.22 * s, 6)
  paint(trunk, '#6b4a33', 0.2, 0.1)
  batch.add(materials.trees, trunk, x, y + 0.11 * s, z)
  const crown = new THREE.SphereGeometry(0.17 * s, 10, 8)
  crown.scale(1, 1.05, 1)
  paint(crown, green, 0.35, 0.25 * s)
  batch.add(materials.trees, crown, x, y + 0.34 * s, z)
}

/** A slim cypress, the dark tree of Istanbul's hillsides and courtyards. */
export function cypress(batch: Batch, x: number, y: number, z: number, s: number) {
  const body = new THREE.SphereGeometry(0.075 * s, 8, 10)
  body.scale(1, 4.2, 1)
  paint(body, '#40603f', 0.35, 0.3 * s)
  batch.add(materials.trees, body, x, y + 0.3 * s, z)
}
