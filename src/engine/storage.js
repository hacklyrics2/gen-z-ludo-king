// storage.js — offline persistence. Capacitor Preferences when available,
// localStorage fallback in the browser. Single JSON blob under one key.
//
// GOLD SYSTEM (main currency — call it "Gold" everywhere in UI):
//   start: 100 Gold. Earn: win +150, capture +10, daily chests
//   50/75/100/125/150/200/500, challenges +100/+80/+60, Share +250.
//   Spend: Vega 180, Nyra 300, Blaze 450, Glitch 600, Miso 750, Chai Baba 900.
//   Balance + history persist here and never reset on reload.
import { Preferences } from '@capacitor/preferences'

const KEY = 'ludosquad3d.save.v1'
let useCapacitor = false
try { useCapacitor = typeof Preferences !== 'undefined' } catch { useCapacitor = false }

export const GOLD = {
  START: 100, WIN: 150, CAPTURE: 10, SHARE: 250,
  DAILY: [50, 75, 100, 125, 150, 200, 500], // Day 1..7
  CHALLENGES: { win1: 100, capture2: 80, roll6: 60 }
}
// Dual currency: Gold (main) + Diamonds (premium). Diamonds buy worlds/skins.
export const DIAMOND = { START: 10 }
export const ENTRY_FEES = [100, 500, 1000, 5000]
export const WORLDS_SHOP = { classic: { priceGold: 0, priceDiamonds: 0 }, jungle: { priceGold: 0, priceDiamonds: 25 }, ocean: { priceGold: 0, priceDiamonds: 40 }, cloud: { priceGold: 0, priceDiamonds: 60 } }
export const DICE_SKINS = {
  classic: { name: 'Classic', priceGold: 0, priceDiamonds: 0, color: '#fff8e6' },
  gold: { name: 'Gold Dice', priceGold: 300, priceDiamonds: 0, color: '#f5b82e' },
  neon: { name: 'Neon Cyber', priceGold: 0, priceDiamonds: 30, color: '#22d3ee' }
}
export const diamondLabel = n => `💎 ${Number(n || 0).toLocaleString('en-IN')} Diamonds`
export const GOLD_ICON = '🪙'
export function goldLabel(n) { return `${GOLD_ICON} ${Number(n || 0).toLocaleString('en-IN')} Gold` }

export const DEFAULT_SAVE = {
  gold: GOLD.START,
  diamonds: DIAMOND.START,
  vip: false, noAds: false,
  unlockedWorlds: ['classic'],
  unlockedDiceSkins: ['classic'],
  diceSkin: 'classic',
  lastSpinDay: '', lastAdDay: '', adsWatchedToday: 0,
  username: 'Player 1', country: '🇮🇳', level: 1, xp: 0,
  coins: GOLD.START, // legacy alias — kept in sync, do not use directly
  goldHistory: [{ type: 'earn', amount: GOLD.START, reason: 'Welcome bonus', at: new Date().toISOString() }],
  unlocked: ['grandpa', 'grandma', 'boss', 'gymbro', 'influencer'],
  selectedCharacter: 'grandpa',
  world: 'classic',
  fairPlay: false,
  customColor: { hue: 0, intensity: 100, brightness: 100, preset: '#ef4444' },
  streak: { lastClaimDay: '', days: 0, best: 0 },
  rewardsClaimed: {},
  challenges: { win1: 0, capture2: 0, roll6: 0, claimed: {} },
  stats: { matches: 0, wins: 0, captures: 0, sixes: 0, totalGoldEarned: 0, totalCoinsEarned: 0 },
  muted: false,
  boardMode: 'classic'
}

let cache = null

