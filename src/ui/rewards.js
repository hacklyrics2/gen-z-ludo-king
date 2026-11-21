// rewards.js — 7-day daily Gold chests, 365-day streak, daily challenges,
// profile stats + Gold wallet history. All amounts are Gold.
// Chests: Day1 50, Day2 75, Day3 100, Day4 125, Day5 150, Day6 200, Day7 500.
// Challenges: Win 1 match +100 Gold, Capture 2 gotis +80 Gold, Roll 6 twice +60 Gold.
// Share app: +250 Gold (once per day).
import { loadSave, saveSave, addGold, GOLD, goldLabel, todayKey } from '../engine/storage.js'
import { sfx } from '../audio/sfx.js'

export function dayNumber(save) {
  // Streak day 1..7 cycles; streak.days counts consecutive days.
  return ((save.streak.days || 0) % 7) + 1
}
export function canClaimToday(save) {
  return save.streak.lastClaimDay !== todayKey()
}
export async function claimDailyReward() {
  const save = await loadSave()
  if (!canClaimToday(save)) return { ok: false, reason: 'Already claimed today — come back tomorrow!' }
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  const continuing = save.streak.lastClaimDay === yesterday
  const days = continuing ? (save.streak.days || 0) + 1 : 1
  const day = ((days - 1) % 7) + 1
  const amount = GOLD.DAILY[day - 1]
  save.streak = { lastClaimDay: todayKey(), days, best: Math.max(save.streak.best || 0, days) }
  save.rewardsClaimed[todayKey()] = amount
  await saveSave(save)
  const after = await addGold(amount, `Daily reward — Day ${day}`)
  sfx.coin()
  return { ok: true, day, amount, streak: days, balance: after.gold }
}

export async function claimChallenge(id) {
  const save = await loadSave()
  const need = { win1: 1, capture2: 2, roll6: 2 }[id]
  const have = save.challenges[id] || 0
  if (have < need) return { ok: false, reason: `Progress ${have}/${need} — keep playing!` }
  if (save.challenges.claimed[id] === todayKey()) return { ok: false, reason: 'Already claimed today' }
  const amount = GOLD.CHALLENGES[id]
  save.challenges.claimed[id] = todayKey()
  save.challenges[id] = 0 // reset progress for tomorrow
  await saveSave(save)
  const after = await addGold(amount, `Challenge: ${id}`)
  sfx.coin()
  return { ok: true, amount, balance: after.gold }
}

export async function shareForGold() {
  const save = await loadSave()
  if (save.challenges.claimed.share === todayKey()) return { ok: false, reason: 'Share bonus already claimed today' }
  save.challenges.claimed.share = todayKey()
  await saveSave(save)
  try { if (navigator.share) await navigator.share({ title: 'GEN-Z LUDO KING', text: 'Your table. Your rules. Play GEN-Z LUDO KING offline with me!' }) } catch { /* user cancelled — still award, they tapped share */ }
  const after = await addGold(GOLD.SHARE, 'Shared GEN-Z LUDO KING')
  sfx.coin()
  return { ok: true, amount: GOLD.SHARE, balance: after.gold }
}

export function renderRewards(gridEl, listEl, streakEl) {
  loadSave().then(save => {
    if (streakEl) streakEl.textContent = String(save.streak.days || 0)
    if (gridEl) {
      gridEl.innerHTML = ''
      GOLD.DAILY.forEach((amount, i) => {
        const day = i + 1
        const claimed = save.streak.days >= day && save.streak.lastClaimDay === todayKey()
        const d = document.createElement('div')
        d.className = 'tile' + (dayNumber(save) === day ? ' selected' : '')
        d.innerHTML = `<b>Day ${day}</b><span>${goldLabel(amount)}${claimed ? ' · ✓ claimed' : ''}</span>`
        gridEl.appendChild(d)
      })
    }
    if (listEl) {
      const rows = [
        { id: 'win1', label: 'Win 1 match', reward: GOLD.CHALLENGES.win1, have: save.challenges.win1 || 0, need: 1 },
        { id: 'capture2', label: 'Capture 2 gotis', reward: GOLD.CHALLENGES.capture2, have: save.challenges.capture2 || 0, need: 2 },
        { id: 'roll6', label: 'Roll a 6 twice', reward: GOLD.CHALLENGES.roll6, have: save.challenges.roll6 || 0, need: 2 }
      ]
      listEl.innerHTML = ''
      for (const r of rows) {
        const div = document.createElement('div')
        div.className = 'charRow'
        div.innerHTML = `<div style="flex:1"><b>${r.label}</b><div class="muted">${r.have}/${r.need} · ${goldLabel(r.reward)}</div><div class="bar"><i style="width:${Math.min(100, (r.have / r.need) * 100)}%"></i></div></div><button class="btn small" ${r.have < r.need ? 'disabled' : ''}>Claim</button>`
        div.querySelector('button').addEventListener('click', async () => {
          const res = await claimChallenge(r.id)
          alert(res.ok ? `+${res.amount} Gold! Balance: ${res.balance} Gold` : res.reason)
          renderRewards(gridEl, listEl, streakEl)
        })
        listEl.appendChild(div)
      }
    }
  })
}

export function renderProfile(statsEl, walletEl, historyEl) {
  loadSave().then(save => {
    if (statsEl) {
      const s = save.stats
      statsEl.innerHTML = `
        <div class="grid2">
          <div><b style="font-size:22px">🪙 ${save.gold}</b><div class="muted">Gold balance</div></div>
          <div><b style="font-size:22px">🔥 ${save.streak.days || 0}</b><div class="muted">Day streak (best ${save.streak.best || 0})</div></div>
          <div><b style="font-size:22px">${s.matches || 0}</b><div class="muted">Matches played</div></div>
          <div><b style="font-size:22px">${s.wins || 0}</b><div class="muted">Matches won</div></div>
          <div><b style="font-size:22px">${s.captures || 0}</b><div class="muted">Captures</div></div>
          <div><b style="font-size:22px">${s.totalGoldEarned || 0}</b><div class="muted">Total Gold earned</div></div>
        </div>`
    }
    if (walletEl) walletEl.textContent = `Balance: ${goldLabel(save.gold)} · Total earned: ${goldLabel(save.stats.totalGoldEarned || 0)}`
    if (historyEl) {
      const h = save.goldHistory || []
      historyEl.innerHTML = h.length ? h.slice(0, 10).map(x =>
        `<div class="charRow" style="margin:4px 0"><span>${x.type === 'earn' ? '➕' : '➖'}</span><div style="flex:1"><b>${x.reason}</b><div class="muted">${new Date(x.at).toLocaleString('en-IN')}</div></div><b style="color:${x.amount > 0 ? '#f5b82e' : '#f87171'}">${x.amount > 0 ? '+' : ''}${x.amount} Gold</b></div>`
      ).join('') : '<p class="muted">No Gold activity yet — win a match or claim a daily chest.</p>'
    }
  })
}
