// finishers.js — capture finisher sequence: camera zoom + shake + haptic
// + character finisher animation + comic pop-up (BONK! / SQUISH!) + rival
// launched back to base (the launch itself lives in game.js doCapture).
import { hapticCapture } from '../utils/haptics.js'
import { sfx } from '../audio/sfx.js'

export function playFinisher(board3d, popEl, { finisher = 'BONK!', text = '', pos = null } = {}) {
  if (popEl) {
    popEl.textContent = finisher
    popEl.classList.add('show')
    setTimeout(() => popEl.classList.remove('show'), 1100)
  }
  if (board3d) {
    if (pos) board3d.zoomTo(pos)
    board3d.shake(0.4, 380)
  }
  hapticCapture(); sfx.bonk()
  return text
}

// Gold pop animation: brief "+N Gold" toast handled by screens.js via
// the 'gold' event; this helper just formats it.
export function goldToastText(delta, reason) {
  return delta > 0 ? `+${delta} Gold — ${reason}` : `${delta} Gold — ${reason}`
}
