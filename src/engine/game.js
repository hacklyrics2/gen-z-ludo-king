// game.js — full Ludo rules + Gold economy wiring.
// Rules: 6 to exit base; bonus turn on 6 / capture / reaching home;
// three 6s in a row forfeits the turn; exact roll to enter home (56);
// glowing ring on movable pieces; auto-move if only 1 legal move.
// Gold: win +150, capture +10 per capture, challenge counters updated here.
// Variants (opts.variant): 'classic' = all 4 home; 'quick'/'rush' = 1 piece
// home + 1 capture; 'team' = 2v2, a team wins when both partners have all 4 home.
// Online: opts.entryFee / opts.pot — winner takes the whole pot.
import * as THREE from 'three'
import { progressToWorld, trackIndexFor, isSafeTrackIndex, PLAYER_COLORS, PLAYER_NAMES } from './board.js'
import { buildCharacterRig, animateWalk, animateIdle, facingAngle, lerpAngle, CHARACTERS } from './characters.js'
import { addGold, loadSave, saveSave, addXP, GOLD } from './storage.js'
import { sfx } from '../audio/sfx.js'
import { hapticStep, hapticCapture } from '../utils/haptics.js'
import { botTakeTurn } from './ai.js'

export class Game {
  constructor(board3d, dice, opts = {}) {
    this.board = board3d; this.dice = dice
    this.opts = opts
    this.onEvent = opts.onEvent || (() => {})
    this.players = []
    this.turn = 0
    this.diceValue = 0
    this.sixesInRow = 0
    this.over = false
    this.moving = false
    this.rings = []
    this.rigs = [] // rigs[player][piece] = rig
    this.fairPlay = !!opts.fairPlay
    this.customColor = opts.customColor || null
    this.variant = opts.variant || 'classic'
    this.entryFee = opts.entryFee || 0
    this.pot = opts.pot || 0
    this.captures = {} // playerIndex -> captures this match
  }

  setup(players) {
    // players: [{type:'human'|'bot', difficulty, characterId, name, color}]
    this.players = players.map((p, i) => ({
      ...p, index: i, name: p.name || `${PLAYER_NAMES[i]} Player`,
      color: p.color || PLAYER_COLORS[i],
      pieces: [0, 1, 2, 3].map(() => ({ progress: -1, finished: false }))
    }))
    this.turn = 0; this.diceValue = 0; this.sixesInRow = 0; this.over = false; this.moving = false
    this.clearRings()
    // Remove old rigs from the scene.
    for (const row of this.rigs) for (const rig of row) if (rig) this.board.scene.remove(rig.rootGroup)
    this.rigs = this.players.map((p, pi) => p.pieces.map((_, si) => {
      const def = CHARACTERS[p.characterId] || CHARACTERS.grandpa
      const rig = buildCharacterRig(def, p.color, pi === 0 ? this.customColor : null)
      const pos = progressToWorld(-1, pi, this.players.length, si)
      rig.rootGroup.position.set(pos.x, 0.42, pos.z)
      rig.rootGroup.scale.setScalar(0.62)
      this.board.scene.add(rig.rootGroup)
      return rig
    }))
    this.applyFairPlay()
    this.onEvent({ type: 'setup', players: this.players })
    this.maybeBotTurn()
  }

  current() { return this.players[this.turn] }
  legalMoves(playerIndex, dice) {
    const p = this.players[playerIndex]
    const out = []
    p.pieces.forEach((piece, i) => {
      if (piece.finished) return
      if (piece.progress < 0) { if (dice === 6) out.push(i) }
      else if (piece.progress + dice <= 56) out.push(i)
    })
    return out
  }
  pieceOnTrack(trackIndex, excludePlayer = -1) {
    for (let pi = 0; pi < this.players.length; pi++) {
      if (pi === excludePlayer) continue
      for (let si = 0; si < 4; si++) {
        const pc = this.players[pi].pieces[si]
        if (pc.progress >= 0 && pc.progress <= 50 && trackIndexFor(pc.progress, pi, this.players.length) === trackIndex) return { player: pi, piece: si }
      }
    }
    return null
  }
  piecesAt(progress, playerIndex) {
    let n = 0
    for (const pc of this.players[playerIndex].pieces) if (pc.progress === progress) n++
    return n
  }

  async rollDice() {
    if (this.over || this.moving) return null
    const value = await this.dice.roll()
    this.diceValue = value
    const save = await loadSave()
    if (value === 6) { save.challenges.roll6 = (save.challenges.roll6 || 0) + 1; save.stats.sixes = (save.stats.sixes || 0) + 1; await saveSave(save) }
    this.sixesInRow = value === 6 ? this.sixesInRow + 1 : 0
    this.onEvent({ type: 'rolled', player: this.turn, value })
    if (this.sixesInRow >= 3) {
      this.onEvent({ type: 'toast', text: 'Three 6s in a row — turn forfeited!' })
      this.sixesInRow = 0; this.endTurn(); return value
    }
    const legal = this.legalMoves(this.turn, value)
    if (!legal.length) {
      this.onEvent({ type: 'toast', text: 'No legal move — turn passes' })
      await new Promise(r => setTimeout(r, 700))
      this.endTurn(); return value
    }
    this.highlight(legal)
    if (legal.length === 1) {
      await new Promise(r => setTimeout(r, 450))
      await this.movePiece(this.turn, legal[0], value)
    } else if (this.current().type === 'bot') {
      // bot picks in botTakeTurn flow; here just wait for it
    }
    return value
  }

