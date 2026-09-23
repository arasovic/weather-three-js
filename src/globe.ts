import * as THREE from 'three'
import { geoEquirectangular, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import type { Topology } from 'topojson-specification'
import land110 from 'world-atlas/land-110m.json'
import type { City } from './cities'

const RAD = Math.PI / 180
const UP = new THREE.Vector3(0, 1, 0)

/** Matches the UV layout of SphereGeometry, so an equirectangular map lines up. */
export function toVector(lat: number, lon: number, out = new THREE.Vector3()) {
  return out.set(Math.cos(lat * RAD) * Math.cos(lon * RAD), Math.sin(lat * RAD), -Math.cos(lat * RAD) * Math.sin(lon * RAD))
}

/** Where the sun is overhead right now, as a unit vector. */
function subsolar(now: Date, out: THREE.Vector3) {
  const start = Date.UTC(now.getUTCFullYear(), 0, 0)
  const day = (now.getTime() - start) / 86_400_000
  const declination = -23.44 * Math.cos((2 * Math.PI * (day + 10)) / 365)
  const hours = now.getUTCHours() + now.getUTCMinutes() / 60
  return toVector(declination, (12 - hours) * 15, out)
}

/** Colour, relief and shine maps drawn from the world outline, in the island's clay palette. */
function maps() {
  const w = 2048
  const h = 1024
  const land = feature(land110 as unknown as Topology, (land110 as unknown as Topology).objects.land)
  const projection = geoEquirectangular().scale(w / (2 * Math.PI)).translate([w / 2, h / 2])
  const canvas = (draw: (g: CanvasRenderingContext2D, path: ReturnType<typeof geoPath>) => void) => {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const g = c.getContext('2d')!
    draw(g, geoPath(projection, g))
    return c
  }
  const color = canvas((g, path) => {
    g.fillStyle = '#3f8ea3'
    g.fillRect(0, 0, w, h)
    g.beginPath()
    path(land)
    g.fillStyle = '#9fb574'
    g.fill()
    g.strokeStyle = '#d6c6a6'
    g.lineWidth = 2
    g.stroke()
    // Ice caps: whiten the land nearest the poles.
    g.clip()
    g.fillStyle = '#e9eef0'
    g.fillRect(0, 0, w, (h * 18) / 180)
    g.fillRect(0, (h * 152) / 180, w, h)
  })
  const relief = canvas((g, path) => {
    g.fillStyle = '#000'
    g.fillRect(0, 0, w, h)
    g.filter = 'blur(3px)'
    g.beginPath()
    path(land)
    g.fillStyle = '#fff'
    g.fill()
  })
  const shine = canvas((g, path) => {
    g.fillStyle = '#8a8a8a'
    g.fillRect(0, 0, w, h)
    g.beginPath()
    path(land)
    g.fillStyle = '#eee'
    g.fill()
  })
  const tex = (c: HTMLCanvasElement, srgb = false) => {
    const t = new THREE.CanvasTexture(c)
    if (srgb) t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 4
    return t
  }
  return { color: tex(color, true), relief: tex(relief), shine: tex(shine) }
}

const COLD = new THREE.Color('#7fb0dc')
const MILD = new THREE.Color('#f3ead6')
const WARM = new THREE.Color('#ec8a4a')

function tempColor(t: number | undefined, out: THREE.Color) {
  if (t === undefined) return out.copy(MILD)
  return t < 15 ? out.lerpColors(COLD, MILD, THREE.MathUtils.clamp((t + 5) / 20, 0, 1)) : out.lerpColors(MILD, WARM, THREE.MathUtils.clamp((t - 15) / 20, 0, 1))
}

/** Horizontal gap between a pin and its label, which is also the label's padding. */
const PAD = 10

type Box = [number, number, number, number]
const SIDES = ['right', 'left', 'above', 'below'] as const
type Side = (typeof SIDES)[number]

/** Where a label's text lands for each side; the text is about 18px tall. */
function box({ x, y, width }: { x: number; y: number; width: number }, side: Side): Box {
  if (side === 'right') return [x + 2 * PAD, y - 9, x + 2 * PAD + width, y + 9]
  if (side === 'left') return [x - 2 * PAD - width, y - 9, x - 2 * PAD, y + 9]
  const cy = side === 'above' ? y - 22 : y + 22
  return [x - width / 2, cy - 9, x + width / 2, cy + 9]
}
const covered = (a: Box, others: Box[]) =>
  others.reduce((sum, b) => sum + Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1])), 0)

