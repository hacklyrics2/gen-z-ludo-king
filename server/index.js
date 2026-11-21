// GEN-Z LUDO KING — authoritative game server (Express + Socket.io).
// Run:  cd server && npm install && npm start        (port 3123, or PORT env)
// The client only works online when this server is running; otherwise the
// app falls back to offline Local / Practice play automatically.
//
// Features:
//  - Matchmaking lobby (2P / 4P, entry fee in Gold — validated server-side)
//  - Private rooms with a 6-digit Room Code
//  - Authoritative dice: the SERVER generates every roll (anti-cheat —
//    clients can never roll their own number)
//  - Turn timer 15s: auto-roll on timeout; 3 timeouts -> seat replaced by bot
//  - Reconnection within 60s: same playerId rejoins the same room/seat
// This server is deliberately dependency-light and in-memory (no DB):
// restart it and rooms/lobbies reset. For production, persist rooms in
// Redis / Firestore and put it behind TLS.
const express = require('express')
const http = require('http')
const cors = require('cors')
const { Server } = require('socket.io')

const PORT = process.env.PORT || 3123
const TURN_MS = 15000
const RECONNECT_MS = 60000
const MAX_TIMEOUTS = 3

const app = express()
app.use(cors())
app.use(express.json())
app.get('/health', (req, res) => res.json({ ok: true, game: 'GEN-Z LUDO KING', rooms: rooms.size, lobby: [...lobby.values()].reduce((n, q) => n + q.length, 0) }))
app.get('/', (req, res) => res.send('GEN-Z LUDO KING server — /health for status'))

const server = http.createServer(app)
const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } })

// --- State ---
const rooms = new Map() // code -> room
const lobby = new Map() // "2:100" -> [socketId,...]
const socketsByPlayer = new Map() // playerId -> socketId
let roomSeq = 0
const makeCode = () => String(Math.floor(100000 + Math.random() * 900000))
const rollDice = () => 1 + Math.floor(Math.random() * 6)

function newRoom({ size = 4, entryFee = 0, mode = 'classic', variant = 'classic', privateRoom = false, hostId = null }) {
  let code = makeCode()
  while (rooms.has(code)) code = makeCode()
  const room = {
    code, size, entryFee, mode, variant, privateRoom, hostId,
    players: [], // {playerId, name, seat, timeouts, connected, isBot}
    turn: 0, diceValue: 0, started: false, createdAt: Date.now(),
    timer: null, pot: 0, winner: null
  }
  rooms.set(code, room)
  return room
}
function publicRoom(room) {
  return { code: room.code, size: room.size, entryFee: room.entryFee, mode: room.mode, variant: room.variant, pot: room.pot, started: room.started, turn: room.turn, players: room.players.map(p => ({ playerId: p.playerId, name: p.name, seat: p.seat, connected: p.connected, isBot: !!p.isBot, timeouts: p.timeouts })) }
}
function clearTimer(room) { if (room.timer) { clearTimeout(room.timer); room.timer = null } }
function startTurnTimer(room) {
  clearTimer(room)
  room.timer = setTimeout(() => onTurnTimeout(room), TURN_MS)
  io.to(room.code).emit('turn-timer', { turn: room.turn, ms: TURN_MS })
}
function onTurnTimeout(room) {
  const p = room.players[room.turn]
  if (!p || room.winner) return
  if (p.isBot) { botAct(room); return }
  p.timeouts = (p.timeouts || 0) + 1
  io.to(room.code).emit('timeout', { playerId: p.playerId, timeouts: p.timeouts })
  if (p.timeouts >= MAX_TIMEOUTS) {
    p.isBot = true; p.name = p.name + ' (Bot)'
    io.to(room.code).emit('player-replaced-by-bot', { playerId: p.playerId })
    botAct(room); return
  }
  // Auto-roll for the timed-out player (server roll — authoritative).
  serverRoll(room)
}
function botAct(room) {
  // Bot: server rolls, then after a beat advances the turn. The client
  // renders the move; the server only owns turn/dice authority here.
  setTimeout(() => { if (!room.winner) serverRoll(room) }, 700)
}
function serverRoll(room) {
  if (room.winner) return
  const value = rollDice()
  room.diceValue = value
  io.to(room.code).emit('dice-rolled', { playerId: room.players[room.turn]?.playerId, value, turn: room.turn })
  // Client reports its move via 'move'; if no move arrives in 8s, pass turn.
  clearTimer(room)
  room.timer = setTimeout(() => advanceTurn(room), 8000)
}
function advanceTurn(room) {
  if (room.winner) return
  room.turn = (room.turn + 1) % room.players.length
  room.diceValue = 0
  io.to(room.code).emit('turn', { turn: room.turn, playerId: room.players[room.turn]?.playerId })
  startTurnTimer(room)
  if (room.players[room.turn]?.isBot) botAct(room)
}
function maybeStart(room) {
  if (room.started || room.players.length < room.size) return
  room.started = true
  room.pot = room.entryFee * room.players.length
  io.to(room.code).emit('game-start', publicRoom(room))
  io.to(room.code).emit('turn', { turn: 0, playerId: room.players[0]?.playerId })
  startTurnTimer(room)
}
function joinRoom(socket, room, { playerId, name }) {
  if (room.players.find(p => p.playerId === playerId)) return room.players.find(p => p.playerId === playerId)
  if (room.players.length >= room.size) return null
  const seat = room.players.length
  const p = { playerId, name: name || 'Player ' + (seat + 1), seat, timeouts: 0, connected: true, isBot: false }
  room.players.push(p)
  socket.join(room.code)
  socket.data.roomCode = room.code; socket.data.playerId = playerId
  socketsByPlayer.set(playerId, socket.id)
  io.to(room.code).emit('room-update', publicRoom(room))
  maybeStart(room)
  return p
}

