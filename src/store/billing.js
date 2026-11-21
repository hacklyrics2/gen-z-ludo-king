// billing.js — BillingManager, TEST / SANDBOX buy mode.
// No real payment is taken in this build: tapping Buy opens a confirmation
// modal, shows a coin shower, and credits Gold/Diamonds instantly.
// RevenueCat hook (commented): replace `sandboxPurchase()` with
// `Purchases.purchasePackage()` once you add your RevenueCat API key.
//
// Packs:
//   500 Gold ......... ₹29
//   1700 Gold ........ ₹79  (Popular)
//   6000 Gold ........ ₹199 (Best Value)
//   15000 Gold + VIP No-Ads ₹499
//   Diamond packs: 50 💎 ₹49 · 150 💎 ₹129 · 500 💎 ₹349
import { loadSave, saveSave, addGold, addDiamonds, goldLabel, diamondLabel } from '../engine/storage.js'
import { sfx } from '../audio/sfx.js'

export const GOLD_PACKS = [
  { id: 'gold500', gold: 500, diamonds: 0, priceInr: 29, tag: '' },
  { id: 'gold1700', gold: 1700, diamonds: 0, priceInr: 79, tag: 'Popular' },
  { id: 'gold6000', gold: 6000, diamonds: 0, priceInr: 199, tag: 'Best Value' },
  { id: 'gold15000', gold: 15000, diamonds: 0, priceInr: 499, tag: 'VIP · No Ads', vip: true }
]
export const DIAMOND_PACKS = [
  { id: 'dia50', gold: 0, diamonds: 50, priceInr: 49, tag: '' },
  { id: 'dia150', gold: 0, diamonds: 150, priceInr: 129, tag: 'Popular' },
  { id: 'dia500', gold: 0, diamonds: 500, priceInr: 349, tag: 'Best Value' }
]

// --- RevenueCat hook (uncomment when ready) ---
// import { Purchases } from '@revenuecat/purchases-capacitor'
// await Purchases.configure({ apiKey: 'YOUR_REVENUECAT_API_KEY' })
// const { customerInfo } = await Purchases.purchasePackage(pkg)
// if (customerInfo.entitlements.active['vip']) { ... }

export class BillingManager {
  constructor({ onCredit } = {}) { this.onCredit = onCredit || (() => {}) }
  // Sandbox purchase: confirm modal -> coin shower -> instant credit.
  async purchase(pack, confirmFn) {
    const label = pack.gold ? goldLabel(pack.gold) : diamondLabel(pack.diamonds)
    const ok = confirmFn ? await confirmFn(pack, label) : confirm(`TEST MODE — Buy ${label} for ₹${pack.priceInr}? No real payment will be taken.`)
    if (!ok) return { ok: false, reason: 'Cancelled' }
    // Simulate a 600ms store round-trip.
    await new Promise(r => setTimeout(r, 600))
    // const rc = await Purchases.purchasePackage(...) // real flow goes here
    let save
    if (pack.gold) save = await addGold(pack.gold, `Bought ${label} (TEST ₹${pack.priceInr})`)
    if (pack.diamonds) save = await addDiamonds(pack.diamonds, `Bought ${label} (TEST ₹${pack.priceInr})`)
    if (pack.vip) { save = await saveSave({ vip: true, noAds: true }) }
    sfx.unlock(); sfx.coin()
    this.onCredit(save)
    return { ok: true, save, pack }
  }
}
export const billing = new BillingManager()

// Coin shower: gold-coloured dots bursting from the button (DOM only).
export function coinShower(container) {
  if (!container) return
  for (let i = 0; i < 18; i++) {
    const el = document.createElement('div')
    el.textContent = '🪙'
    el.style.cssText = `position:fixed;left:${40 + Math.random() * 20}%;top:45%;font-size:22px;z-index:99;pointer-events:none;transition:all 900ms ease-out`
    document.body.appendChild(el)
    requestAnimationFrame(() => { el.style.top = `${55 + Math.random() * 30}%`; el.style.left = `${20 + Math.random() * 60}%`; el.style.opacity = '0'; el.style.transform = 'rotate(300deg)' })
    setTimeout(() => el.remove(), 950)
  }
}
