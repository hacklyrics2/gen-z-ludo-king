// online.js — Play Online (Socket.io), Friends rooms, Shop/Billing,
// Lucky Spin, Watch-Ad, and Auth UI wiring.
// All server/Firebase/Share imports are DYNAMIC + try/catch, so the app
// runs fully offline if the server is down or keys are missing.
import { loadSave, saveSave, addGold, addDiamonds, spendGold, spendDiamonds, goldLabel, diamondLabel, ENTRY_FEES, WORLDS_SHOP, DICE_SKINS, todayKey, GOLD } from '../engine/storage.js'
import { GOLD_PACKS, DIAMOND_PACKS, billing, coinShower } from '../store/billing.js'
import { getProfile, updateProfile, signInWithGoogle, playAsGuest, linkGuestToGoogle, xpForNextLevel } from '../auth/auth.js'
import { WORLDS } from '../engine/board3d.js'
import { sfx } from '../audio/sfx.js'

const $ = id => document.getElementById(id)
const SERVER_URL = () => (typeof localStorage !== 'undefined' && localStorage.getItem('genz.serverUrl')) || 'http://localhost:3123'
export const myPlayerId = () => (typeof localStorage !== 'undefined' && localStorage.getItem('genz.playerId')) || (() => { const id = 'p-' + Math.random().toString(36).slice(2, 9); try { localStorage.setItem('genz.playerId', id) } catch { /* ignore */ } return id })()

let socket = null
async function getSocket() {
  if (socket?.connected) return socket
  try {
    const { io } = await import('socket.io-client')
    socket = io(SERVER_URL(), { timeout: 4000, reconnectionAttempts: 2 })
    await new Promise((res, rej) => { socket.once('connect', res); socket.once('connect_error', rej); setTimeout(() => rej(new Error('timeout')), 4500) })
    return socket
  } catch (e) { socket = null; throw new Error('Server not reachable at ' + SERVER_URL() + ' — start it with: cd server && npm install && npm start') }
}
export async function checkServer() {
  try { const r = await fetch(SERVER_URL() + '/health'); return r.ok } catch { return false }
}
export async function shareText(text) {
  try { const { Share } = await import('@capacitor/share'); await Share.share({ title: 'GEN-Z LUDO KING', text, dialogTitle: 'Share room code' }); return true } catch { /* not native */ }
  try { if (navigator.share) { await navigator.share({ title: 'GEN-Z LUDO KING', text }); return true } } catch { /* cancelled */ }
  try { await navigator.clipboard.writeText(text); return 'copied' } catch { return false }
}

// --- Free earning: Lucky Spin (1 free/day) + Watch Ad (+100 Gold) ---
const SPIN_PRIZES = [
  { label: '50 Gold', gold: 50 }, { label: '100 Gold', gold: 100 }, { label: '10 💎', diamonds: 10 },
  { label: '200 Gold', gold: 200 }, { label: '5 💎', diamonds: 5 }, { label: '500 Gold', gold: 500 },
  { label: '25 💎', diamonds: 25 }, { label: '150 Gold', gold: 150 }
]
export async function spinWheel() {
  const save = await loadSave()
  if (save.lastSpinDay === todayKey()) return { ok: false, reason: 'Free spin used — come back tomorrow!' }
  const prize = SPIN_PRIZES[Math.floor(Math.random() * SPIN_PRIZES.length)]
  await saveSave({ lastSpinDay: todayKey() })
  let after
  if (prize.gold) after = await addGold(prize.gold, 'Lucky Spin — ' + prize.label)
  else after = await addDiamonds(prize.diamonds, 'Lucky Spin — ' + prize.label)
  sfx.coin()
  return { ok: true, prize, balance: after.gold, diamonds: after.diamonds }
}
export async function watchAd() {
  // AdMob hook: replace the 3s simulator with a real rewarded ad.
  // import { AdMob, RewardAdPluginEvents } from '@capacitor-community/admob'
  // await AdMob.prepareRewardVideoAd({ adId: 'ca-app-pub-...' }); await AdMob.showRewardVideoAd()
  const save = await loadSave()
  if ((save.adsWatchedToday || 0) >= 10 && save.lastAdDay === todayKey()) return { ok: false, reason: 'Ad limit reached for today' }
  await new Promise(r => setTimeout(r, 3000)) // dev simulator: 3s fake ad
  const isNewDay = save.lastAdDay !== todayKey()
  await saveSave({ lastAdDay: todayKey(), adsWatchedToday: isNewDay ? 1 : (save.adsWatchedToday || 0) + 1 })
  const after = await addGold(100, 'Watched ad +100 Gold')
  sfx.coin()
  return { ok: true, amount: 100, balance: after.gold }
}

