// customize.js — Fair Play toggle + custom colour picker (preset + Hue /
// Intensity / Brightness sliders) that update player materials in real time.
import { loadSave, saveSave } from '../engine/storage.js'

export const PRESETS = ['#ef4444', '#22c55e', '#facc15', '#3b82f6', '#a855f7', '#ec4899', '#f97316', '#14b8a6']

export function colorFromCustom(custom) {
  if (!custom) return '#ef4444'
  return custom.preset || '#ef4444'
}

// Convert preset + sliders to a CSS colour string for the live preview.
export function customColorCss(custom) {
  const c = custom || { hue: 0, intensity: 100, brightness: 100, preset: '#ef4444' }
  return `hsl(${c.hue} 80% ${Math.min(70, Math.max(25, 50 * (c.brightness / 100)))}%)`
}

export async function initCustomize({ fairToggle, presetsEl, hueEl, intEl, brightEl, onChange }) {
  const save = await loadSave()
  const custom = save.customColor || { hue: 0, intensity: 100, brightness: 100, preset: '#ef4444' }
  if (fairToggle) {
    fairToggle.checked = !!save.fairPlay
    fairToggle.addEventListener('change', async () => {
      await saveSave({ fairPlay: fairToggle.checked })
      onChange?.({ fairPlay: fairToggle.checked })
    })
  }
  if (presetsEl) {
    presetsEl.innerHTML = ''
    for (const p of PRESETS) {
      const d = document.createElement('button')
      d.className = 'colorDot' + (custom.preset === p ? ' selected' : '')
      d.style.background = p; d.title = p
      d.addEventListener('click', async () => {
        const s = await loadSave()
        s.customColor = { ...s.customColor, preset: p }
        await saveSave(s)
        presetsEl.querySelectorAll('.colorDot').forEach(x => x.classList.remove('selected'))
        d.classList.add('selected')
        onChange?.({ customColor: s.customColor })
      })
      presetsEl.appendChild(d)
    }
  }
  const bind = (el, key, labelEl, fmt) => {
    if (!el) return
    el.value = custom[key]
    if (labelEl) labelEl.textContent = fmt(custom[key])
    el.addEventListener('input', async () => {
      const s = await loadSave()
      s.customColor = { ...s.customColor, [key]: Number(el.value) }
      await saveSave(s)
      if (labelEl) labelEl.textContent = fmt(Number(el.value))
      onChange?.({ customColor: s.customColor })
    })
  }
  bind(hueEl, 'hue', document.getElementById('hueVal'), v => `${v}°`)
  bind(intEl, 'intensity', document.getElementById('intVal'), v => `${v}%`)
  bind(brightEl, 'brightness', document.getElementById('brightVal'), v => `${v}%`)
}
