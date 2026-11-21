// ai.js — bot brains. Easy = mostly random, Medium = safe + capture aware,
// Hard = capture priority, threat avoidance, home-rush, safe-tile preference.
import { trackIndexFor, isSafeTrackIndex } from './board.js'

// Evaluate one legal move. Higher = better.
export function scoreMove(game, playerIndex, pieceIndex, difficulty = 'medium') {
  const p = game.players[playerIndex]
  const piece = p.pieces[pieceIndex]
  const dice = game.diceValue
  const next = piece.progress + dice
  if (next > 56) return -1000
  let score = Math.random() * (difficulty === 'easy' ? 8 : 2)
  if (piece.progress < 0 && dice === 6) score += 14 // leaving base is good
  if (next === 56) score += 30 // exact home
  if (next >= 51) score += 10 // home lane is safe
  // Capture?
  const landingTrack = trackIndexFor(next, playerIndex, game.players.length)
  if (landingTrack >= 0 && !isSafeTrackIndex(landingTrack)) {
    const victim = game.pieceOnTrack(landingTrack, playerIndex)
    if (victim) score += difficulty === 'easy' ? 8 : 26
  }
  if (landingTrack >= 0 && isSafeTrackIndex(landingTrack)) score += difficulty === 'easy' ? 0 : 9
  // Threat: would I land where an enemy 1-6 behind me can capture me?
  if (difficulty !== 'easy' && landingTrack >= 0 && !isSafeTrackIndex(landingTrack)) {
    for (let e = 0; e < game.players.length; e++) {
      if (e === playerIndex) continue
      for (const ep of game.players[e].pieces) {
        if (ep.progress < 0 || ep.progress > 50) continue
        const et = trackIndexFor(ep.progress, e, game.players.length)
        const dist = (landingTrack - et + 52) % 52
        if (dist >= 1 && dist <= 6) score -= difficulty === 'hard' ? 14 : 7
      }
    }
  }
  // Don't leave a piece alone on a danger tile if a safer piece can move.
  if (difficulty === 'hard' && piece.progress >= 0 && piece.progress <= 50) {
    const cur = trackIndexFor(piece.progress, playerIndex, game.players.length)
    if (!isSafeTrackIndex(cur)) score += 3 // moving off a danger tile is good
  }
  return score
}

export function chooseMove(game, playerIndex, legalMoves, difficulty = 'medium') {
  if (!legalMoves.length) return -1
  if (legalMoves.length === 1) return legalMoves[0]
  if (difficulty === 'easy' && Math.random() < 0.45) return legalMoves[Math.floor(Math.random() * legalMoves.length)]
  let best = legalMoves[0], bestScore = -Infinity
  for (const m of legalMoves) {
    const s = scoreMove(game, playerIndex, m, difficulty)
    if (s > bestScore) { bestScore = s; best = m }
  }
  return best
}

// Bot turn driver: called by game.js when the active player is a bot.
export async function botTakeTurn(game) {
  await new Promise(r => setTimeout(r, 650))
  if (game.over || game.players[game.turn].type === 'human') return
  const value = await game.rollDice()
  if (value == null) return
  await new Promise(r => setTimeout(r, 550))
  const legal = game.legalMoves(game.turn, value)
  if (!legal.length) { game.endTurn(); return }
  const diff = (game.players[game.turn].difficulty || 'medium').toLowerCase()
  const pick = chooseMove(game, game.turn, legal, diff)
  await game.movePiece(game.turn, pick, value)
}