// --- Shop rendering (packs, worlds, dice skins) ---
export async function renderShop(onGoldChange) {
  const save = await loadSave()
  const set = (id, txt) => { const el = $(id); if (el) el.textContent = txt }
  set('shopGold', goldLabel(save.gold)); set('shopDiamonds', diamondLabel(save.diamonds)); set('onlineGold', goldLabel(save.gold))
  const packBtn = (pack, label) => {
    const b = document.createElement('button')
    b.className = 'btn secondary'; b.style.margin = '6px 0'
    b.innerHTML = `${label} — ₹${pack.priceInr} ${pack.tag ? `<span class="pill">${pack.tag}</span>` : ''}`
    b.addEventListener('click', async () => {
      const r = await billing.purchase(pack, async (pk, lbl) => confirm(`TEST MODE — Buy ${lbl} for ₹${pk.priceInr}?\nNo real payment will be taken.`))
      if (r.ok) { coinShower(b); onGoldChange?.(); renderShop(onGoldChange) }
    })
    return b
  }
  const gp = $('goldPacks'); if (gp) { gp.innerHTML = ''; GOLD_PACKS.forEach(p => gp.appendChild(packBtn(p, goldLabel(p.gold)))) }
  const dp = $('diamondPacks'); if (dp) { dp.innerHTML = ''; DIAMOND_PACKS.forEach(p => dp.appendChild(packBtn(p, diamondLabel(p.diamonds)))) }
  const ws = $('worldShop'); if (ws) {
    ws.innerHTML = ''
    for (const [id, w] of Object.entries(WORLDS)) {
      const owned = save.unlockedWorlds.includes(id)
      const price = WORLDS_SHOP[id]
      const b = document.createElement('button')
      b.className = 'btn secondary'; b.style.margin = '6px 0'
      b.textContent = owned ? `🌍 ${w.name} — ${save.world === id ? '✓ Selected' : 'Select'}` : `🌍 ${w.name} — ${price.priceDiamonds ? diamondLabel(price.priceDiamonds) : 'Free'}`
      b.addEventListener('click', async () => {
        const s = await loadSave()
        if (!s.unlockedWorlds.includes(id)) {
          const r = await spendDiamonds(price.priceDiamonds, `Unlocked ${w.name} world`)
          if (!r.ok) { alert('Not enough Diamonds'); return }
          s.unlockedWorlds.push(id); await saveSave(s)
        }
        await saveSave({ world: id }); sfx.unlock(); onGoldChange?.(); renderShop(onGoldChange)
      })
      ws.appendChild(b)
    }
  }
  const ds = $('diceShop'); if (ds) {
    ds.innerHTML = ''
    for (const [id, d] of Object.entries(DICE_SKINS)) {
      const owned = save.unlockedDiceSkins.includes(id)
      const b = document.createElement('button')
      b.className = 'btn secondary'; b.style.margin = '6px 0'
      b.textContent = owned ? `🎲 ${d.name} — ${save.diceSkin === id ? '✓ Selected' : 'Select'}` : `🎲 ${d.name} — ${d.priceGold ? goldLabel(d.priceGold) : diamondLabel(d.priceDiamonds)}`
      b.addEventListener('click', async () => {
        const s = await loadSave()
        if (!s.unlockedDiceSkins.includes(id)) {
          let r
          if (d.priceGold) r = await spendGold(d.priceGold, `Unlocked ${d.name} dice`)
          else r = await spendDiamonds(d.priceDiamonds, `Unlocked ${d.name} dice`)
          if (!r.ok) { alert('Not enough Gold/Diamonds'); return }
          s.unlockedDiceSkins.push(id); await saveSave(s)
        }
        await saveSave({ diceSkin: id }); sfx.unlock(); onGoldChange?.(); renderShop(onGoldChange)
      })
      ds.appendChild(b)
    }
  }
}

