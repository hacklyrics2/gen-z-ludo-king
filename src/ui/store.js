// store.js — character store + Gold economy.
// Prices in Gold: Vega 180, Nyra 300, Blaze 450, Glitch 600, Miso 750, Chai Baba 900.
// Starters are free/owned. Locked shows Gold price; owned shows Owned/Choose.
import { CHARACTER_LIST } from '../engine/characters.js'
import { loadSave, saveSave, spendGold, goldLabel } from '../engine/storage.js'
import { sfx } from '../audio/sfx.js'
import { hapticCoin } from '../utils/haptics.js'
import { snapshotCharacter } from './preview3d.js'

export async function renderStore(listEl, coinsEl, onGoldChange) {
  const save = await loadSave()
  if (coinsEl) coinsEl.textContent = goldLabel(save.gold)
  listEl.innerHTML = ''
  for (const c of CHARACTER_LIST) {
    const owned = save.unlocked.includes(c.id)
    const selected = save.selectedCharacter === c.id
    const row = document.createElement('div')
    row.className = 'charRow'
    row.innerHTML = `
      <img class="charThumb" alt="${c.name} 3D preview" src="${snapshotCharacter(c.id, '#ef4444', 120) || ''}" onerror="this.style.display='none'" />
      <div style="flex:1;min-width:0">
        <b>${c.name}</b> <span class="pill">${c.title}</span>
        <div class="muted">${c.finisherDesc}</div>
        <div class="muted" style="color:#f5b82e">“${c.catchphrase}”</div>
      </div>
      <button class="btn small ${owned ? 'secondary' : ''}" ${!owned && save.gold < c.price ? 'disabled' : ''}>
        ${owned ? (selected ? '✓ Chosen' : 'Choose') : goldLabel(c.price)}
      </button>`
    const btn = row.querySelector('button')
    btn.addEventListener('click', async () => {
      const s = await loadSave()
      if (s.unlocked.includes(c.id)) {
        await saveSave({ selectedCharacter: c.id })
        sfx.click(); onGoldChange?.(s.gold)
        renderStore(listEl, coinsEl, onGoldChange)
        return
      }
      const res = await spendGold(c.price, `Unlocked ${c.name}`)
      if (!res.ok) { alert(`Not enough Gold — you need ${c.price} Gold for ${c.name}.`); return }
      const s2 = await loadSave()
      s2.unlocked.push(c.id); s2.selectedCharacter = c.id
      await saveSave(s2)
      sfx.unlock(); hapticCoin()
      onGoldChange?.(s2.gold)
      renderStore(listEl, coinsEl, onGoldChange)
    })
    listEl.appendChild(row)
  }
}
