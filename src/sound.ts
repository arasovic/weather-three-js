/**
 * Ambient sound synthesised from noise: rain, wind, crickets at night,
 * thunder after lightning and London's hour bell. Nothing plays until the listener turns it on.
 */
export interface Levels {
  rain: number // 0-1
  wind: number // m/s
  night: number // 0-1
}

const ICON_ON =
  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>'
const ICON_OFF =
  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>'

export function createSound() {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'sound'
  button.setAttribute('aria-label', 'Sound')
  button.setAttribute('aria-pressed', 'false')
  button.innerHTML = ICON_OFF
  document.body.appendChild(button)

  let on = false
  let graph: ReturnType<typeof build> | undefined
  let chirpIn = 0

  button.addEventListener('click', () => {
    on = !on
    button.setAttribute('aria-pressed', String(on))
    button.innerHTML = on ? ICON_ON : ICON_OFF
    graph ??= build(new AudioContext())
    const { ctx, master } = graph
    if (on) void ctx.resume()
    master.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.4)
    if (!on) setTimeout(() => !on && ctx.suspend(), 1500)
  })

  return {
    update(l: Levels, dt: number) {
      if (!on || !graph) return
      const { ctx, rain, wind, windFilter } = graph
      const t = ctx.currentTime
      rain.gain.setTargetAtTime(0.35 * l.rain, t, 0.5)
      const w = Math.min(l.wind / 14, 1)
      wind.gain.setTargetAtTime(0.03 + 0.25 * w * w, t, 0.8)
      windFilter.frequency.setTargetAtTime(250 + 500 * w, t, 1)
      const crickets = l.night * (1 - l.rain) * (l.wind < 8 ? 1 : 0)
      chirpIn -= dt
      if (crickets > 0.3 && chirpIn < 0) {
        chirp(graph, 0.05 * crickets)
        chirpIn = 0.5 + Math.random() * 1.2
      }
    },
    thunder() {
      if (on && graph) rumble(graph, 0.3 + Math.random() * 1.4)
    },
    /** Strikes a deep bell `count` times, like Big Ben on the hour. */
    chime(count: number) {
      if (on && graph) for (let i = 0; i < count; i++) bell(graph, 0.1 + i * 3.2)
    },
  }
}

function build(ctx: AudioContext) {
  const master = ctx.createGain()
  master.gain.value = 0
  master.connect(ctx.destination)

  const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
  const data = noise.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  const loop = () => {
    const src = ctx.createBufferSource()
    src.buffer = noise
    src.loop = true
    src.start(0, Math.random() * 2)
    return src
  }

  // Rain: bright hiss.
  const rain = ctx.createGain()
  rain.gain.value = 0
  const hiss = ctx.createBiquadFilter()
  hiss.type = 'bandpass'
  hiss.frequency.value = 3000
  hiss.Q.value = 0.4
  loop().connect(hiss).connect(rain).connect(master)

  // Wind: low noise whose band drifts slowly, so it gusts.
  const wind = ctx.createGain()
  wind.gain.value = 0
  const windFilter = ctx.createBiquadFilter()
  windFilter.type = 'bandpass'
  windFilter.Q.value = 1.2
  const lfo = ctx.createOscillator()
  const depth = ctx.createGain()
  lfo.frequency.value = 0.13
  depth.gain.value = 180
  lfo.connect(depth).connect(windFilter.frequency)
  lfo.start()
  loop().connect(windFilter).connect(wind).connect(master)

  return { ctx, master, rain, wind, windFilter, loop }
}

function chirp({ ctx, master }: ReturnType<typeof build>, level: number) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.frequency.value = 4300 + Math.random() * 300
  gain.gain.value = 0
  osc.connect(gain).connect(master)
  const t = ctx.currentTime + 0.02
  for (let i = 0; i < 3; i++) {
    const s = t + i * 0.06
    gain.gain.setValueAtTime(0, s)
    gain.gain.linearRampToValueAtTime(level, s + 0.012)
    gain.gain.linearRampToValueAtTime(0, s + 0.04)
  }
  osc.start(t)
  osc.stop(t + 0.25)
}

function rumble({ ctx, master, loop }: ReturnType<typeof build>, delay: number) {
  const src = loop()
  const low = ctx.createBiquadFilter()
  low.type = 'lowpass'
  low.frequency.value = 180
  const gain = ctx.createGain()
  const t = ctx.currentTime + delay
  gain.gain.setValueAtTime(0, ctx.currentTime)
  gain.gain.setValueAtTime(0, t)
  gain.gain.linearRampToValueAtTime(0.9, t + 0.08)
  gain.gain.exponentialRampToValueAtTime(0.001, t + 3)
  src.connect(low).connect(gain).connect(master)
  src.stop(t + 3.1)
}

/** A struck bell: a low E with the inharmonic partials of a large bell, ringing out. */
function bell({ ctx, master }: ReturnType<typeof build>, delay: number) {
  const t = ctx.currentTime + delay
  for (const [ratio, level, decay] of [[0.5, 0.25, 6], [1, 0.3, 5], [1.19, 0.12, 3], [1.5, 0.1, 2.5], [2, 0.08, 2], [2.66, 0.05, 1.2]]) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = 164.8 * ratio
    gain.gain.setValueAtTime(0, ctx.currentTime)
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(level * 0.5, t + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + decay)
    osc.connect(gain).connect(master)
    osc.start(t)
    osc.stop(t + decay + 0.1)
  }
}
