# GEN-Z LUDO KING — Your Table. Your Rules.

Offline-first, mobile-native 3D Ludo for Android / iOS.
**Vite + HTML5 + CSS3 + Vanilla JavaScript (ES6 Modules) + Three.js + Capacitor + Express/Socket.io server.**
No React, no backend, no account. 2–8 players on 1 phone.

> App ID: `com.anish.genzludoking` · App name: **GEN-Z LUDO KING** · Package: `gen-z-ludo-king` · Version 1.0.0

## 🪙 Gold system

Gold is the main currency (gold coin icon, `#f5b82e`) — called **Gold** everywhere.

| | Gold |
|---|---|
| Start | **100 Gold** |
| Win a match | **+150 Gold** |
| Capture a goti | **+20 Gold** per capture |
| Daily chests (Day 1–7) | **50 / 75 / 100 / 125 / 150 / 200 / 500 Gold** |
| Challenge: Win 1 match | **+100 Gold** |
| Challenge: Capture 2 gotis | **+80 Gold** |
| Challenge: Roll a 6 twice | **+60 Gold** |
| Share the app | **+250 Gold** (once/day) |
| Daily login streak | tracked to 365 days |

Store (Gold): **Vega 180 · Nyra 300 · Blaze 450 · Glitch 600 · Miso 750 · Chai Baba 900**.
Locked characters show their Gold price; owned show *Owned / Choose*.
Gold balance shows in the header on Home, HUD, Store, Rewards and Profile,
plus a Gold wallet + earn/spend history in Profile. It persists in
`localStorage` / Capacitor Preferences and never resets on reload.

## 💎 Dual currency — Gold + Diamonds

- **Gold** (main): start 100, win +150, capture +20, daily chests, challenges, Share +250.
- **Diamonds** (premium): start 10 💎. Earn from Lucky Spin + Watch Ad rewards.
  Spend on Board Worlds (Jungle 25💎, Ocean 40💎, Cloud 60💎) and Neon Dice (30💎).
- HUD shows both balances with + buttons (opens the Shop).

## 🛍️ Shop & billing (TEST MODE)

`src/store/billing.js` — **BillingManager, sandbox only: no real payment is taken.**
Tap Buy → confirmation modal → coin shower → instant credit.

| Pack | Price |
|---|---|
| 500 Gold | ₹29 |
| 1700 Gold — Popular | ₹79 |
| 6000 Gold — Best Value | ₹199 |
| 15000 Gold + VIP No-Ads | ₹499 |
| 50 / 150 / 500 Diamonds | ₹49 / ₹129 / ₹349 |

RevenueCat hook is commented in `billing.js` — swap `sandboxPurchase()` for
`Purchases.purchasePackage()` with your RevenueCat API key for real billing.

## 🎡 Free earning

- **Lucky Spin** — 1 free spin daily (Gold / Diamonds prizes).
- **Watch Ad** — +100 Gold per ad (AdMob hook + 3s dev simulator in `src/ui/online.js`).
- **Daily Bonus** — 7-day chests + 365-day streak (see Gold table).

## 🌐 Play Online / Friends (needs the server)

```
cd server
npm install
npm start          # http://localhost:3123  (health: /health)
```

- Matchmaking lobby 2P/4P, entry fees 100/500/1000/5000 Gold, **winner takes the pot**.
- Private rooms: 6-digit Room Code + Share (Capacitor Share).
- Authoritative dice: the **server** rolls (anti-cheat). Turn timer 15s,
  auto-roll on timeout, 3 timeouts → seat becomes a bot, reconnect within 60s.
- Without the server running, the app falls back to offline Local / Practice.
- To point the app at a hosted server, set `localStorage.setItem('genz.serverUrl','https://your-server')`.

## 🔐 Sign-in (optional Firebase)

The app runs immediately with **no keys** in demo/guest mode (LocalStorage profile).
To enable real Google Sign-In:

1. console.firebase.google.com → create project → Web app → copy config
2. Authentication → enable Google sign-in · Firestore → create database
3. Set `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`,
   `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`
   (see `src/auth/firebase.js`) and run `npm install` (firebase is in package.json).
4. Profile: avatar/DP, editable username, country flag, Level/XP bar, stats.

## 🎮 Game modes & variants

- **Play Online** — 2P/4P, entry fee, winner takes pot.
- **Play with Friends** — private 6-digit room code.
- **Pass & Play** — 2–4 Classic board, 5–8 Radial board, one phone.
- **Practice vs Computer** — Easy / Medium / Hard bots.
- **Variants** — Classic (all 4 home), Quick/Rush (1 home + 1 capture),
  Team Up 2v2 (both partners home).
- **Social** — Quick Chat presets, floating emoji/stickers, 15s turn-timer ring.

## Features

- **3D board** — 15×15 classic cross board (52-track, home lanes, 8 star safe
  tiles, centre trophy) + radial/octagonal board for 5–8 players.
