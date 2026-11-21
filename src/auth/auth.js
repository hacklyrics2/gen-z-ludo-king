// auth.js — Google Sign-In + Play as Guest + account linking stub.
// Works fully offline in demo mode (LocalStorage profile). With Firebase
// configured, Google sign-in uses the real SDK; guest profiles can later
// be linked to Google via linkGuestToGoogle().
import { loadSave, saveSave, addXP } from '../engine/storage.js'
import { getFirebase, isFirebaseConfigured } from './firebase.js'

const PROFILE_KEY = 'genzludoking.profile.v1'

export async function getProfile() {
  const save = await loadSave()
  let local = {}
  try { local = JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}') } catch { local = {} }
  return {
    uid: local.uid || ('guest-' + (save.username || 'player').toLowerCase().replace(/\W+/g, '')),
    name: local.name || save.username || 'Player 1',
    avatar: local.avatar || '🎲',
    country: local.country || save.country || '🇮🇳',
    level: save.level || 1, xp: save.xp || 0,
    provider: local.provider || 'guest',
    email: local.email || ''
  }
}
export async function updateProfile(patch) {
  const cur = await getProfile()
  const next = { ...cur, ...patch }
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(next)) } catch { /* ignore */ }
  await saveSave({ username: next.name, country: next.country })
  return next
}
export async function signInWithGoogle() {
  const fb = await getFirebase()
  if (fb.mode !== 'firebase') {
    // Demo mode: simulate a Google account so the UI flow can be tested.
    const demo = await updateProfile({ provider: 'google-demo', email: 'demo.player@gmail.com', name: (await getProfile()).name })
    return { ok: true, mode: 'demo', profile: demo, note: 'Demo Google sign-in — add Firebase keys for real Google auth.' }
  }
  try {
    const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth')
    const res = await signInWithPopup(fb.auth, new GoogleAuthProvider())
    const u = res.user
    const profile = await updateProfile({ provider: 'google', email: u.email || '', name: u.displayName || 'Player 1', avatar: '👤', uid: u.uid })
    return { ok: true, mode: 'firebase', profile }
  } catch (e) { return { ok: false, mode: 'firebase', error: e.message } }
}
export async function playAsGuest() {
  const profile = await updateProfile({ provider: 'guest' })
  await addXP(10)
  return { ok: true, mode: 'demo', profile }
}
// Stub: in Firebase mode this would call linkWithPopup(auth.currentUser, provider).
export async function linkGuestToGoogle() {
  if (!isFirebaseConfigured) return { ok: false, note: 'Add Firebase keys first — linking needs a real Google account.' }
  return signInWithGoogle()
}
export function xpForNextLevel(level) { return level * 200 }
export function xpProgress(save) { const need = xpForNextLevel(save.level || 1); return { xp: save.xp || 0, need, pct: Math.min(100, ((save.xp || 0) % need) / need * 100) } }
