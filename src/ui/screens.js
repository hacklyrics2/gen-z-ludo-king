// screens.js — Home, Squad Setup, Live HUD, Store, Rewards, Profile, Themes,
// pause drawer + win modal. Gold balance is shown in the header on Home,
// HUD, Store, Rewards and Profile, and refreshed on every Gold event.
import * as THREE from 'three'
import { Board3D, WORLDS } from '../engine/board3d.js'
import { Game } from '../engine/game.js'
import { Dice3D } from '../engine/dice.js'
import { PLAYER_COLORS, PLAYER_NAMES } from '../engine/board.js'
import { CHARACTERS, CHARACTER_LIST } from '../engine/characters.js'
import { loadSave, saveSave, goldLabel, addGold, GOLD, resetSave } from '../engine/storage.js'
import { renderStore } from './store.js'
import { playFinisher } from './finishers.js'
import { initCustomize, PRESETS } from './customize.js'
import { renderRewards, claimDailyReward, renderProfile, shareForGold } from './rewards.js'
import { sfx } from '../audio/sfx.js'
import { initOnlineUI, renderShop } from './online.js'
import { renderQuickChat, floatEmoji, startTurnTimer, EMOJIS } from '../social/social.js'
import { diamondLabel } from '../engine/storage.js'
import { hapticDice } from '../utils/haptics.js'

const $ = id => document.getElementById(id)
let toastTimer = null
export function toast(msg) {
  const el = $('toast'); if (!el) return
  el.textContent = msg; el.classList.add('show')
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2600)
}
export function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === 'screen-' + id))
  window.scrollTo(0, 0)
}
export async function updateGoldDisplays() {
  const save = await loadSave()
  const label = goldLabel(save.gold)
  if ($('homeCoins')) $('homeCoins').textContent = label
  if ($('storeCoins')) $('storeCoins').textContent = label
  if ($('walletBalance')) $('walletBalance').textContent = `Balance: ${label} · Total earned: ${goldLabel(save.stats.totalGoldEarned || 0)}`
  if ($('homeStreak')) $('homeStreak').textContent = `🔥 ${save.streak.days || 0}-day streak`
  if ($('homeWins')) $('homeWins').textContent = `🏆 ${save.stats.wins || 0} wins`
  if ($('homeDiamonds')) $('homeDiamonds').textContent = diamondLabel(save.diamonds)
  if ($('shopGold')) $('shopGold').textContent = label
  if ($('shopDiamonds')) $('shopDiamonds').textContent = diamondLabel(save.diamonds)
  if ($('onlineGold')) $('onlineGold').textContent = label
  return save
}
// Gold pop: chime + toast + header refresh, used on every earn/spend.
export async function goldPop(delta, reason) {
  if (delta > 0) sfx.coin()
  toast(`${delta > 0 ? '+' : ''}${delta} Gold — ${reason}`)
  await updateGoldDisplays()
}

