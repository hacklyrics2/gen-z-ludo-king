// main.js — app bootstrap + screen router entry point.
// All screens / game wiring lives in src/ui/screens.js; this file just
// boots it and handles the WebGL-failure fallback gracefully.
import { initApp, toast } from './ui/screens.js'

window.addEventListener('error', e => console.error('[GenZLudoKing]', e.message))

// Prevent pull-to-refresh / double-tap zoom on mobile.
document.addEventListener('touchmove', e => { if (e.touches.length > 1) e.preventDefault() }, { passive: false })
document.addEventListener('gesturestart', e => e.preventDefault())

initApp().catch(err => {
  console.error('[GenZLudoKing] boot failed', err)
  toast('Could not start the app — please reload')
  const fb = document.getElementById('fallback')
  if (fb) { fb.hidden = false; fb.textContent = 'App failed to start: ' + (err?.message || err) }
})
