// auth.js — Google Sign-In + Play as Guest + account linking stub.
// Works fully offline in demo mode (LocalStorage profile). With Firebase
// configured, Google sign-in uses the real SDK; guest profiles can later
// be linked to Google via linkGuestToGoogle().
import { loadSave, saveSave, addXP } from '../engine/storage.js'
import { getFirebase, isFirebaseConfigured } from './firebase.js'

const PROFILE_KEY = 'genzludoking.profile.v1'
export const SESSION_KEY = 'genz.session'

// True only when the user has actually signed in (Google or Guest) through
// the login screen. A bare save file (Gold/stats) does NOT count as a session,
// so first launch always shows the login screen.
export function hasSession() {
  try { return Boolean(localStorage.getItem(PROFILE_KEY) || localStorage.getItem(SESSION_KEY)) } catch { return false }
}
export async function signOut() {
  try { localStorage.removeItem(PROFILE_KEY) } catch { /* ignore */ }
  try { localStorage.removeItem(SESSION_KEY) } catch { /* ignore */ }
  return true
}
function persistSession(profile) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify({ uid: profile.uid, name: profile.name, email: profile.email || '', provider: profile.provider, avatar: profile.avatar || '', characterId: profile.characterId || 'grandpa', at: new Date().toISOString() })) } catch { /* ignore */ }
}

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
    email: local.email || '',
    characterId: local.characterId || save.selectedCharacter || 'grandpa'
  }
}
export async function updateProfile(patch) {
  const cur = await getProfile()
  const next = { ...cur, ...patch }
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(next)) } catch { /* ignore */ }
  persistSession(next)
  const savePatch = { username: next.name, country: next.country }
  if (next.characterId) savePatch.selectedCharacter = next.characterId
  await saveSave(savePatch)
  return next
}
export async function signInWithGoogle(name = '', email = '') {
  const fb = await getFirebase()
  if (fb.mode !== 'firebase') {
    // Demo mode: instant mock sign-in — never surface an API error.
    // The name/email the user typed in the modal become their profile.
    const cur = await getProfile()
    const demo = await updateProfile({ provider: 'google', email: email || cur.email || 'player@gmail.com', name: name || cur.name || 'Player 1', avatar: '👤' })
    return { ok: true, mode: 'demo', profile: demo, note: 'Demo Google sign-in — add Firebase keys for real Google auth.' }
  }
  try {
    const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth')
    const res = await signInWithPopup(fb.auth, new GoogleAuthProvider())
    const u = res.user
    const profile = await updateProfile({ provider: 'google', email: u.email || email || '', name: u.displayName || name || 'Player 1', avatar: '👤', uid: u.uid })
    return { ok: true, mode: 'firebase', profile }
  } catch (e) {
    // Popup blocked / closed / network: fall back to instant mock sign-in
    // with the typed name+email instead of showing an API error.
    const cur = await getProfile()
    const demo = await updateProfile({ provider: 'google', email: email || cur.email || 'player@gmail.com', name: name || cur.name || 'Player 1', avatar: '👤' })
    return { ok: true, mode: 'demo', profile: demo, note: 'Google popup unavailable — signed in with the details you entered.' }
  }
}
export async function playAsGuest(name = '', characterId = 'grandpa') {
  const profile = await updateProfile({ provider: 'guest', name: name || 'Guest Player', characterId: characterId || 'grandpa', avatar: (await getProfile()).avatar })
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