export async function initApp() {
  const save = await loadSave()
  let board3d = null, game = null, dice = null
  let squad = { count: 4, boardMode: save.boardMode || 'classic', world: save.world || 'classic', players: [] }
  let rolling = false

  // ---- Squad defaults: P1 human (selected char), rest human, practice = bots
  function defaultSquad(count, practice = false) {
    return Array.from({ length: count }, (_, i) => ({
      type: practice && i > 0 ? 'bot' : 'human',
      difficulty: i % 3 === 0 ? 'medium' : i % 3 === 1 ? 'easy' : 'hard',
      characterId: i === 0 ? (save.selectedCharacter || 'grandpa') : CHARACTER_LIST[(i + 2) % CHARACTER_LIST.length].id,
      name: `Player ${i + 1}`,
      color: PLAYER_COLORS[i]
    }))
  }
  squad.players = defaultSquad(4)

  function renderPlayerRows() {
    const wrap = $('playerRows'); if (!wrap) return
    wrap.innerHTML = ''
    squad.players.forEach((p, i) => {
      const div = document.createElement('div')
      div.className = 'charRow'
      div.innerHTML = `
        <div class="avatar" style="background:${p.color}">${(CHARACTERS[p.characterId] || CHARACTERS.grandpa).emoji}</div>
        <div style="flex:1"><b>P${i + 1} · ${PLAYER_NAMES[i]}</b>
          <div class="muted">${(CHARACTERS[p.characterId] || {}).name || ''} — ${(CHARACTERS[p.characterId] || {}).title || ''}</div>
          <select data-role="type" style="margin-top:6px">
            <option value="human" ${p.type === 'human' ? 'selected' : ''}>Human</option>
            <option value="bot" ${p.type === 'bot' ? 'selected' : ''}>Bot</option>
            <option value="off" ${p.type === 'off' ? 'selected' : ''}>Off</option>
          </select>
        </div>
        <select data-role="char" style="max-width:110px">
          ${CHARACTER_LIST.map(c => `<option value="${c.id}" ${p.characterId === c.id ? 'selected' : ''} ${save.unlocked.includes(c.id) ? '' : 'disabled'}>${c.name}${save.unlocked.includes(c.id) ? '' : ' 🔒'}</option>`).join('')}
        </select>`
      div.querySelector('[data-role=type]').addEventListener('change', e => { p.type = e.target.value; if (p.type === 'off') p.type = 'bot' })
      div.querySelector('[data-role=char]').addEventListener('change', e => { p.characterId = e.target.value })
      wrap.appendChild(div)
    })
  }
  function renderWorlds() {
    const wrap = $('worldPicker'); const grid = $('themeGrid')
    const html = Object.entries(WORLDS).map(([id, w]) => `<button class="worldBtn ${squad.world === id ? 'selected' : ''}" data-world="${id}">🌍 ${w.name}<br/><span style="font-size:11px;font-weight:400">${w.desc}</span></button>`).join('')
    if (wrap) wrap.innerHTML = html
    if (grid) grid.innerHTML = html
    document.querySelectorAll('[data-world]').forEach(b => b.addEventListener('click', async () => {
      squad.world = b.dataset.world
      await saveSave({ world: squad.world })
      renderWorlds()
      if (board3d) board3d.setWorld(squad.world)
      toast(`${WORLDS[squad.world].name} world selected`)
    }))
  }

  // ---- Navigation
  document.querySelectorAll('[data-nav]').forEach(b => b.addEventListener('click', () => { sfx.click(); showScreen(b.dataset.nav) }))
  const go = id => { sfx.click(); showScreen(id) }
  $('btnStore').addEventListener('click', async () => { go('store'); await renderStore($('storeList'), $('storeCoins'), updateGoldDisplays) })
  $('btnThemes').addEventListener('click', () => go('themes'))
  $('btnRewards').addEventListener('click', () => { go('rewards'); renderRewards($('rewardGrid'), $('challengeList'), $('rewardStreak')) })
  $('btnProfile').addEventListener('click', async () => { go('profile'); renderProfile($('profileStats'), $('walletBalance'), $('goldHistory')); await updateGoldDisplays() })
  $('btnProfileTop').addEventListener('click', async () => { go('profile'); renderProfile($('profileStats'), $('walletBalance'), $('goldHistory')) })
  $('btnOnlineInfo').addEventListener('click', () => toast('Online needs a server — this build is 100% offline. Local & Practice work now.'))
  $('btnPlayLocal').addEventListener('click', () => { squad.players = defaultSquad(squad.count, false); renderPlayerRows(); go('squad') })
  $('btnPractice').addEventListener('click', () => { squad.players = defaultSquad(squad.count, true); renderPlayerRows(); go('squad') })
  const toggleMute = async () => {
    const m = await sfx.toggleMute()
    document.querySelectorAll('#btnMute,#btnSound2').forEach(b => { b.textContent = m ? '🔇' : '🔊' })
    toast(m ? 'Sound off' : 'Sound on')
  }
  $('btnMute').addEventListener('click', toggleMute)
  $('btnSound2')?.addEventListener('click', toggleMute)
  $('btnResetSave').addEventListener('click', async () => {
    if (!confirm('Reset all Gold, characters and stats?')) return
    await resetSave(); location.reload()
  })
  $('btnShareGold')?.addEventListener('click', async () => {
    const r = await shareForGold()
    if (r.ok) { await goldPop(r.amount, 'Shared GEN-Z LUDO KING'); renderProfile($('profileStats'), $('walletBalance'), $('goldHistory')) }
    else toast(r.reason)
  })
  $('btnClaimReward').addEventListener('click', async () => {
    const r = await claimDailyReward()
    if (r.ok) { await goldPop(r.amount, `Daily reward Day ${r.day} · ${r.streak}-day streak`); renderRewards($('rewardGrid'), $('challengeList'), $('rewardStreak')) }
    else toast(r.reason)
  })

  // ---- Squad setup controls
  $('playersMinus').addEventListener('click', () => setCount(squad.count - 1))
  $('playersPlus').addEventListener('click', () => setCount(squad.count + 1))
  function setCount(n) {
    squad.count = Math.min(8, Math.max(2, n))
    $('playersCount').textContent = String(squad.count)
    squad.boardMode = squad.count > 4 ? 'radial' : 'classic'
    $('boardMode').value = squad.boardMode
    squad.players = defaultSquad(squad.count, squad.players.some(p => p.type === 'bot'))
    renderPlayerRows()
  }
  $('boardMode').addEventListener('change', e => { squad.boardMode = e.target.value; saveSave({ boardMode: squad.boardMode }) })
  await initCustomize({
    fairToggle: $('fairPlayToggle'), presetsEl: $('colorPresets'),
    hueEl: $('hueSlider'), intEl: $('intSlider'), brightEl: $('brightSlider'),
    onChange: async c => { if (c.fairPlay != null && game) game.setFairPlay(c.fairPlay); if (c.customColor) await saveSave({ customColor: c.customColor }) }
  })
  renderWorlds(); renderPlayerRows()

  // ---- Game start
  $('btnStartGame').addEventListener('click', async () => {
    const active = squad.players.filter(p => p.type !== 'off')
    if (active.length < 2) { toast('Need at least 2 players'); return }
    squad.variant = $('gameVariant')?.value || 'classic'
    if (squad.variant === 'team' && active.length !== 4) { toast('Team Up 2v2 needs exactly 4 players'); return }
    await startGame(active, { variant: squad.variant })
  })

  async function startGame(players, opts = {}) {
    const variant = opts.variant || squad.variant || 'classic'
    const entryFee = opts.entryFee || 0
    const pot = opts.pot || (entryFee ? entryFee * players.length : 0)
    showScreen('game')
    $('gameSubtitle').textContent = `${squad.boardMode === 'radial' ? 'Radial · 5–8 players' : 'Classic · ' + players.length + ' players'} · ${WORLDS[squad.world].name}`
    const wrap = $('gameCanvasWrap')
    try {
      if (!board3d) {
        board3d = new Board3D(wrap)
        dice = new Dice3D(board3d.scene, board3d)
      }
      board3d.setWorld(squad.world)
      board3d.resize()
    } catch (e) {
      console.error('[webgl]', e)
      $('fallback').hidden = false
      toast('3D unavailable on this device — game logic still runs')
    }
    const s = await loadSave()
    if (dice) dice.setSkin(s.diceSkin || 'classic')
    game = new Game(board3d, dice, { fairPlay: s.fairPlay, customColor: s.customColor?.preset, variant, entryFee, pot, onEvent: handleGameEvent })
    game.setup(players.map((p, i) => ({ ...p, color: p.color || PLAYER_COLORS[i] })))
    renderHUD()
    renderQuickChat($('quickChat'), text => { toast(`You: ${text}`); floatEmoji($('gameCanvasWrap'), '💬') })
    const eb = $('emojiBar')
    if (eb) { eb.innerHTML = ''; EMOJIS.forEach(e => { const b = document.createElement('button'); b.className = 'btn secondary small'; b.textContent = e; b.style.margin = '2px'; b.addEventListener('click', () => floatEmoji($('gameCanvasWrap'), e)); eb.appendChild(b) }) }
    $('turnLabel').innerHTML = `<b>${game.current().name}'s turn</b><small>Tap the dice to roll</small>`
    $('diceBtn').disabled = false
    // Idle animation loop (cheap: only when game screen is active).
    const idle = t => { if (game && document.getElementById('screen-game').classList.contains('active')) game.idleTick(t / 1000); requestAnimationFrame(idle) }
    requestAnimationFrame(idle)
  }

  function renderHUD() {
    const hud = $('hud'); if (!hud || !game) return
    hud.innerHTML = ''
    // Gold chip in the HUD too.
    loadSave().then(s => {
      const gold = document.createElement('div')
      gold.className = 'hudcard'; gold.style.color = '#f5b82e'; gold.textContent = goldLabel(s.gold)
      hud.prepend(gold)
    })
    game.players.forEach((p, i) => {
      const d = document.createElement('div')
      d.className = 'hudcard' + (i === game.turn ? ' active' : '')
      d.textContent = `${p.type === 'bot' ? '🤖' : '👤'} P${i + 1} ${p.name.replace('Player ', '')} · ${p.pieces.filter(x => x.finished).length}/4 🏠`
      hud.appendChild(d)
    })
  }

  async function handleGameEvent(ev) {
    if (!game) return
    switch (ev.type) {
      case 'turn': case 'setup': case 'bonus': case 'player-changed': case 'fairplay':
        renderHUD()
        if (ev.type === 'turn' || ev.type === 'setup') {
          if (window.__stopTimer) window.__stopTimer()
          window.__stopTimer = startTurnTimer($('turnTimer'), 15000, () => { if (game && !game.over && game.current().type === 'human') { toast('Time up! Auto-rolling…'); doRoll() } })
          const cur = game.current()
          $('turnLabel').innerHTML = `<b>${cur.name}'s turn</b><small>${cur.type === 'bot' ? 'Bot is thinking…' : 'Tap the dice to roll'}</small>`
          $('diceBtn').disabled = cur.type === 'bot'
          if (game) game.applyFairPlay()
        }
        break
      case 'rolled':
        $('turnLabel').innerHTML = `<b>${game.players[ev.player].name} rolled ${ev.value}</b><small>${ev.value === 6 ? 'Bonus turn!' : 'Tap a glowing piece to move'}</small>`
        renderHUD(); break
      case 'highlight':
        $('turnLabel').innerHTML = `<b>Choose a piece</b><small>${ev.moves.length} movable piece${ev.moves.length > 1 ? 's' : ''} — tap a glowing one</small>`
        break
      case 'toast': toast(ev.text); break
      case 'capture': {
        const pos = game.rigs[ev.victim.player]?.[ev.victim.piece]?.rootGroup.position
        playFinisher(board3d, $('finisherPop'), { finisher: ev.finisher, text: ev.text, pos: pos ? { x: pos.x, z: pos.z } : null })
        toast(`${ev.text}  ·  +${ev.gold} Gold`)
        await updateGoldDisplays(); renderHUD(); break
      }
      case 'gold': await goldPop(ev.delta, ev.reason); break
      case 'win': {
        const p = game.players[ev.player]
        $('winTitle').textContent = `${p.name} wins! 🏆`
        $('winText').textContent = ev.gold > 0 ? `+${ev.gold} Gold for the win! Balance: ${ev.balance} Gold` : `${p.name} (bot) won this match.`
        $('winModal').classList.add('open')
        await updateGoldDisplays()
        break
      }
      default: break
    }
  }

  // ---- Dice + piece tapping
  async function doRoll() {
    if (!game || game.over || rolling) return
    if (game.current().type === 'bot') { toast('Bot turn — wait'); return }
    rolling = true; $('diceBtn').disabled = true
    hapticDice()
    await game.rollDice()
    $('diceBtn').disabled = game.over || game.current().type === 'bot'
    rolling = false
  }
  $('diceBtn').addEventListener('click', doRoll)
  $('btnRollAgain').addEventListener('click', doRoll)
  $('btnHint').addEventListener('click', () => {
    if (!game) return
    const legal = game.legalMoves(game.turn, game.diceValue || 6)
    toast(legal.length ? `Movable pieces: ${legal.map(i => i + 1).join(', ')}` : 'Roll the dice first — need a 6 to leave base')
  })
  $('btnQuitGame').addEventListener('click', () => { showScreen('home'); updateGoldDisplays() })
  $('btnWinHome').addEventListener('click', () => { $('winModal').classList.remove('open'); showScreen('home'); updateGoldDisplays() })
  $('btnPlayAgain').addEventListener('click', () => { $('winModal').classList.remove('open'); startGame(game.players) })
  $('btnPause').addEventListener('click', () => {
    if (!game) return
    const wrap = $('pauseRows'); wrap.innerHTML = ''
    game.players.forEach((p, i) => {
      const div = document.createElement('div')
      div.className = 'charRow'
      div.innerHTML = `<div style="flex:1"><b>P${i + 1} · ${p.name}</b><div class="muted">${CHARACTERS[p.characterId]?.name || ''}</div></div>
        <select><option value="human" ${p.type === 'human' ? 'selected' : ''}>Human</option><option value="bot-easy" ${p.type === 'bot' && p.difficulty === 'easy' ? 'selected' : ''}>Bot · Easy</option><option value="bot-medium" ${p.type === 'bot' && p.difficulty === 'medium' ? 'selected' : ''}>Bot · Medium</option><option value="bot-hard" ${p.type === 'bot' && p.difficulty === 'hard' ? 'selected' : ''}>Bot · Hard</option></select>`
      div.querySelector('select').addEventListener('change', e => {
        const v = e.target.value
        if (v === 'human') game.setPlayerType(i, 'human')
        else game.setPlayerType(i, 'bot', v.replace('bot-', ''))
        renderHUD()
      })
      wrap.appendChild(div)
    })
    $('pauseModal').classList.add('open')
  })
  $('btnResume').addEventListener('click', () => $('pauseModal').classList.remove('open'))
  $('btnQuitFromPause').addEventListener('click', () => { $('pauseModal').classList.remove('open'); showScreen('home'); updateGoldDisplays() })
  $('btnFairQuick').addEventListener('click', async () => {
    const s = await loadSave()
    const on = !s.fairPlay
    await saveSave({ fairPlay: on })
    if (game) game.setFairPlay(on)
    toast(on ? 'Fair Play ON — other pieces are greyscale' : 'Fair Play OFF')
  })

  // Tap a glowing piece in 3D to move it (raycast).
  const ray = new THREE.Raycaster(); const ptr = new THREE.Vector2()
  $('gameCanvasWrap').addEventListener('pointerdown', e => {
    if (!game || !board3d || game.current().type === 'bot' || game.moving || game.over) return
    const rect = board3d.renderer.domElement.getBoundingClientRect()
    ptr.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    ptr.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    ray.setFromCamera(ptr, board3d.camera)
    const rigs = game.rigs[game.turn]
    const meshes = []
    rigs.forEach((rig, i) => rig.rootGroup.traverse(o => { if (o.isMesh) { o.userData.pieceIndex = i; meshes.push(o) } }))
    const hits = ray.intersectObjects(meshes, false)
    if (!hits.length) return
    const pieceIndex = hits[0].object.userData.pieceIndex
    const legal = game.legalMoves(game.turn, game.diceValue)
    if (legal.includes(pieceIndex)) { sfx.click(); game.movePiece(game.turn, pieceIndex, game.diceValue) }
    else toast('That piece cannot move with this roll')
  })

  initOnlineUI({ showScreen, toast, updateGoldDisplays, onStartOnlineGame: async room => {
    squad.variant = room.variant || 'classic'
    const players = (room.players || []).map((rp, i) => ({ type: 'human', difficulty: 'medium', characterId: CHARACTER_LIST[i % CHARACTER_LIST.length].id, name: rp.name || `Player ${i + 1}`, color: PLAYER_COLORS[i] }))
    while (players.length < (room.size || 4)) players.push({ type: 'bot', difficulty: 'medium', characterId: CHARACTER_LIST[players.length % CHARACTER_LIST.length].id, name: `Bot ${players.length + 1}`, color: PLAYER_COLORS[players.length] })
    await startGame(players, { variant: squad.variant, entryFee: room.entryFee || 0, pot: room.pot || 0 })
  } })
  // Shop screen is rendered on demand from online.js; pre-render once so + buttons work.
  renderShop(updateGoldDisplays)
  await updateGoldDisplays()
  renderRewards($('rewardGrid'), $('challengeList'), $('rewardStreak'))
  showScreen('home')
}
