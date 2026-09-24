import * as THREE from 'three'
import { geoEquirectangular, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import type { Topology } from 'topojson-specification'
import land110 from 'world-atlas/land-110m.json'
import type { City } from './cities'
import { icon } from './icons'

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

const textures = new Map<string, THREE.Texture>()

/** An icon drawn in white, so a sprite's colour can tint it. */
function iconTexture(name: string) {
  let texture = textures.get(name)
  if (texture) return texture
  const canvas = Object.assign(document.createElement('canvas'), { width: 128, height: 128 })
  texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const image = new Image()
  image.onload = () => {
    canvas.getContext('2d')!.drawImage(image, 0, 0, 128, 128)
    texture.needsUpdate = true
  }
  image.src = `data:image/svg+xml,${encodeURIComponent(icon(name).replace('<svg ', '<svg width="128" height="128" ').replace('currentColor', '#fff'))}`
  textures.set(name, texture)
  return texture
}

/** Height of a pin's weather icon, in CSS pixels. */
const BADGE = 30

/** Horizontal gap between a pin and its label, which is also the label's padding. */
const PAD = 10

/** Room around a label's text for its shadow, in CSS pixels. */
const MARGIN = 10

/**
 * A city's name and temperature drawn into a texture, so it moves with the globe in the
 * same frame. The text box is 18px tall, with MARGIN around it.
 */
function labelTexture(name: string, temp: string, hot: boolean, flip: boolean) {
  const r = Math.min(Math.max(devicePixelRatio, 2), 3)
  const g = document.createElement('canvas').getContext('2d')!
  const font = (weight: number) => `${weight} 14px 'Hanken Grotesk', system-ui, sans-serif`
  g.font = font(400)
  const nameW = g.measureText(name).width
  g.font = font(300)
  const tempW = temp ? g.measureText(temp).width + 6 : 0
  const width = Math.ceil(nameW + tempW)
  g.canvas.width = (width + 2 * MARGIN) * r
  g.canvas.height = (18 + 2 * MARGIN) * r
  g.scale(r, r)
  g.textBaseline = 'middle'
  const y = MARGIN + 9
  const nameX = MARGIN + (flip ? tempW : 0)
  const tempX = MARGIN + (flip ? 0 : nameW + 6)
  // Two passes: a wide glow cast by dark letters, then the letters with a tight shadow,
  // so the text itself is only drawn once.
  const passes = [
    { blur: 10, shadow: 'rgb(5 10 25 / 0.5)', ink: '#050a19', soft: '#050a19' },
    { blur: 2, shadow: 'rgb(5 10 25 / 0.6)', ink: '#f4f6fb', soft: 'rgb(244 246 251 / 0.72)' },
  ]
  for (const { blur, shadow, ink, soft } of passes) {
    g.shadowColor = shadow
    g.shadowBlur = blur * r
    g.shadowOffsetY = blur === 2 ? r : 0
    g.font = font(400)
    g.fillStyle = ink
    g.fillText(name, nameX, y)
    if (hot) g.fillRect(nameX, y + 9, nameW, 1)
    g.font = font(300)
    g.fillStyle = soft
    if (temp) g.fillText(temp, tempX, y)
  }
  const texture = new THREE.CanvasTexture(g.canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.generateMipmaps = false
  texture.minFilter = THREE.LinearFilter
  return { texture, width }
}

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

  // A soft glow around the rim, strongest at the planet's edge and fading to nothing
  // outward, stronger on the day side. Each fragment works out how close its view ray
  // passes to the centre, so the glow has no hard outer edge.
  const sunDir = new THREE.Vector3()
  const HAZE = 1.05
  const haze = new THREE.Mesh(
    new THREE.SphereGeometry(HAZE, 64, 32),
    new THREE.ShaderMaterial({
      uniforms: { uSun: { value: sunDir } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        varying vec3 vWorld;
        void main() {
          vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uSun;
        varying vec3 vWorld;
        void main() {
          vec3 dir = normalize(vWorld - cameraPosition);
          vec3 nearest = cameraPosition - dir * dot(cameraPosition, dir);
          float b = length(nearest);
          float fade = clamp((b - 1.0) / ${(HAZE - 1).toFixed(3)}, 0.0, 1.0);
          float glow = smoothstep(0.97, 1.0, b) * (1.0 - fade) * (1.0 - fade);
          float lit = smoothstep(-0.35, 0.4, dot(nearest / b, uSun));
          gl_FragColor = vec4(vec3(0.5, 0.75, 1.0) * 0.4 * glow * (0.08 + 0.92 * lit), 1.0);
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

  // Pins: a clay stick topped by the city's weather, tinted by its temperature, and a label.
  // The head is a plain ball until the weather arrives. The label is drawn in the scene;
  // an invisible button over it takes clicks and keyboard focus.
  // Pins of cities close together (London and Paris) lean apart on longer sticks, like
  // map pins pushed in at an angle, so their heads stay far enough apart to tap.
  const normals = places.map((c) => toVector(c.lat, c.lon))
  const pins = places.map((city, i) => {
    const normal = normals[i]
    const lean = new THREE.Vector3()
    for (const other of normals) {
      if (other === normal || normal.angleTo(other) > 0.15) continue
      const away = normal.clone().sub(other)
      lean.add(away.addScaledVector(normal, -away.dot(normal)).normalize())
    }
    const length = lean.lengthSq() ? 0.11 : 0.07
    const axis = normal.clone().add(lean.normalize()).normalize()
    const head = new THREE.MeshStandardMaterial({ color: MILD, roughness: 0.6 })
    const pin = new THREE.Group()
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, length, 6), new THREE.MeshStandardMaterial({ color: 0xf4f1ea }))
    stick.position.y = length / 2
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.02, 16, 12), head)
    const badge = new THREE.Sprite(new THREE.SpriteMaterial({ sizeAttenuation: false, depthTest: false, toneMapped: false }))
    badge.visible = false
    const text = new THREE.Sprite(new THREE.SpriteMaterial({ sizeAttenuation: false, depthTest: false, toneMapped: false }))
    for (const o of [ball, badge, text]) o.position.y = length + 0.005
    pin.add(stick, ball, badge, text)
    pin.position.copy(normal)
    pin.quaternion.setFromUnitVectors(UP, axis)
    scene.add(pin)
    const top = normal.clone().addScaledVector(axis, length + 0.005)

    const label = document.createElement('button')
    label.type = 'button'
    label.className = 'pin'
    label.innerHTML = '<span class="pin-name"></span><span class="pin-temp"></span>'
    label.querySelector('.pin-name')!.textContent = city.name
    label.addEventListener('click', () => onPick(i))
    label.addEventListener('pointerenter', () => hover(i))
    label.addEventListener('pointerleave', () => hover(-1))
    label.addEventListener('focus', () => hover(i))
    label.addEventListener('blur', () => hover(-1))
    layer.appendChild(label)
    return { pin, normal, top, head, ball, badge, text, drawn: '', temp: '', hot: false, label, shown: true, x: 0, y: 0, side: 'right' as Side, width: 0 }
  })

  /** Highlights one pin, its head and its name together; -1 clears it. */
  function hover(i: number) {
    pins.forEach((p, j) => {
      p.hot = i === j
      p.ball.scale.setScalar(p.hot ? 1.35 : 1)
    })
  }

  /** Redraws a label's texture when its text, hover or reading order changes. */
  function draw(p: (typeof pins)[number], name: string) {
    const flip = p.side === 'left'
    const key = `${p.temp}|${p.hot}|${flip}|${document.fonts.status}`
    if (key === p.drawn) return
    p.drawn = key
    const { texture, width } = labelTexture(name, p.temp, p.hot, flip)
    p.text.material.map?.dispose()
    p.text.material.map = texture
    p.text.material.needsUpdate = true
    p.width = width
  }

  const tip = new THREE.Vector3()
  const toCamera = new THREE.Vector3()
  let sunAt = -Infinity

  return {
    scene,
    normal: (i: number) => pins[i].normal,
    /** The pin whose head is nearest a screen point, within a finger's reach. */
    pinAt(x: number, y: number, reach = 24) {
      let best = -1
      let bestD = reach
      pins.forEach((p, i) => {
        const d = Math.hypot(p.x - x, p.y - y)
        if (p.shown && d < bestD) [best, bestD] = [i, d]
      })
      return best
    },
    hover,
    setWeather(temps: (number | undefined)[], icons: (string | undefined)[]) {
      pins.forEach((p, i) => {
        tempColor(temps[i], p.head.color)
        p.head.emissive.copy(p.head.color).multiplyScalar(0.3)
        const name = icons[i]
        if (name) p.badge.material.map = iconTexture(name)
        p.badge.material.color.copy(p.head.color)
        p.badge.material.needsUpdate = true
        p.badge.visible = !!name
        p.ball.visible = !name
        p.temp = temps[i] === undefined ? '' : `${Math.round(temps[i]!)}°`
        p.label.querySelector('.pin-temp')!.textContent = p.temp
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
      // A sprite that ignores distance is sized in clip space; this turns pixels into that.
      const perPixel = 2 / (h * camera.projectionMatrix.elements[5])
      for (const p of pins) {
        p.badge.scale.setScalar(BADGE * perPixel * (p.hot ? 1.25 : 1))
        tip.copy(p.top)
        const facing = toCamera.copy(camera.position).sub(tip).normalize().dot(p.normal)
        p.pin.visible = facing > 0.1
        p.pin.scale.setScalar(Math.max(labels, 0.001))
        const rim = THREE.MathUtils.smoothstep(facing, 0.12, 0.35)
        p.badge.material.opacity = rim
        p.text.material.opacity = rim
        const alpha = rim * labels
        const shown = alpha > 0.3
        if (shown !== p.shown) {
          p.shown = shown
          p.label.disabled = !shown
        }
        tip.copy(p.top).project(camera)
        p.x = ((tip.x + 1) / 2) * w
        p.y = ((1 - tip.y) / 2) * h
        p.label.style.opacity = alpha.toFixed(3)
      }
      // Each label takes the side of its pin that covers the fewest other labels and
      // pins, keeping its current side on a tie so labels do not flicker.
      const shown = pins.filter((p) => p.shown)
      const dots: Box[] = shown.map((p) => [p.x - BADGE / 2, p.y - BADGE / 2, p.x + BADGE / 2, p.y + BADGE / 2])
      pins.forEach((p, i) => draw(p, places[i].name))
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
      pins.forEach((p, i) => {
        draw(p, places[i].name)
        // Anchor the sprite so its text sits where the button's text would, on the chosen side.
        const sw = p.width + 2 * MARGIN
        const sh = 18 + 2 * MARGIN
        const gap = 2 * PAD - MARGIN
        const [cx, cy] =
          p.side === 'right' ? [-gap / sw, 0.5] : p.side === 'left' ? [1 + gap / sw, 0.5] : [0.5, p.side === 'above' ? 0.5 - 22 / sh : 0.5 + 22 / sh]
        p.text.center.set(cx, cy)
        p.text.scale.set(sw * perPixel, sh * perPixel, 1)
        p.label.dataset.side = p.side
        p.label.style.transform = `translate(${p.x}px, ${p.y}px)`
      })
    },
  }
}