  highlight(legal) {
    this.clearRings()
    for (const pi of legal) {
      const rig = this.rigs[this.turn][pi]
      const ring = this.board.makeRing(0xf5b82e)
      ring.position.y = 0.05
      rig.rootGroup.add(ring)
      this.rings.push(ring)
      // Pulse the ring.
      this.board.addAnimation(() => { ring.scale.setScalar(1 + Math.sin(performance.now() / 180) * 0.12); return false })
    }
    this.onEvent({ type: 'highlight', player: this.turn, moves: legal })
  }
  clearRings() { for (const r of this.rings) r.parent?.remove(r); this.rings = [] }

  // Step-by-step walk — never teleport. Returns captured victim or null.
  async movePiece(playerIndex, pieceIndex, dice) {
    if (this.moving || this.over) return null
    this.moving = true; this.clearRings()
    const piece = this.players[playerIndex].pieces[pieceIndex]
    const rig = this.rigs[playerIndex][pieceIndex]
    let captured = null
    const startProgress = piece.progress
    if (startProgress < 0) {
      piece.progress = 0
      const pos = progressToWorld(0, playerIndex, this.players.length, pieceIndex)
      await this.walkTo(rig, pos, 1)
    } else {
      for (let step = 1; step <= dice; step++) {
        piece.progress = Math.min(startProgress + step, 56)
        const pos = this.stackedPos(playerIndex, pieceIndex)
        await this.walkTo(rig, pos, 1)
        if (piece.progress >= 56) break
      }
    }
    if (piece.progress >= 56) {
      piece.finished = true
      this.onEvent({ type: 'home', player: playerIndex, piece: pieceIndex })
      sfx.win()
    }
    // Capture check (only on the outer track, never on safe stars).
    if (piece.progress >= 0 && piece.progress <= 50) {
      const ti = trackIndexFor(piece.progress, playerIndex, this.players.length)
      if (ti >= 0 && !isSafeTrackIndex(ti)) {
        const victim = this.pieceOnTrack(ti, playerIndex)
        if (victim) captured = victim
      }
    }
    const gotBonus = dice === 6 || captured || piece.finished
    if (captured) await this.doCapture(playerIndex, captured)
    this.moving = false
    this.onEvent({ type: 'moved', player: playerIndex, piece: pieceIndex, captured: !!captured })
    // Win check per variant.
    if (this.checkWin(playerIndex)) { await this.win(playerIndex); return captured }
    if (!gotBonus) this.endTurn()
    else { this.onEvent({ type: 'bonus', player: playerIndex }); this.maybeBotTurn() }
    return captured
  }

  stackedPos(playerIndex, pieceIndex) {
    const piece = this.players[playerIndex].pieces[pieceIndex]
    const base = progressToWorld(piece.progress, playerIndex, this.players.length, pieceIndex)
    // Offset pieces sharing a tile so they stand side-by-side.
    const mates = this.players[playerIndex].pieces.filter(p => p.progress === piece.progress).length
    if (mates <= 1) return base
    const idx = this.players[playerIndex].pieces.filter((p, i) => p.progress === piece.progress && i <= pieceIndex).length - 1
    const off = (idx - (mates - 1) / 2) * 0.34
    return { x: base.x + off, z: base.z + off * 0.4 }
  }

  walkTo(rig, target, steps = 1) {
    return new Promise(resolve => {
      const from = rig.rootGroup.position.clone()
      const to = new THREE.Vector3(target.x, 0.42, target.z)
      const dx = to.x - from.x, dz = to.z - from.z
      const targetAngle = Math.abs(dx) + Math.abs(dz) < 0.001 ? rig.rootGroup.rotation.y : facingAngle(dx, dz)
      const start = performance.now(), dur = 300
      let phase = rig.walkPhase || 0
      const stepFn = () => {
        const t = Math.min(1, (performance.now() - start) / dur)
        const e = t * t * (3 - 2 * t)
        rig.rootGroup.position.lerpVectors(from, to, e)
        rig.rootGroup.rotation.y = lerpAngle(rig.rootGroup.rotation.y, targetAngle, 0.22)
        phase += 0.55
        animateWalk(rig, phase, 0.55)
        if (t < 1) requestAnimationFrame(stepFn)
        else { animateIdle(rig, performance.now() / 1000); sfx.step(); hapticStep(); resolve() }
      }
      stepFn()
    })
  }

