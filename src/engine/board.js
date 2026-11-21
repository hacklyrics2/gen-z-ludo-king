// board.js — pure Ludo board logic (no Three.js here, so it is unit-testable).
// Classic board: 15x15 grid, 52 outer-track tiles, 4 home lanes (5 each),
// 8 star safe tiles, raised centre goal. Radial mode: 5-8 players on an
// octagonal / circular track (same 52-step loop, seats spaced around it).

export const PLAYER_COLORS = ['#ef4444', '#22c55e', '#facc15', '#3b82f6', '#a855f7', '#ec4899', '#f97316', '#14b8a6']
export const PLAYER_NAMES = ['Red', 'Green', 'Yellow', 'Blue', 'Purple', 'Pink', 'Orange', 'Teal']
// Safe tiles on the 52-track (classic Ludo stars + each colour's start tile).
export const SAFE_TRACK = new Set([0, 8, 13, 21, 26, 34, 39, 47])

// Classic 52-step track in (col,row) grid coords, 0..14.
// 13 tiles per side x 4 sides = 52. Starts at Red start (0,6), clockwise.
export function buildClassicTrack() {
  const t = []
  const at = (c, r) => t.push({ c, r })
  // Left arm -> top arm
  for (let c = 0; c <= 5; c++) at(c, 6)
  for (let r = 5; r >= 0; r--) at(6, r)
  at(7, 0)
  for (let r = 0; r <= 5; r++) at(8, r)
  // Right arm
  for (let c = 9; c <= 14; c++) at(c, 6)
  at(14, 7)
  for (let c = 14; c >= 9; c--) at(c, 8)
  // Bottom arm
  for (let r = 9; r <= 14; r++) at(8, r)
  at(7, 14)
  for (let r = 14; r >= 9; r--) at(6, r)
  // Left arm (return)
  for (let c = 5; c >= 0; c--) at(c, 8)
  at(0, 7)
  return t
}
function fixTrack() { return buildClassicTrack() }

export const CLASSIC_TRACK = fixTrack()

// Start offset on the 52-track per player (Red 0, Green 13, Yellow 26, Blue 39,
// extra seats continue every 13 mod 52 — radial mode spaces them evenly).
export function startOffset(playerIndex, playerCount) {
  if (playerCount <= 4) return (playerIndex * 13) % 52
  return Math.floor((playerIndex * 52) / playerCount)
}

// Home lane: 5 tiles from the track entry toward the centre, per player.
export function homeLane(playerIndex, playerCount) {
  if (playerCount <= 4) {
    // Lanes run toward centre (7,7)-ish from each side.
    const lanes = [
      [{ c: 1, r: 7 }, { c: 2, r: 7 }, { c: 3, r: 7 }, { c: 4, r: 7 }, { c: 5, r: 7 }], // Red, from left
      [{ c: 7, r: 1 }, { c: 7, r: 2 }, { c: 7, r: 3 }, { c: 7, r: 4 }, { c: 7, r: 5 }], // Green, from top
      [{ c: 13, r: 7 }, { c: 12, r: 7 }, { c: 11, r: 7 }, { c: 10, r: 7 }, { c: 9, r: 7 }], // Yellow, from right
      [{ c: 7, r: 13 }, { c: 7, r: 12 }, { c: 7, r: 11 }, { c: 7, r: 10 }, { c: 7, r: 9 }] // Blue, from bottom
    ]
    return lanes[playerIndex % 4]
  }
  // Radial: lane is a short spoke toward the centre, computed in polar space.
  const angle = (playerIndex / playerCount) * Math.PI * 2 - Math.PI / 2
  const lane = []
  for (let i = 0; i < 5; i++) {
    const radius = 5.2 - i * 0.85
    lane.push({ c: 7 + Math.cos(angle) * radius, r: 7 + Math.sin(angle) * radius, radial: true })
  }
  return lane
}

// Base yard positions (4 pieces per player) in grid coords.
export function basePositions(playerIndex, playerCount) {
  if (playerCount <= 4) {
    const yards = [
      [{ c: 1.5, r: 1.5 }, { c: 3.5, r: 1.5 }, { c: 1.5, r: 3.5 }, { c: 3.5, r: 3.5 }],
      [{ c: 10.5, r: 1.5 }, { c: 12.5, r: 1.5 }, { c: 10.5, r: 3.5 }, { c: 12.5, r: 3.5 }],
      [{ c: 10.5, r: 10.5 }, { c: 12.5, r: 10.5 }, { c: 10.5, r: 12.5 }, { c: 12.5, r: 12.5 }],
      [{ c: 1.5, r: 10.5 }, { c: 3.5, r: 10.5 }, { c: 1.5, r: 12.5 }, { c: 3.5, r: 12.5 }]
    ]
    return yards[playerIndex % 4]
  }
  const angle = (playerIndex / playerCount) * Math.PI * 2 - Math.PI / 2
  const cx = 7 + Math.cos(angle) * 5.6, cy = 7 + Math.sin(angle) * 5.6
  return [{ c: cx - 0.7, r: cy - 0.7 }, { c: cx + 0.7, r: cy - 0.7 }, { c: cx - 0.7, r: cy + 0.7 }, { c: cx + 0.7, r: cy + 0.7 }]
}

// Convert a grid coord to world (x,z). Board is 15 units wide, centred at 0.
export function gridToWorld(c, r) { return { x: (c - 7) * 0.92, z: (r - 7) * 0.92 } }

// Resolve a piece's progress (steps taken from its own start) to a world pos.
// progress: -1 = in base, 0..50 = on track, 51..55 = home lane, 56 = finished.
export function progressToWorld(progress, playerIndex, playerCount, baseSlot = 0) {
  if (progress < 0) { const b = basePositions(playerIndex, playerCount)[baseSlot]; return gridToWorld(b.c, b.r) }
  if (progress >= 56) return { x: 0, z: 0 }
  if (progress >= 51) { const lane = homeLane(playerIndex, playerCount)[progress - 51]; return gridToWorld(lane.c, lane.r) }
  const trackIndex = (startOffset(playerIndex, playerCount) + progress) % 52
  const tile = CLASSIC_TRACK[trackIndex]
  return gridToWorld(tile.c, tile.r)
}

export function trackIndexFor(progress, playerIndex, playerCount) {
  if (progress < 0 || progress > 50) return -1
  return (startOffset(playerIndex, playerCount) + progress) % 52
}
export function isSafeTrackIndex(i) { return SAFE_TRACK.has(i) }
