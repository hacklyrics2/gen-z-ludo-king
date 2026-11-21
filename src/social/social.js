// social.js — Quick Chat presets, floating emoji/stickers, 15s turn timer ring.
export const QUICK_CHAT = ['Good luck! 🍀', 'Oops! 😅', 'Hurry up! ⏰', 'Well played! 👏', 'Nice move! 🔥', 'GG! 🎉', 'Your turn 😎', 'So close! 😱']
export const EMOJIS = ['😀', '😂', '😡', '🔥', '👏', '🎉', '😱', '🐱', '💪', '🍀']

export function renderQuickChat(container, onSend) {
  if (!container) return
  container.innerHTML = ''
  for (const text of QUICK_CHAT) {
    const b = document.createElement('button')
    b.className = 'btn secondary small'; b.textContent = text; b.style.margin = '3px'
    b.addEventListener('click', () => onSend?.(text))
    container.appendChild(b)
  }
}
// Floating emoji burst over the board (pure DOM, no WebGL needed).
export function floatEmoji(container, emoji) {
  if (!container) return
  const el = document.createElement('div')
  el.textContent = emoji
  el.style.cssText = `position:absolute;left:${30 + Math.random() * 60}%;top:60%;font-size:34px;pointer-events:none;z-index:6;transition:all 1.2s ease-out`
  container.appendChild(el)
  requestAnimationFrame(() => { el.style.top = '18%'; el.style.opacity = '0'; el.style.transform = 'scale(1.6) rotate(12deg)' })
  setTimeout(() => el.remove(), 1300)
}
// 15s turn timer ring: returns a stop() fn. Renders an SVG ring + seconds.
export function startTurnTimer(container, ms = 15000, onTimeout) {
  if (!container) return () => {}
  const total = ms
  container.innerHTML = `<svg width="44" height="44" viewBox="0 0 44 44"><circle cx="22" cy="22" r="18" fill="none" stroke="#1a2c4d" stroke-width="5"/><circle class="timer-ring" cx="22" cy="22" r="18" fill="none" stroke="#f5b82e" stroke-width="5" stroke-linecap="round" stroke-dasharray="113" stroke-dashoffset="0" transform="rotate(-90 22 22)"/><text class="timer-num" x="22" y="27" text-anchor="middle" fill="#fff" font-size="14" font-weight="800">15</text></svg>`
  const ring = container.querySelector('.timer-ring')
  const num = container.querySelector('.timer-num')
  const start = performance.now()
  let stopped = false
  const tick = () => {
    if (stopped) return
    const left = Math.max(0, total - (performance.now() - start))
    const frac = left / total
    if (ring) ring.style.strokeDashoffset = String(113 * (1 - frac))
    if (num) num.textContent = String(Math.ceil(left / 1000))
    if (left <= 0) { onTimeout?.(); return }
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
  return () => { stopped = true }
}