  async doCapture(attacker, victim) {
    const vRig = this.rigs[victim.player][victim.piece]
    const vPiece = this.players[victim.player].pieces[victim.piece]
    const def = CHARACTERS[this.players[attacker].characterId] || CHARACTERS.grandpa
    // Gold: +10 per capture.
    this.captures[attacker] = (this.captures[attacker] || 0) + 1
    const save = await addGold(GOLD.CAPTURE, `Capture vs ${this.players[victim.player].name}`)
    save.challenges.capture2 = (save.challenges.capture2 || 0) + 1
    save.stats.captures = (save.stats.captures || 0) + 1
    await saveSave(save)
    sfx.bonk(); hapticCapture(); sfx.coin()
    this.onEvent({ type: 'capture', attacker, victim, finisher: def.finisher, text: def.finisherDesc, gold: GOLD.CAPTURE, balance: save.gold })
    // Finisher visual is driven by ui/finishers.js via the event; here we
    // launch the rival back to base with a parabolic hop.
    const from = vRig.rootGroup.position.clone()
    const basePos = progressToWorld(-1, victim.player, this.players.length, victim.piece)
    const to = new THREE.Vector3(basePos.x, 0.42, basePos.z)
    vPiece.progress = -1
    await new Promise(res => {
      const start = performance.now(), dur = 650
      const step = () => {
        const t = Math.min(1, (performance.now() - start) / dur)
        vRig.rootGroup.position.lerpVectors(from, to, t)
        vRig.rootGroup.position.y = 0.42 + Math.sin(t * Math.PI) * 2.2
        vRig.rootGroup.rotation.y += 0.3
        if (t < 1) requestAnimationFrame(step); else { vRig.rootGroup.position.y = 0.42; res() }
      }
      step()
    })
    this.onEvent({ type: 'gold', balance: save.gold, delta: GOLD.CAPTURE, reason: 'Capture +10 Gold' })
  }

  checkWin(playerIndex) {
    const p = this.players[playerIndex]
    if (this.variant === 'quick' || this.variant === 'rush') {
      const oneHome = p.pieces.some(x => x.finished)
      if (oneHome && (this.captures[playerIndex] || 0) < 1) {
        this.onEvent({ type: 'toast', text: 'Rush mode: you need 1 capture as well as 1 piece home to win!' })
        return false
      }
      return oneHome
    }
    if (this.variant === 'team') {
      const team = [playerIndex, (playerIndex + 2) % this.players.length]
      return team.every(i => this.players[i].pieces.every(x => x.finished))
    }
    return p.pieces.every(x => x.finished)
  }
  teamOf(i) { return this.variant === 'team' ? (i % 2 === 0 ? 'Team A' : 'Team B') : null }

  async win(playerIndex) {
    this.over = true
    const p = this.players[playerIndex]
    const isHuman = p.type === 'human'
    const save = await loadSave()
    save.stats.matches = (save.stats.matches || 0) + 1
    if (isHuman) {
      save.stats.wins = (save.stats.wins || 0) + 1
      save.challenges.win1 = (save.challenges.win1 || 0) + 1
      const winGold = this.pot > 0 ? this.pot : GOLD.WIN
      const after = await addGold(winGold, this.pot > 0 ? `Won the pot (${this.pot} Gold)` : `Won match vs ${this.players.length - 1} opponents`)
      await addXP(50)
      save.gold = after.gold
      sfx.win()
      this.onEvent({ type: 'win', player: playerIndex, gold: winGold, balance: after.gold })
    } else {
      await saveSave(save)
      sfx.lose()
      this.onEvent({ type: 'win', player: playerIndex, gold: 0, balance: save.gold })
    }
  }

  endTurn() {
    if (this.over) return
    this.diceValue = 0; this.sixesInRow = 0
    this.turn = (this.turn + 1) % this.players.length
    this.onEvent({ type: 'turn', player: this.turn })
    this.maybeBotTurn()
  }
  maybeBotTurn() {
    if (this.over) return
    if (this.current().type === 'bot') {
      // Defer so the UI can paint the turn change first.
      setTimeout(() => { if (!this.over && this.current().type === 'bot') botTakeTurn(this).catch(e => console.error('[bot]', e)) }, 500)
    }
  }
  setPlayerType(playerIndex, type, difficulty = 'medium') {
    const p = this.players[playerIndex]; if (!p) return
    p.type = type; p.difficulty = difficulty
    this.onEvent({ type: 'player-changed', player: playerIndex })
    this.maybeBotTurn()
  }
  applyFairPlay() {
    // Fair Play: non-active players' pieces turn greyscale.
    for (let pi = 0; pi < this.rigs.length; pi++) {
      const grey = this.fairPlay && pi !== this.turn
      for (const rig of this.rigs[pi]) {
        rig.rootGroup.traverse(o => {
          if (o.isMesh && o.material && o.material.color) {
            if (!o.userData.origColor) o.userData.origColor = o.material.color.clone()
            if (grey) { const g = (o.userData.origColor.r + o.userData.origColor.g + o.userData.origColor.b) / 3; o.material.color.setRGB(g, g, g) }
            else o.material.color.copy(o.userData.origColor)
          }
        })
      }
    }
    this.onEvent({ type: 'fairplay', enabled: this.fairPlay })
  }
  setFairPlay(on) { this.fairPlay = !!on; this.applyFairPlay() }
  idleTick(time) {
    for (const row of this.rigs) for (const rig of row) if (rig && !this.moving) animateIdle(rig, time)
  }
}
