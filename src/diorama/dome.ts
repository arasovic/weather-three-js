import * as THREE from 'three'

/** The sky around the island: gradient, sun glow, moon, stars, haze and lightning. */
export function createSky() {
  const uniforms = {
    uZenith: { value: new THREE.Color() },
    uHorizon: { value: new THREE.Color() },
    uBelow: { value: new THREE.Color() },
    uSun: { value: new THREE.Vector3(0, 1, 0) },
    uSunColor: { value: new THREE.Color() },
    uMoon: { value: new THREE.Vector3(0, 1, 0) },
    uMoonLight: { value: 0 },
    uStars: { value: 0 },
    uFlash: { value: 0 },
    uTime: { value: 0 },
  }
  const material = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uZenith, uHorizon, uBelow, uSun, uSunColor, uMoon;
      uniform float uMoonLight, uStars, uFlash, uTime;
      varying vec3 vDir;

      float hash(vec3 p) {
        p = fract(p * 0.3183099 + 0.1);
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }

      void main() {
        vec3 d = normalize(vDir);
        float up = max(d.y, 0.0);
        vec3 col = mix(uHorizon, uZenith, pow(up, 0.55));
        col = mix(col, uBelow, smoothstep(0.0, -0.12, d.y));
        col = mix(col, uZenith * 0.9, 0.6 * smoothstep(-0.05, -0.8, d.y));

        float s = max(dot(d, uSun), 0.0);
        col += uSunColor * (0.35 * pow(s, 6.0) + 0.5 * pow(s, 60.0) + 6.0 * smoothstep(0.9994, 0.9997, s));

        float m = dot(d, uMoon);
        col += vec3(0.85, 0.9, 1.0) * uMoonLight * (0.08 * pow(max(m, 0.0), 40.0) + 1.4 * smoothstep(0.99955, 0.9997, m));

        vec3 q = d * 220.0;
        vec3 id = floor(q);
        float h = hash(id);
        float star = step(0.9935, h) * smoothstep(0.32, 0.0, length(fract(q) - 0.5));
        float twinkle = 0.7 + 0.3 * sin(uTime * (1.0 + h * 3.0) + h * 40.0);
        col += star * twinkle * uStars * smoothstep(0.0, 0.25, d.y) * (0.6 + 0.8 * fract(h * 91.0));

        col += uFlash * vec3(0.75, 0.8, 1.0) * (0.6 + 0.4 * up);
        // Dither to break up banding in the long, dark gradients.
        col *= 1.0 + 0.04 * (hash(vec3(gl_FragCoord.xy, 1.0)) - 0.5);
        gl_FragColor = vec4(col, 1.0);
      }`,
  })
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(90, 48, 24), material)
  mesh.frustumCulled = false
  mesh.renderOrder = -1
  return { mesh, uniforms }
}
