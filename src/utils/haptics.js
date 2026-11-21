// haptics.js — Capacitor Haptics with navigator.vibrate fallback.
import { Haptics, ImpactStyle } from '@capacitor/haptics'

export async function haptic(style = 'light') {
  try {
    const map = { light: ImpactStyle.Light, medium: ImpactStyle.Medium, heavy: ImpactStyle.Heavy }
    await Haptics.impact({ style: map[style] || ImpactStyle.Light })
    return
  } catch { /* not native — fall through */ }
  try { if (navigator.vibrate) navigator.vibrate(style === 'heavy' ? 60 : style === 'medium' ? 30 : 12) } catch { /* no-op */ }
}
export const hapticDice = () => haptic('medium')
export const hapticStep = () => haptic('light')
export const hapticCapture = () => haptic('heavy')
export const hapticCoin = () => haptic('light')
