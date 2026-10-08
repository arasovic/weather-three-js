import * as THREE from 'three'

// The latest GFS 10 m wind, packed every six hours by .github/workflows/wind.yml.
const DATA = 'https://raw.githubusercontent.com/arasovic/weather-three-js/refs/tags/wind-latest'
const W = 360
const H = 181
// Older data means the job has stopped; better no wind than a wrong one.
const STALE = 30 * 3_600_000

const COUNT = 9000
/** How far a particle drifts, in degrees per second for each m/s of wind. */
const DRIFT = 0.4
const RAD = Math.PI / 180

// From calm, a faint blue-grey, through white to a warm amber for gales.
const CALM = new THREE.Color('#8fa9c2')
const BREEZE = new THREE.Color('#ffffff')
const GALE = new THREE.Color('#ffbe7a')

/**
 * Wind over the globe: particles drift with the wind and leave trails that fade. The
 * trails build up in an equirectangular texture, laid over the globe on a slightly
 * larger sphere, so turning the globe never smears them.
 */
export function createWind(renderer: THREE.WebGLRenderer, sun: THREE.Vector3, reduced: boolean) {
  const targets = [0, 1].map(() => new THREE.WebGLRenderTarget(2048, 1024, { depthBuffer: false, wrapS: THREE.RepeatWrapping }))
  let front = 0

  // Each frame copies the trails a little dimmer, then draws every particle's latest step
  // on top. The subtraction lets 8-bit trails reach zero instead of stalling.
  const fade = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      uniforms: { trails: { value: null }, keep: { value: 1 }, drop: { value: 0 } },
      depthTest: false,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D trails;
        uniform float keep;
        uniform float drop;
        varying vec2 vUv;
        void main() {
          gl_FragColor = vec4(max(texture2D(trails, vUv).rgb * keep - drop, 0.0), 1.0);
        }`,
    }),
  )
  const positions = new Float32Array(COUNT * 6)
  const colors = new Float32Array(COUNT * 6)
  const steps = new THREE.BufferGeometry()
  steps.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage))
  steps.setAttribute('color', new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage))
  const lines = new THREE.LineSegments(
    steps,
    // Max blending keeps crossing trails from adding up to glare.
    new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false, blending: THREE.CustomBlending, blendEquation: THREE.MaxEquation }),
  )
  fade.frustumCulled = lines.frustumCulled = false
  lines.renderOrder = 1
  const stage = new THREE.Scene().add(fade, lines)
  // x is longitude and y latitude, matching the sphere's texture layout.
  const flat = new THREE.OrthographicCamera(-180, 180, 90, -90, -1, 1)

  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(1.004, 128, 64),
    new THREE.ShaderMaterial({
      uniforms: { trails: { value: targets[0].texture }, sun: { value: sun } },
      transparent: true,
      depthWrite: false,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vNormal;
        void main() {
          vUv = uv;
          vNormal = normalize((modelMatrix * vec4(position, 0.0)).xyz);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D trails;
        uniform vec3 sun;
        varying vec2 vUv;
        varying vec3 vNormal;
        void main() {
          vec3 c = texture2D(trails, vUv).rgb;
          float a = max(c.r, max(c.g, c.b));
          // Dimmer on the night side, so the day and night still read.
          float lit = mix(0.4, 0.85, smoothstep(-0.15, 0.2, dot(vNormal, sun)));
          gl_FragColor = vec4(c / max(a, 0.001), a * lit);
        }`,
    }),
  )
  mesh.visible = false

  let field: Int8Array | null = null
  let unit = 0.5
  let loading = false
  async function load() {
    loading = true
    try {
      const meta = await (await fetch(`${DATA}/wind.json`)).json()
      if (Date.now() - Date.parse(meta.valid) > STALE) return
      const buf = await (await fetch(`${DATA}/wind.bin`)).arrayBuffer()
      if (buf.byteLength !== 2 * W * H) return
      field = new Int8Array(buf)
      unit = meta.step
      for (let i = 0; i < COUNT; i++) spawn(i)
      mesh.visible = true
    } catch (e) {
      console.warn('Wind data unavailable; the globe shows none.', e)
    }
  }

  /** The wind at a point in m/s, eastward and northward, interpolated between grid points. */
  const uv: [number, number] = [0, 0]
  function sample(lon: number, lat: number) {
    const x = (((lon % 360) + 360) % 360)
    const y = Math.min(90 - lat, H - 1.001)
    const x0 = Math.floor(x)
    const y0 = Math.floor(y)
    const fx = x - x0
    const fy = y - y0
    const x1 = (x0 + 1) % W
    const r0 = y0 * W
    const r1 = r0 + W
    const f = field!
    for (let k = 0, plane = 0; k < 2; k++, plane += W * H) {
      const top = f[plane + r0 + x0] * (1 - fx) + f[plane + r0 + x1] * fx
      const bottom = f[plane + r1 + x0] * (1 - fx) + f[plane + r1 + x1] * fx
      uv[k] = (top * (1 - fy) + bottom * fy) * unit
    }
    return uv
  }

  const lon = new Float32Array(COUNT)
  const lat = new Float32Array(COUNT)
  const life = new Float32Array(COUNT)
  /** A fresh particle somewhere on the sphere, evenly spread, with a little life left. */
  function spawn(i: number) {
    lon[i] = Math.random() * 360 - 180
    lat[i] = Math.asin(Math.random() * 2 - 1) / RAD
    life[i] = 1 + Math.random() * 3
  }

  const c = new THREE.Color()
  /** Moves every particle on by dt seconds and records each step as a line. */
  function advance(dt: number) {
    for (let i = 0; i < COUNT; i++) {
      const o = i * 6
      life[i] -= dt
      if (life[i] < 0) {
        spawn(i)
        positions.fill(0, o, o + 6)
        colors.fill(0, o, o + 6)
        continue
      }
      const [u, v] = sample(lon[i], lat[i])
      const speed = Math.hypot(u, v)
      const x = lon[i]
      const y = lat[i]
      lon[i] += (u * DRIFT * dt) / Math.max(Math.cos(y * RAD), 0.1)
      lat[i] = THREE.MathUtils.clamp(y + v * DRIFT * dt, -89, 89)
      if (lon[i] > 180) lon[i] -= 360
      else if (lon[i] < -180) lon[i] += 360
      // A step across the date line would streak over the whole map; skip drawing it.
      const wraps = Math.abs(lon[i] - x) > 180
      positions[o] = x
      positions[o + 1] = y
      positions[o + 3] = wraps ? x : lon[i]
      positions[o + 4] = wraps ? y : lat[i]
      if (speed < 8) c.lerpColors(CALM, BREEZE, THREE.MathUtils.smoothstep(speed, 1, 8))
      else c.lerpColors(BREEZE, GALE, THREE.MathUtils.smoothstep(speed, 12, 25))
      c.multiplyScalar(THREE.MathUtils.smoothstep(speed, 0.5, 5) * 0.8 + 0.2)
      c.toArray(colors, o)
      c.toArray(colors, o + 3)
    }
    steps.attributes.position.needsUpdate = true
    steps.attributes.color.needsUpdate = true
  }

  /** Fades the trails by dt seconds' worth and adds the latest steps. */
  function draw(dt: number) {
    const back = 1 - front
    const { uniforms } = fade.material
    uniforms.trails.value = targets[front].texture
    uniforms.keep.value = 0.965 ** (dt * 60)
    uniforms.drop.value = 0.004 * dt * 60
    const previous = renderer.getRenderTarget()
    renderer.setRenderTarget(targets[back])
    renderer.render(stage, flat)
    renderer.setRenderTarget(previous)
    front = back
    mesh.material.uniforms.trails.value = targets[front].texture
  }

  let settled = false
  return {
    mesh,
    /** Runs while the globe is on screen; with reduced motion the trails stay still. */
    update(dt: number) {
      if (!loading) load()
      if (!field || settled) return
      if (reduced) {
        // Lay down a few seconds of trails at once and leave them be.
        for (let k = 0; k < 90; k++) {
          advance(1 / 30)
          draw(1 / 30)
        }
        settled = true
        return
      }
      const step = Math.min(dt, 0.05)
      advance(step)
      draw(step)
    },
  }
}