export async function loadSave() {
  if (cache) return cache
  try {
    if (useCapacitor) {
      const { value } = await Preferences.get({ key: KEY })
      if (value) { cache = migrate({ ...structuredClone(DEFAULT_SAVE), ...JSON.parse(value) }); return cache }
    }
  } catch { /* fall through to localStorage */ }
  try {
    const raw = localStorage.getItem(KEY)
    cache = raw ? migrate({ ...structuredClone(DEFAULT_SAVE), ...JSON.parse(raw) }) : structuredClone(DEFAULT_SAVE)
  } catch { cache = structuredClone(DEFAULT_SAVE) }
  return cache
}
// Old saves had coins:250 and no gold — migrate once, never wipe Gold.
function migrate(s) {
  if (s.gold == null) s.gold = s.coins != null ? s.coins : GOLD.START
  s.coins = s.gold
  if (!Array.isArray(s.goldHistory)) s.goldHistory = []
  if (s.diamonds == null) s.diamonds = DIAMOND.START
  if (!Array.isArray(s.unlockedWorlds)) s.unlockedWorlds = ['classic']
  if (!Array.isArray(s.unlockedDiceSkins)) s.unlockedDiceSkins = ['classic']
  if (!s.diceSkin) s.diceSkin = 'classic'
  if (!s.stats) s.stats = structuredClone(DEFAULT_SAVE.stats)
  if (s.stats.totalGoldEarned == null) s.stats.totalGoldEarned = s.stats.totalCoinsEarned || 0
  return s
}

export async function saveSave(patch) {
  const s = await loadSave()
  Object.assign(s, patch)
  if (s.gold != null) s.coins = s.gold
  cache = s
  const raw = JSON.stringify(s)
  try { if (useCapacitor) await Preferences.set({ key: KEY, value: raw }) } catch { /* ignore */ }
  try { localStorage.setItem(KEY, raw) } catch { /* ignore */ }
  return s
}

function pushHistory(s, type, amount, reason) {
  s.goldHistory = s.goldHistory || []
  s.goldHistory.unshift({ type, amount, reason, at: new Date().toISOString() })
  s.goldHistory = s.goldHistory.slice(0, 50)
}

// Earn Gold: plays coin chime via caller (sfx.coin()), updates balance + history.
export async function addGold(n, reason = 'Earned Gold') {
  const s = await loadSave()
  s.gold = Math.max(0, (s.gold || 0) + n)
  s.coins = s.gold
  if (n > 0) {
    s.stats.totalGoldEarned = (s.stats.totalGoldEarned || 0) + n
    s.stats.totalCoinsEarned = s.stats.totalGoldEarned
    pushHistory(s, 'earn', n, reason)
  }
  return saveSave(s)
}
export async function addCoins(n, reason = 'Earned Gold') { return addGold(n, reason) }

// Spend Gold: returns false (no change) if balance is too low.
export async function spendGold(n, reason = 'Spent Gold') {
  const s = await loadSave()
  if ((s.gold || 0) < n) return { ok: false, save: s }
  s.gold -= n; s.coins = s.gold
  pushHistory(s, 'spend', -n, reason)
  return { ok: true, save: await saveSave(s) }
}
export async function resetSave() {
  cache = structuredClone(DEFAULT_SAVE)
  try { if (useCapacitor) await Preferences.remove({ key: KEY }) } catch { /* ignore */ }
  try { localStorage.removeItem(KEY) } catch { /* ignore */ }
  return cache
}
export function todayKey(d = new Date()) { return d.toISOString().slice(0, 10) }

// --- Diamonds ---
export async function addDiamonds(n, reason = 'Earned Diamonds') {
  const s = await loadSave()
  s.diamonds = Math.max(0, (s.diamonds || 0) + n)
  if (n > 0) pushHistory(s, 'earn', n, reason + ' (💎)')
  return saveSave(s)
}
export async function spendDiamonds(n, reason = 'Spent Diamonds') {
  const s = await loadSave()
  if ((s.diamonds || 0) < n) return { ok: false, save: s }
  s.diamonds -= n
  pushHistory(s, 'spend', -n, reason + ' (💎)')
  return { ok: true, save: await saveSave(s) }
}
export async function addXP(n) {
  const s = await loadSave()
  s.xp = (s.xp || 0) + n
  s.level = 1 + Math.floor(s.xp / 200) // 200 XP per level
  return saveSave(s)
}
