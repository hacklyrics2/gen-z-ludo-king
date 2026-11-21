// sfx.js — Web Audio API sound effects, no audio files needed (offline).
// All sounds are synthesized with oscillators / noise so the app ships silent-free.
import { loadSave, saveSave } from '../engine/storage.js'

let ctx = null
let muted = false
loadSave().then(s => { muted = !!s.muted }).catch(() => {})

function ac() {
  if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)() } catch { return null } }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}
function tone(freq, dur, type = 'sine', vol = 0.18, when = 0, slideTo = null) {
  if (muted) return
  const c = ac(); if (!c) return
  const t0 = c.currentTime + when
  const o = c.createOscillator(), g = c.createGain()
  o.type = type; o.frequency.setValueAtTime(freq, t0)
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur)
  g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur)
  o.connect(g).connect(c.destination); o.start(t0); o.stop(t0 + dur + 0.02)
}
function noise(dur, vol = 0.2, when = 0, freq = 1200) {
  if (muted) return
  const c = ac(); if (!c) return
  const t0 = c.currentTime + when
  const len = Math.floor(c.sampleRate * dur)
  const buf = c.createBuffer(1, len, c.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len)
  const src = c.createBufferSource(); src.buffer = buf
  const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq
  const g = c.createGain(); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur)
  src.connect(f).connect(g).connect(c.destination); src.start(t0)
}

export const sfx = {
  get muted() { return muted },
  async toggleMute() { muted = !muted; await saveSave({ muted }); return muted },
  dice() { noise(0.08, 0.25, 0, 2500); noise(0.07, 0.2, 0.09, 2000); noise(0.09, 0.22, 0.18, 1800); tone(180, 0.08, 'square', 0.06, 0.02) },
  step() { noise(0.05, 0.12, 0, 900); tone(220, 0.05, 'triangle', 0.05) },
  bonk() { tone(160, 0.22, 'square', 0.28, 0, 55); noise(0.18, 0.3, 0, 700) },
  coin() { tone(988, 0.09, 'sine', 0.16); tone(1319, 0.16, 'sine', 0.16, 0.08) },
  click() { tone(660, 0.05, 'sine', 0.1) },
  win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.18, i * 0.13)) },
  lose() { [392, 330, 262].forEach((f, i) => tone(f, 0.2, 'triangle', 0.14, i * 0.14)) },
  unlock() { tone(784, 0.1, 'sine', 0.16); tone(988, 0.1, 'sine', 0.16, 0.09); tone(1319, 0.22, 'sine', 0.18, 0.18) }
}
export default sfx