- **4 worlds** — Classic, Jungle, Ocean Kingdom (animated water), Cloud Kingdom.
- **Walking characters** — hierarchical `THREE.Group` rigs, sine-wave legs/arms,
  body hop, auto-turn with `Math.atan2(dx, dz)`, tile stacking. Drop a `.glb`
  from Meshy/Mixamo into `public/models/<id>.glb` — see `loadGLB()` in
  `src/engine/characters.js`.
- **Full Ludo rules** — 6 to exit base, bonus on 6/capture/home, three 6s
  forfeit, exact roll home, glowing movable-piece ring, auto-move on 1 move.
- **Bots** — Easy / Medium / Hard (safe-tile preference, threat avoidance,
  capture priority). Switch Human ↔ Bot mid-game from Pause.
- **Capture finishers** — camera zoom + shake + haptics + `BONK!` / `SQUISH!`
  pop-up (Miso's *Paw of Judgment*), rival launched back to base.
- **Fair Play mode** — non-active players turn greyscale. Custom colour picker
  (presets + Hue / Intensity / Brightness sliders, live).
- **Daily rewards, challenges, profile stats** — all offline, local storage.
- **Sound** — Web Audio API synth SFX (dice, footsteps, bonk, coin, fanfare),
  mute toggle. **Haptics** — Capacitor Haptics + `navigator.vibrate` fallback.
- **Performance** — `devicePixelRatio` capped at 2, soft shadows, 60 FPS target
  on mid-range Android. WebGL failure shows a 2D fallback message.

## Project structure

```
server/index.js             Express + Socket.io authoritative server
server/package.json
src/auth/firebase.js        Firebase config + offline demo fallback
src/auth/auth.js            Google Sign-In / Guest / link stub / profile
src/social/social.js        Quick Chat, emoji, 15s turn-timer ring
src/store/billing.js        BillingManager (sandbox) + Gold/Diamond packs
src/ui/online.js            Online, Friends, Shop, Spin, Watch-Ad, Auth UI
index.html                  mobile viewport, safe-area, navy/gold/purple UI
capacitor.config.json       appId com.anish.genzludoking, webDir dist
vite.config.js
src/main.js                 bootstrap + screen router entry
src/engine/board.js         15x15 logic, 52-track, home lanes, safe stars
src/engine/board3d.js       Three.js board, camera, shadows, 4 worlds
src/engine/characters.js    rigs, walk animation, auto-turn, GLTF hook
src/engine/dice.js          3D tumbling die, settles on rolled number
src/engine/game.js          Ludo rules + Gold wiring
src/engine/ai.js            Easy/Medium/Hard bots
src/engine/storage.js       Gold wallet, persistence (Preferences/localStorage)
src/ui/screens.js           Home, Squad, HUD, Store, Rewards, Profile
src/ui/store.js             character store + Gold spend
src/ui/finishers.js         capture finisher sequence
src/ui/customize.js         Fair Play + colour picker
src/ui/rewards.js           daily chests, streak, challenges, wallet history
src/audio/sfx.js            Web Audio synth SFX
src/utils/haptics.js        Capacitor Haptics + vibrate fallback
```

## Run in the browser

```bash
cd gen-z-ludo-king   # folder is still ~/workspace/ludo-squad-3d
npm install
npm run dev        # http://127.0.0.1:5173
npm run build      # -> dist/
npm run preview    # serve the production build
```

Play: **Home → Local / Practice → Build your squad (2–8 players) → Let's go →
tap 🎲 → tap a glowing piece to move it.** Captures pay +20 Gold, wins +150 Gold.

## Build the Android APK / AAB (exact commands)

Requires Android Studio / Android SDK + JDK 21 on your machine (Capacitor 7 needs Java 21; JDK 17 fails with "invalid source release: 21").
The APK is **not** built in this repo checkout — Capacitor config is ready.

```bash
cd gen-z-ludo-king   # folder is still ~/workspace/ludo-squad-3d
npm install
npm run build

npx cap add android
npx cap sync

# Debug APK (installable on any phone):
cd android && ./gradlew assembleDebug
# -> android/app/build/outputs/apk/debug/app-debug.apk

# Release AAB for Google Play:
cd android && ./gradlew bundleRelease
# -> android/app/build/outputs/bundle/release/app-release.aab
```

After changing web code, always re-run `npm run build && npx cap sync`.

## Known limitations

- Online multiplayer **needs the server running** (`cd server && npm start`).
  Without it, the app falls back to offline Local / Practice play.
- 5–8 player mode uses the radial board layout; the 3D board mesh is still
  the classic cross board with radial seat spacing for pieces.
- Character models are procedural Three.js rigs; `.glb` models are a drop-in
  hook, not bundled (keeps the APK small and offline).
- Debug APK is unsigned; for Play Store release, sign the AAB with your
  own keystore (`keytool` + `gradle.properties` signing config).

## License

MIT — see `LICENSE` if added. Built for Anish.
