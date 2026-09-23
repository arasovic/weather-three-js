import * as THREE from 'three'

/** Half the drawing buffer's height in pixels; the page keeps it current on resize. */
export const spriteScale = { value: 400 }

/**
 * Soft round points with a size and alpha each, for smoke, fireflies and
 * sparkles. Callers write `position`, `alpha` and `size` and then call `commit`.
 */
export function createSprites(count: number, o: { color: THREE.ColorRepresentation; additive?: boolean; soft?: number }) {
  const position = new Float32Array(count * 3)
  const alpha = new Float32Array(count)
  const size = new Float32Array(count)
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(position, 3))
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1))
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
  const uniforms = {
    uColor: { value: new THREE.Color(o.color) },
    uOpacity: { value: 1 },
    uScale: spriteScale,
    uSoft: { value: o.soft ?? 0.5 },
  }
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    vertexShader: /* glsl */ `
      attribute float aAlpha;
      attribute float aSize;
      uniform float uScale;
      varying float vAlpha;
      void main() {
        vAlpha = aAlpha;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uScale * projectionMatrix[1][1] / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uSoft;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = 1.0 - smoothstep(1.0 - uSoft, 1.0, d);
        gl_FragColor = vec4(uColor, a * vAlpha * uOpacity);
      }`,
  })
  const points = new THREE.Points(geo, material)
  points.frustumCulled = false
  return {
    points,
    position,
    alpha,
    size,
    uniforms,
    commit() {
      geo.attributes.position.needsUpdate = true
      geo.attributes.aAlpha.needsUpdate = true
      geo.attributes.aSize.needsUpdate = true
    },
  }
}
