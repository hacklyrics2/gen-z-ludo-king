// firebase.js — Firebase Auth + Firestore config with OFFLINE FALLBACK.
// The app runs immediately with NO API keys: if no config is present
// (the default), it stays in LocalStorage demo/guest mode and every call
// below resolves locally. To go live, paste your web config in
// `firebaseConfig` (or set VITE_FIREBASE_* env vars) and `npm install firebase`.
//
// Firebase setup (optional, 2 min):
//   1. console.firebase.google.com -> create project -> Web app -> copy config
//   2. Authentication -> Sign-in method -> enable Google
//   3. Firestore Database -> Create database (test mode for dev)
//   4. Paste the config object below (or use VITE_FIREBASE_API_KEY etc.)
export const firebaseConfig = {
  apiKey: import.meta.env?.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env?.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env?.VITE_FIREBASE_APP_ID || ''
}
export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId)

let _app = null, _auth = null, _db = null, _ready = null

// Dynamic import so the bundle never crashes if firebase is not installed.
export async function getFirebase() {
  if (_ready) return _ready
  _ready = (async () => {
    if (!isFirebaseConfigured) return { mode: 'demo', app: null, auth: null, db: null }
    try {
      const { initializeApp } = await import('firebase/app')
      const { getAuth } = await import('firebase/auth')
      const { getFirestore } = await import('firebase/firestore')
      _app = initializeApp(firebaseConfig)
      _auth = getAuth(_app); _db = getFirestore(_app)
      return { mode: 'firebase', app: _app, auth: _auth, db: _db }
    } catch (e) {
      console.warn('[firebase] falling back to demo mode:', e.message)
      return { mode: 'demo', app: null, auth: null, db: null }
    }
  })()
  return _ready
}
export const firebaseMode = () => (isFirebaseConfigured ? 'firebase (if keys valid)' : 'demo / guest (no keys)')