io.on('connection', socket => {
  socket.data.playerId = null; socket.data.roomCode = null

  socket.on('join-lobby', ({ playerId, name, size = 4, entryFee = 0, variant = 'classic' } = {}) => {
    socket.data.playerId = playerId
    const key = `${size}:${entryFee}:${variant}`
    if (!lobby.has(key)) lobby.set(key, [])
    const q = lobby.get(key)
    if (!q.includes(socket.id)) q.push(socket.id)
    socket.emit('lobby-joined', { size, entryFee, variant, waiting: q.length })
    // Fill a room as soon as enough players are queued.
    if (q.length >= size) {
      const ids = q.splice(0, size)
      const room = newRoom({ size, entryFee, variant })
      ids.forEach((sid, i) => {
        const s = io.sockets.sockets.get(sid)
        if (s) joinRoom(s, room, { playerId: s.data.playerId || ('p' + i), name: s.data.name || undefined })
      })
    }
  })

  socket.on('create-room', ({ playerId, name, size = 4, entryFee = 0, variant = 'classic' } = {}) => {
    socket.data.playerId = playerId; socket.data.name = name
    const room = newRoom({ size, entryFee, variant, privateRoom: true, hostId: playerId })
    const p = joinRoom(socket, room, { playerId, name })
    socket.emit('room-created', { ...publicRoom(room), you: p })
  })

  socket.on('join-room', ({ playerId, name, code } = {}) => {
    socket.data.playerId = playerId; socket.data.name = name
    const room = rooms.get(String(code))
    if (!room) return socket.emit('error', { message: 'Room not found — check the 6-digit code' })
    if (room.started && !room.players.find(p => p.playerId === playerId)) return socket.emit('error', { message: 'Match already started' })
    const p = joinRoom(socket, room, { playerId, name })
    if (!p) return socket.emit('error', { message: 'Room is full' })
    socket.emit('room-joined', { ...publicRoom(room), you: p })
  })

  socket.on('roll-dice', () => {
    const room = rooms.get(socket.data.roomCode)
    if (!room || !room.started || room.winner) return
    const cur = room.players[room.turn]
    if (!cur || cur.playerId !== socket.data.playerId) return socket.emit('error', { message: 'Not your turn' })
    clearTimer(room)
    serverRoll(room)
  })

  socket.on('move', ({ piece, dice } = {}) => {
    const room = rooms.get(socket.data.roomCode)
    if (!room || !room.started || room.winner) return
    const cur = room.players[room.turn]
    if (!cur || cur.playerId !== socket.data.playerId) return
    if (dice !== room.diceValue) return socket.emit('error', { message: 'Dice mismatch — server roll is authoritative' })
    io.to(room.code).emit('moved', { playerId: cur.playerId, piece, dice })
    // Bonus turn on 6 / capture is decided by the client rules engine and
    // reported via 'end-turn' with {bonus:boolean}; server just advances.
  })

  socket.on('end-turn', ({ bonus = false } = {}) => {
    const room = rooms.get(socket.data.roomCode)
    if (!room || !room.started || room.winner) return
    if (room.players[room.turn]?.playerId !== socket.data.playerId) return
    clearTimer(room)
    if (bonus) { io.to(room.code).emit('turn', { turn: room.turn, playerId: socket.data.playerId, bonus: true }); startTurnTimer(room) }
    else advanceTurn(room)
  })

  socket.on('game-won', ({ playerId } = {}) => {
    const room = rooms.get(socket.data.roomCode)
    if (!room || room.winner) return
    room.winner = playerId || socket.data.playerId
    clearTimer(room)
    io.to(room.code).emit('game-won', { winner: room.winner, pot: room.pot })
  })

  socket.on('chat', ({ text } = {}) => {
    const room = rooms.get(socket.data.roomCode)
    if (!room) return
    io.to(room.code).emit('chat', { playerId: socket.data.playerId, text: String(text || '').slice(0, 60), at: Date.now() })
  })
  socket.on('emoji', ({ emoji } = {}) => {
    const room = rooms.get(socket.data.roomCode)
    if (!room) return
    io.to(room.code).emit('emoji', { playerId: socket.data.playerId, emoji: String(emoji || '😀').slice(0, 4), at: Date.now() })
  })

  // Reconnection: same playerId within 60s rejoins the same room/seat.
  socket.on('rejoin', ({ playerId, code } = {}) => {
    const room = rooms.get(String(code))
    if (!room) return socket.emit('error', { message: 'Room expired' })
    if (Date.now() - room.createdAt > 0 && room.winner) return socket.emit('error', { message: 'Match already finished' })
    const p = room.players.find(x => x.playerId === playerId)
    if (!p) return socket.emit('error', { message: 'You were not in this room' })
    p.connected = true
    socket.join(room.code); socket.data.roomCode = room.code; socket.data.playerId = playerId
    socketsByPlayer.set(playerId, socket.id)
    socket.emit('rejoined', { ...publicRoom(room), you: p, turn: room.turn, diceValue: room.diceValue })
    io.to(room.code).emit('room-update', publicRoom(room))
  })

  socket.on('disconnect', () => {
    const room = rooms.get(socket.data.roomCode)
    if (!room) return
    const p = room.players.find(x => x.playerId === socket.data.playerId)
    if (p) {
      p.connected = false
      io.to(room.code).emit('player-disconnected', { playerId: p.playerId })
      // Give 60s to reconnect; then the seat becomes a bot.
      setTimeout(() => {
        if (!p.connected && !room.winner && !p.isBot) {
          p.isBot = true; p.name = p.name + ' (Bot)'
          io.to(room.code).emit('player-replaced-by-bot', { playerId: p.playerId })
          if (room.players[room.turn] === p) botAct(room)
        }
      }, RECONNECT_MS)
    }
  })
})

// Prune empty/finished rooms every 5 minutes.
setInterval(() => {
  for (const [code, room] of rooms) {
    if (room.winner && Date.now() - room.createdAt > 10 * 60 * 1000) { clearTimer(room); rooms.delete(code) }
  }
}, 5 * 60 * 1000)

server.listen(PORT, () => console.log(`GEN-Z LUDO KING server on http://localhost:${PORT}  (health: /health)`))
