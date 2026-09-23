// Full-screen sky seen from the ground. Camera frame: x right, y up, z forward (towards the view azimuth).
// Colours are authored in display space; the sky is a hand-tuned gradient keyed on sun altitude
// rather than a physical scattering model, so it stays cheap enough for phones.

export const vertex = /* glsl */ `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`

export const fragment = /* glsl */ `#version 300 es
precision highp float;
out vec4 outColor;

uniform vec2 uRes;
uniform float uTime;
uniform float uFocal;
uniform float uPitch;
uniform vec3 uSun;       // unit vector, camera frame
uniform vec3 uMoon;
uniform float uMoonLit;  // illuminated fraction 0-1
uniform float uSunAlt;   // degrees
uniform vec3 uCover;     // low, middle, high cloud 0-1
uniform float uRain;     // 0-1
uniform float uSnow;     // 0-1
uniform float uFog;      // 0-1
uniform float uStorm;    // 0-1
uniform vec2 uDrift;     // km of cloud travel so far, camera frame (x right, y forward)

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p, int octaves) {
  float v = 0.0;
  float a = 0.5;
  mat2 r = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 6; i++) {
    if (i >= octaves) break;
    v += a * noise(p);
    p = r * p * 2.03 + 17.1;
    a *= 0.5;
  }
  return v;
}

// Keyframes over sun altitude: night, deep twilight, blue hour, sunset, golden hour, morning, day.
const float K[7] = float[7](-18.0, -9.0, -4.0, 0.0, 5.0, 12.0, 30.0);
const vec3 ZENITH[7] = vec3[7](
  vec3(0.012, 0.018, 0.045), vec3(0.035, 0.06, 0.15), vec3(0.1, 0.16, 0.34),
  vec3(0.18, 0.29, 0.53), vec3(0.2, 0.36, 0.66), vec3(0.21, 0.42, 0.78), vec3(0.16, 0.42, 0.86));
const vec3 HORIZON[7] = vec3[7](
  vec3(0.03, 0.04, 0.08), vec3(0.1, 0.12, 0.25), vec3(0.34, 0.3, 0.5),
  vec3(0.66, 0.5, 0.62), vec3(0.8, 0.68, 0.68), vec3(0.72, 0.8, 0.9), vec3(0.74, 0.85, 0.96));
const vec3 GLOW[7] = vec3[7](
  vec3(0.03, 0.04, 0.08), vec3(0.2, 0.14, 0.24), vec3(0.78, 0.4, 0.3),
  vec3(1.0, 0.52, 0.22), vec3(1.0, 0.74, 0.4), vec3(1.0, 0.9, 0.72), vec3(0.93, 0.96, 1.0));
const vec3 SUNLIGHT[7] = vec3[7](
  vec3(0.05, 0.06, 0.1), vec3(0.2, 0.16, 0.24), vec3(0.62, 0.34, 0.3),
  vec3(1.0, 0.5, 0.26), vec3(1.0, 0.76, 0.52), vec3(1.0, 0.93, 0.82), vec3(1.0, 1.0, 0.97));

vec3 keyed(vec3 k[7], float h) {
  if (h <= K[0]) return k[0];
  for (int i = 0; i < 6; i++) {
    if (h < K[i + 1]) return mix(k[i], k[i + 1], smoothstep(K[i], K[i + 1], h));
  }
  return k[6];
}

float gGloom;
float gNight;

vec3 grade(vec3 c) {
  float l = dot(c, vec3(0.3, 0.55, 0.15));
  c = mix(c, vec3(l) * vec3(0.82, 0.88, 1.0), gGloom * 0.8);
  return c * (1.0 - gGloom * 0.2 * (1.0 - gNight));
}

vec3 skyColour(vec3 d, float towardSun) {
  vec3 zen = keyed(ZENITH, uSunAlt);
  vec3 hor = mix(keyed(HORIZON, uSunAlt), keyed(GLOW, uSunAlt), pow(towardSun, 2.5));
  // The warm band hugs the horizon, and climbs higher on the sun's side.
  float t = pow(clamp(d.y, 0.0, 1.0), mix(0.55, 0.3, towardSun));
  return mix(hor, zen, t);
}

// One cloud deck on a flat plane above the viewer.
vec4 deck(vec3 d, float heightKm, float scale, float cover, int octaves, vec2 stretch, float soft) {
  if (cover < 0.02 || d.y < 0.005) return vec4(0.0);
  vec2 p = d.xz / d.y * heightKm + uDrift * (heightKm / 1.5);
  vec2 q = p * scale * stretch;
  // Far away the plane is sampled too coarsely to show detail: drop octaves and
  // settle towards the average cover so the horizon does not alias into stripes.
  float far = smoothstep(0.45, 0.05, d.y);
  int oct = octaves - int(far * float(octaves - 2));
  float n = fbm(q, oct);
  float threshold = 1.0 - cover * 0.95 - 0.08;
  float density = mix(smoothstep(threshold, threshold + soft, n), cover * 0.9, far * far);
  if (density <= 0.0) return vec4(0.0);
  // Lit where the density falls away towards the sun, shaded where it builds.
  vec2 toSun = normalize(uSun.xz + 1e-4) * 0.35;
  float n2 = fbm(q + toSun, octaves);
  float light = clamp(0.55 + (n - n2) * 5.0, 0.0, 1.0);
  float fade = smoothstep(0.02, 0.2, d.y);
  return vec4(light, density * fade, n, 0.0);
}

vec3 shadeCloud(vec3 d, vec4 c, vec3 sky, float overcast, float flash, float towardSun) {
  float night = smoothstep(-2.0, -12.0, uSunAlt);
  float l = dot(sky, vec3(0.3, 0.55, 0.15));
  // Shadowed cloud is a greyer, darker version of the sky so it never reads as open sky.
  vec3 base = mix(sky, vec3(l) * vec3(0.8, 0.86, 1.0), 0.7) * mix(0.75, 0.62, overcast) + 0.015;
  base = mix(base, vec3(0.022, 0.025, 0.035), night);
  // City light glows on the underside of night cloud.
  base += night * vec3(0.08, 0.05, 0.03) * (1.0 - clamp(d.y * 2.0, 0.0, 1.0));
  vec3 sun = keyed(SUNLIGHT, uSunAlt);
  float reach = smoothstep(-7.0, -1.0, uSunAlt) * (1.0 - overcast * 0.75);
  // A low sun only lights the cloud on its own side of the sky.
  float side = mix(1.0, pow(towardSun, 1.5), smoothstep(20.0, 3.0, uSunAlt));
  vec3 col = mix(base, sun * 1.05, c.x * reach * side);
  float edge = (1.0 - c.y) * pow(max(dot(d, uSun), 0.0), 12.0);
  col += sun * edge * 0.8 * (1.0 - night);
  // Under a closed deck the setting sun still paints a band just above the horizon.
  col += sun * overcast * pow(towardSun, 4.0) * (1.0 - smoothstep(0.0, 0.18, d.y)) * smoothstep(-6.0, 0.0, uSunAlt) * 0.3;
  return col + flash * vec3(0.7, 0.72, 0.8);
}

float stars(vec3 d) {
  vec2 p = vec2(atan(d.x, d.z), d.y) * 180.0;
  vec2 cell = floor(p);
  float h = hash(cell);
  if (h < 0.965) return 0.0;
  vec2 center = cell + 0.5 + (vec2(hash(cell + 3.1), hash(cell + 7.7)) - 0.5) * 0.6;
  float twinkle = 0.7 + 0.3 * sin(uTime * (1.0 + h * 3.0) + h * 40.0);
  return smoothstep(0.35, 0.0, length(p - center)) * (h - 0.965) * 28.0 * twinkle;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float cp = cos(uPitch);
  float sp = sin(uPitch);
  vec3 d = normalize(vec3(uv.x, uv.y, uFocal));
  d = vec3(d.x, d.y * cp + d.z * sp, -d.y * sp + d.z * cp);

  vec3 sunFlat = normalize(vec3(uSun.x, 0.0, uSun.z) + 1e-5);
  float towardSun = 0.5 + 0.5 * dot(normalize(vec3(d.x, 0.0, d.z) + 1e-5), sunFlat);
  float night = smoothstep(-4.0, -14.0, uSunAlt);
  float overcast = clamp(max(uCover.x, uCover.y * 0.9) * 1.2 - 0.2, 0.0, 1.0);
  float gloom = max(overcast, max(uRain, uSnow) * 0.8);

  vec3 sky = skyColour(d, towardSun);
  vec3 sunCol = keyed(SUNLIGHT, uSunAlt);

  // Heavy cloud flattens the sky, haze and ground to a cool grey.
  gGloom = gloom;
  gNight = night;
  sky = grade(sky);
  vec3 horizon = grade(skyColour(vec3(d.x, 0.0, d.z), towardSun));

  // A bright moon lifts the night sky to a deep blue.
  float moonlight = uMoonLit * smoothstep(0.0, 0.4, uMoon.y) * night * (1.0 - gloom * 0.7);
  sky += moonlight * vec3(0.018, 0.034, 0.075) * (1.0 + 2.0 * pow(max(dot(d, uMoon), 0.0), 6.0));
  vec3 col = sky;
  if (d.y > 0.0) {
    col += stars(d) * night * (1.0 - gloom);
    float sd = dot(d, uSun);
    float disk = smoothstep(0.99990, 0.99996, sd);
    col += sunCol * (disk * 3.0 + pow(max(sd, 0.0), 300.0) * 0.6 + pow(max(sd, 0.0), 12.0) * 0.18) * (1.0 - gloom * 0.9);
    // Moon: a disc with a crude phase terminator and a faint halo.
    float md = dot(d, uMoon);
    if (uMoon.y > -0.02) {
      vec3 mx = normalize(cross(vec3(0.0, 1.0, 0.0), uMoon));
      vec3 my = cross(uMoon, mx);
      vec2 m = vec2(dot(d, mx), dot(d, my)) / 0.016;
      float r = length(m);
      float lit = smoothstep(1.0 - 2.0 * uMoonLit - 0.05, 1.0 - 2.0 * uMoonLit + 0.05, m.x / sqrt(max(1.0 - m.y * m.y, 1e-3)));
      col += vec3(0.95, 0.93, 0.86) * smoothstep(1.0, 0.94, r) * mix(0.04, 1.0, lit) * (1.0 - gloom * 0.8);
      col += vec3(0.5, 0.55, 0.7) * pow(max(md, 0.0), 800.0) * 0.4 * uMoonLit * (1.0 - gloom);
    }
  }

  // Lightning lights up the whole deck for a moment.
  float bolt = floor(uTime * 2.3);
  float flash = uStorm * step(0.93, hash(vec2(bolt, 3.7))) * exp(-fract(uTime * 2.3) * 9.0);

  vec4 high = deck(d, 9.0, 0.22, uCover.z, 4, vec2(1.6, 0.5), 0.35);
  if (high.y > 0.0) col = mix(col, shadeCloud(d, high, sky, overcast, flash, towardSun) * 1.05, high.y * 0.55);
  vec4 mid = deck(d, 4.5, 0.55, uCover.y, 5, vec2(1.0), 0.18);
  if (mid.y > 0.0) col = mix(col, shadeCloud(d, mid, sky, overcast, flash, towardSun), mid.y * 0.85);
  vec4 low = deck(d, 1.5, 0.75, max(uCover.x, uRain * 0.9), 5, vec2(1.0), 0.14);
  if (low.y > 0.0) col = mix(col, shadeCloud(d, low, sky, overcast, flash, towardSun) * mix(1.0, 0.6, uRain), low.y);

  // Haze and fog thicken towards the horizon.
  float haze = exp(-max(d.y, 0.0) * mix(18.0, 4.0, uFog));
  col = mix(col, horizon, haze * mix(0.35, 0.9, uFog));

  // Ground: a low ridge line, lit faintly by the sky.
  float az = atan(d.x, d.z);
  float ridge = 0.012 + 0.03 * fbm(vec2(az * 5.0, 1.3), 4) + 0.012 * fbm(vec2(az * 22.0, 7.1), 3);
  if (d.y < ridge) {
    vec3 ground = horizon * 0.06 + vec3(0.004, 0.006, 0.012);
    // Distant windows at night, in a thin band of town along the ridge.
    vec2 w = vec2(az * 900.0, d.y * 900.0);
    float town = smoothstep(0.35, 0.65, fbm(vec2(az * 9.0, 2.0), 3));
    float band = smoothstep(ridge - 0.09, ridge - 0.03, d.y) * smoothstep(ridge, ridge - 0.008, d.y);
    float win = step(mix(0.995, 0.93, town), hash(floor(w))) * night * band;
    col = ground + vec3(1.0, 0.75, 0.45) * win * 0.9;
    col = mix(col, horizon * 0.55, uFog * 0.5);
  }

  // Rain streaks and snowflakes in screen space, in two depths.
  if (uRain > 0.01) {
    for (int i = 0; i < 2; i++) {
      float s = float(i);
      vec2 r = uv * vec2(110.0 + s * 70.0, 9.0 + s * 4.0) + vec2(uv.y * 6.0, uTime * (22.0 + s * 10.0));
      vec2 cell = floor(r);
      vec2 f = fract(r);
      float x = abs(f.x - 0.5 - (hash(cell + 1.3) - 0.5) * 0.6);
      float streak = step(0.9, hash(cell)) * smoothstep(0.08, 0.0, x) * smoothstep(0.0, 0.5, f.y) * step(f.y, 0.85);
      col = mix(col, vec3(0.8, 0.84, 0.92), streak * uRain * (0.35 - s * 0.12));
    }
  }
  if (uSnow > 0.01) {
    for (int i = 0; i < 3; i++) {
      float s = float(i);
      float size = 24.0 + s * 18.0;
      vec2 p = uv * size + vec2(sin(uTime * 0.7 + s) * 0.6, uTime * (1.2 + s * 0.4));
      vec2 cell = floor(p);
      vec2 c = cell + 0.5 + (vec2(hash(cell), hash(cell + 9.2)) - 0.5) * 0.7;
      float flake = smoothstep(0.12, 0.0, length(p - c)) * step(0.55, hash(cell + 4.4));
      col = mix(col, vec3(0.95), flake * uSnow * (0.9 - s * 0.2));
    }
  }

  // Soft vignette, a little deeper behind the text in the top left.
  vec2 q = gl_FragCoord.xy / uRes;
  float corner = 1.0 - clamp(length((q - vec2(0.0, 1.0)) * vec2(1.6, 2.2)), 0.0, 1.0);
  col *= 1.0 - 0.3 * corner * corner;
  col *= 1.0 - 0.18 * smoothstep(0.5, 1.2, length(q - 0.5) * 1.6);

  // Dither to keep long gradients from banding.
  col += (hash(gl_FragCoord.xy + fract(uTime)) - 0.5) / 255.0;
  outColor = vec4(col, 1.0);
}
`