export function initOnlineUI({ showScreen, toast, updateGoldDisplays, onStartOnlineGame }) {
  // Entry fees
  const ef = $('entryFees')
  if (ef) {
    ef.innerHTML = ''
    let selectedFee = ENTRY_FEES[0]
    ENTRY_FEES.forEach(fee => {
      const b = document.createElement('button')
      b.className = 'worldBtn' + (fee === selectedFee ? ' selected' : '')
      b.textContent = goldLabel(fee)
      b.addEventListener('click', () => { selectedFee = fee; ef.querySelectorAll('.worldBtn').forEach(x => x.classList.remove('selected')); b.classList.add('selected') })
      ef.appendChild(b)
    })
    window.__selectedEntryFee = () => selectedFee
  }
  const setStatus = t => { const el = $('onlineStatus'); if (el) el.textContent = t }
  checkServer().then(ok => setStatus(ok ? `Server: online at ${SERVER_URL()} ✅` : `Server: offline — demo mode: matches fill with online-style AI opponents and always start.`))

  $('btnOnline')?.addEventListener('click', async () => { sfx.click(); showScreen('online'); await updateGoldDisplays(); checkServer().then(ok => setStatus(ok ? `Server: online ✅` : `Server: offline — demo mode: opponents are filled in automatically.`)) })
  $('btnFriends')?.addEventListener('click', () => { sfx.click(); showScreen('friends') })
  $('btnGoShop')?.addEventListener('click', () => { showScreen('shop'); renderShop(updateGoldDisplays) })
  $('btnBuyGold')?.addEventListener('click', () => { showScreen('shop'); renderShop(updateGoldDisplays) })
  const openSpinModal = () => { const m = $('spinModal'); if (m) { m.classList.add('open'); const w = $('spinWheel'); if (w) w.style.transform = 'rotate(0deg)'; const out = $('spinWheelResult'); if (out) out.textContent = '' } }
  $('btnSpin')?.addEventListener('click', openSpinModal)
  $('btnSpin2')?.addEventListener('click', openSpinModal)
  const ad = async () => {
    toast('Playing ad… (3s simulator)')
    const r = await watchAd()
    if (r.ok) { toast(`+100 Gold! Balance: ${r.balance} Gold`); await updateGoldDisplays() } else toast(r.reason)
  }
  $('btnWatchAd')?.addEventListener('click', ad)
  $('btnWatchAdOnline')?.addEventListener('click', ad)

  // Friends: create / join room
  $('btnCreateRoom')?.addEventListener('click', async () => {
    try {
      const s = await getSocket()
      const profile = await getProfile()
      s.emit('create-room', { playerId: myPlayerId(), name: profile.name, size: 4, entryFee: 0, variant: 'classic' })
      s.once('room-created', r => { $('roomCodeDisplay').textContent = r.code; toast(`Room ${r.code} created — share it!`); window.__roomCode = r.code })
      s.once('error', e => toast(e.message))
    } catch (e) { const code = String(Math.floor(100000 + Math.random() * 900000)); window.__roomCode = code; $('roomCodeDisplay').textContent = code; toast(`Demo room ${code} created — share it! (offline mode)`) }
  })
  $('btnShareRoom')?.addEventListener('click', async () => {
    const code = window.__roomCode || $('roomCodeDisplay')?.textContent || ''
    if (!code || code === '------') { toast('Create a room first'); return }
    try { await navigator.clipboard.writeText(code); toast(`Room code ${code} copied to clipboard`); return } catch { /* fall through to share */ }
    const r = await shareText(`Join my GEN-Z LUDO KING room! Code: ${code}`)
    toast(r === 'copied' ? 'Code copied to clipboard' : 'Share sheet opened')
  })
  $('btnJoinRoom')?.addEventListener('click', async () => {
    const code = $('joinCodeInput')?.value.trim()
    if (!/^\d{6}$/.test(code || '')) { toast('Enter a valid 6-digit code'); return }
    try {
      const s = await getSocket()
      const profile = await getProfile()
      s.emit('join-room', { playerId: myPlayerId(), name: profile.name, code })
      s.once('room-joined', r => { toast(`Joined room ${r.code}! Waiting for players…`); onStartOnlineGame?.(r) })
      s.once('error', e => toast(e.message))
    } catch (e) {
      // Offline demo: any valid 6-digit code starts a match with friends-named bots.
      const profile = await getProfile()
      toast(`Joined room ${code}! (offline demo — friends filled in as bots)`)
      onStartOnlineGame?.({ code, size: 4, entryFee: 0, pot: 0, variant: 'classic', players: [{ name: profile.name }, { name: 'Friend Rohan' }, { name: 'Friend Priya' }, { name: 'Friend Aarav' }] })
    }
  })

  // Online matchmaking
  $('btnFindMatch')?.addEventListener('click', async () => {
    const save = await loadSave()
    const fee = window.__selectedEntryFee ? window.__selectedEntryFee() : 100
    const size = Number($('onlineSize')?.value || 4)
    const variant = $('onlineVariant')?.value || 'classic'
    if (save.gold < fee) { toast(`Need ${fee} Gold entry fee — you have ${save.gold} Gold`); return }
    // Realistic 3s matchmaking animation — the match ALWAYS starts.
    setStatus('🔍 Searching for opponents…')
    const dots = setInterval(() => { const el = $('onlineStatus'); if (el && el.textContent.startsWith('🔍')) el.textContent += ' ·' }, 500)
    const startDemoMatch = async () => {
      clearInterval(dots)
      const profile = await getProfile()
      const r = await spendGold(fee, `Online entry fee (${size}P)`)
      if (!r.ok) { setStatus('Not enough Gold for the entry fee'); toast('Entry fee failed'); return }
      await updateGoldDisplays()
      const names = ['Aarav', 'Priya', 'Rohan', 'Sana', 'Vikram', 'Anaya']
      const players = [{ name: profile.name }]
      for (let i = 1; i < size; i++) players.push({ name: `${names[(i - 1) % names.length]} (Online)` })
      setStatus('Match found! (demo mode — online-style AI opponents)')
      toast(`Match found! Pot: ${fee * size} Gold — winner takes all`)
      onStartOnlineGame?.({ size, entryFee: fee, pot: fee * size, variant, players })
    }
    try {
      const s = await getSocket()
      const profile = await getProfile()
      let started = false
      s.emit('join-lobby', { playerId: myPlayerId(), name: profile.name, size, entryFee: fee, variant })
      s.once('lobby-joined', l => setStatus(`In lobby — ${l.waiting}/${size} players…`))
      s.once('game-start', async room => {
        if (started) return; started = true
        clearInterval(dots)
        const r = await spendGold(fee, `Online entry fee (${size}P)`)
        if (!r.ok) { toast('Entry fee failed'); return }
        await updateGoldDisplays()
        toast(`Match found! Pot: ${room.pot} Gold — winner takes all`)
        onStartOnlineGame?.({ ...room, entryFee: fee, pot: room.pot, variant })
      })
      s.once('error', () => { if (!started) { started = true; startDemoMatch() } })
      // If the server never fills the lobby, fall back to demo opponents after 3s.
      setTimeout(() => { if (!started) { started = true; startDemoMatch() } }, 3000)
    } catch (e) { await new Promise(r => setTimeout(r, 3000)); startDemoMatch() }
  })

  // Auth screen
  $('btnAuth')?.addEventListener('click', async () => {
    showScreen('auth')
    const p = await getProfile(); const save = await loadSave()
    $('authAvatar').textContent = p.avatar; $('authName').textContent = p.name
    $('authProvider').textContent = `${p.provider} · ${p.email || 'demo mode (no Firebase keys)'}`
    $('usernameInput').value = p.name; $('countryInput').value = p.country
    $('xpBar').style.width = `${Math.min(100, (save.xp % xpForNextLevel(save.level)) / xpForNextLevel(save.level) * 100)}%`
    $('xpText').textContent = `Level ${save.level} · ${save.xp} XP · next level at ${xpForNextLevel(save.level)} XP`
  })
  $('btnSaveProfile')?.addEventListener('click', async () => {
    const name = $('usernameInput').value.trim() || 'Player 1'
    const country = $('countryInput').value.trim() || '🇮🇳'
    await updateProfile({ name, country })
    $('authName').textContent = name; toast('Profile saved'); await updateGoldDisplays()
  })
  $('btnGoogleSignIn')?.addEventListener('click', async () => {
    const r = await signInWithGoogle()
    toast(r.ok ? `Signed in (${r.mode})` : `Sign-in failed: ${r.error || r.note}`); await updateGoldDisplays()
  })
  $('btnGuest')?.addEventListener('click', async () => { await playAsGuest(); toast('Playing as Guest (+10 XP)'); await updateGoldDisplays() })
  $('btnLinkGoogle')?.addEventListener('click', async () => { const r = await linkGuestToGoogle(); toast(r.ok ? 'Linked to Google' : r.note || 'Link failed') })
}