export function createGlobe(places: City[], layer: HTMLElement, onPick: (i: number) => void) {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#0b1530')

  const { color, relief, shine } = maps()
  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(1, 128, 64),
    new THREE.MeshStandardMaterial({ map: color, bumpMap: relief, bumpScale: 4, roughnessMap: shine, roughness: 1 }),
  )
  scene.add(earth)

  const sun = new THREE.DirectionalLight(0xfff1dc, 2.8)
  const sky = new THREE.HemisphereLight(0x9fb4e6, 0x2a3a6e, 0.75)
  scene.add(sun, sky)

  // A thin glow at the rim, stronger on the day side.
  const sunDir = new THREE.Vector3()
  const haze = new THREE.Mesh(
    new THREE.SphereGeometry(1.045, 64, 32),
    new THREE.ShaderMaterial({
      uniforms: { uSun: { value: sunDir } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        varying vec3 vNormal;
        varying vec3 vView;
        void main() {
          vNormal = normalize(position);
          vView = normalize(cameraPosition - position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uSun;
        varying vec3 vNormal;
        varying vec3 vView;
        void main() {
          float rim = pow(1.0 - max(dot(vNormal, vView), 0.0), 4.0);
          float lit = smoothstep(-0.35, 0.4, dot(vNormal, uSun));
          gl_FragColor = vec4(vec3(0.5, 0.75, 1.0) * rim * (0.15 + 0.85 * lit), 1.0);
        }`,
    }),
  )
  scene.add(haze)

  const stars = new THREE.BufferGeometry()
  {
    const p = new Float32Array(1500 * 3)
    const v = new THREE.Vector3()
    for (let i = 0; i < 1500; i++) v.randomDirection().multiplyScalar(60).toArray(p, i * 3)
    stars.setAttribute('position', new THREE.BufferAttribute(p, 3))
  }
  scene.add(new THREE.Points(stars, new THREE.PointsMaterial({ color: 0xdfe6ff, size: 1.4, sizeAttenuation: false, transparent: true, opacity: 0.7 })))

  // Pins: a clay stick with a head coloured by the temperature, and an HTML label.
  const pins = places.map((city, i) => {
    const normal = toVector(city.lat, city.lon)
    const head = new THREE.MeshStandardMaterial({ color: MILD, roughness: 0.6 })
    const pin = new THREE.Group()
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.07, 6), new THREE.MeshStandardMaterial({ color: 0xf4f1ea }))
    stick.position.y = 0.035
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.02, 16, 12), head)
    ball.position.y = 0.075
    pin.add(stick, ball)
    pin.position.copy(normal)
    pin.quaternion.setFromUnitVectors(UP, normal)
    scene.add(pin)

    const label = document.createElement('button')
    label.type = 'button'
    label.className = 'pin'
    label.innerHTML = '<span class="pin-name"></span><span class="pin-temp"></span>'
    label.querySelector('.pin-name')!.textContent = city.name
    label.addEventListener('click', () => onPick(i))
    label.addEventListener('pointerenter', () => ball.scale.setScalar(1.35))
    label.addEventListener('pointerleave', () => ball.scale.setScalar(1))
    label.addEventListener('focus', () => ball.scale.setScalar(1.35))
    label.addEventListener('blur', () => ball.scale.setScalar(1))
    layer.appendChild(label)
    return { pin, normal, head, ball, label, shown: true, x: 0, y: 0, side: 'right' as Side, width: 0 }
  })

  document.fonts.ready.then(() => pins.forEach((p) => (p.width = 0)))

  const tip = new THREE.Vector3()
  const toCamera = new THREE.Vector3()
  let sunAt = -Infinity

  return {
    scene,
    normal: (i: number) => pins[i].normal,
    setTemps(temps: (number | undefined)[]) {
      pins.forEach((p, i) => {
        tempColor(temps[i], p.head.color)
        p.head.emissive.copy(p.head.color).multiplyScalar(0.3)
        p.width = 0
        p.label.querySelector('.pin-temp')!.textContent = temps[i] === undefined ? '' : `${Math.round(temps[i]!)}°`
        p.label.setAttribute('aria-label', temps[i] === undefined ? `Visit ${places[i].name}` : `Visit ${places[i].name}, ${Math.round(temps[i]!)}°`)
      })
    },
    update(camera: THREE.PerspectiveCamera, now: Date, time: number, labels: number) {
      if (time - sunAt > 30) {
        subsolar(now, sunDir)
        sun.position.copy(sunDir).multiplyScalar(10)
        sunAt = time
      }
      const w = innerWidth
      const h = innerHeight
      for (const p of pins) {
        tip.copy(p.normal).multiplyScalar(1.09)
        const facing = toCamera.copy(camera.position).sub(tip).normalize().dot(p.normal)
        p.pin.visible = facing > 0.1
        p.pin.scale.setScalar(Math.max(labels, 0.001))
        const alpha = THREE.MathUtils.smoothstep(facing, 0.12, 0.35) * labels
        const shown = alpha > 0.3
        if (shown !== p.shown) {
          p.shown = shown
          p.label.disabled = !shown
        }
        tip.copy(p.normal).multiplyScalar(1.075).project(camera)
        p.x = ((tip.x + 1) / 2) * w
        p.y = ((1 - tip.y) / 2) * h
        p.label.style.opacity = alpha.toFixed(3)
      }
      // Each label takes the side of its pin that covers the fewest other labels and
      // pins, keeping its current side on a tie so labels do not flicker.
      const shown = pins.filter((p) => p.shown)
      const dots: Box[] = shown.map((p) => [p.x - 7, p.y - 7, p.x + 7, p.y + 7])
      for (const p of shown) p.width ||= p.label.offsetWidth - 2 * PAD
      for (let pass = 0; pass < 3; pass++)
        for (const p of shown) {
          const others = [...dots, ...shown.filter((o) => o !== p).map((o) => box(o, o.side))]
          let best = Infinity
          for (const side of SIDES) {
            const b = box(p, side)
            const outside = (Math.max(0, -b[0]) + Math.max(0, b[2] - w)) * 18
            const cost = covered(b, others) + outside + (side === p.side ? 0 : 1)
            if (cost < best) [best, p.side] = [cost, side]
          }
        }
      for (const p of pins) {
        p.label.dataset.side = p.side
        p.label.style.transform = `translate(${p.x}px, ${p.y}px)`
      }
    },
  }
}
