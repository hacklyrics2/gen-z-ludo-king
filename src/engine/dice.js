// dice.js — interactive 3D tumbling die. Rolls, bounces, settles cleanly
// on the rolled number (1-6). Face orientation is derived from the die's
// rotation, so the top face always matches the value.
import * as THREE from 'three'
import { sfx } from '../audio/sfx.js'
import { hapticDice } from '../utils/haptics.js'

// Euler rotations (radians) that put each face on top.
const FACE_ROT = {
  1: [0, 0, 0], 2: [0, 0, Math.PI / 2], 3: [Math.PI / 2, 0, 0],
  4: [-Math.PI / 2, 0, 0], 5: [0, 0, -Math.PI / 2], 6: [0, Math.PI, 0]
}
function pipTexture(n) {
  const c = document.createElement('canvas'); c.width = c.height = 128
  const g = c.getContext('2d')
  g.fillStyle = '#fff8e6'; g.fillRect(0, 0, 128, 128)
  g.fillStyle = '#111827'
  const P = { 1: [[64, 64]], 2: [[36, 36], [92, 92]], 3: [[32, 32], [64, 64], [96, 96]], 4: [[36, 36], [92, 36], [36, 92], [92, 92]], 5: [[32, 32], [96, 32], [64, 64], [32, 96], [96, 96]], 6: [[36, 30], [92, 30], [36, 64], [92, 64], [36, 98], [92, 98]] }
  for (const [x, y] of P[n] || []) { g.beginPath(); g.arc(x, y, 13, 0, Math.PI * 2); g.fill() }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; return tex
}

export class Dice3D {
  constructor(scene, board3d) {
    this.scene = scene; this.board = board3d; this.value = 1; this.rolling = false
    // BoxGeometry face order: +x,-x,+y,-y,+z,-z -> values 3,4,1,6,2,5 (opposites sum to 7).
    const faceValues = [3, 4, 1, 6, 2, 5]
    const mats = faceValues.map(v => new THREE.MeshStandardMaterial({ map: pipTexture(v), roughness: 0.35 }))
    this.mesh = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), mats)
    this.mesh.castShadow = true
    this.mesh.position.set(9.2, 0.7, 5.2) // parked at the board edge, out of the way
    this.home = this.mesh.position.clone()
    scene.add(this.mesh)
    this.onSettle = null
  }
  async roll() {
    if (this.rolling) return this.value
    this.rolling = true
    const value = 1 + Math.floor(Math.random() * 6)
    this.value = value
    sfx.dice(); hapticDice()
    const target = FACE_ROT[value]
    const start = performance.now(), dur = 850 + Math.random() * 250
    const fromRot = { x: this.mesh.rotation.x, y: this.mesh.rotation.y, z: this.mesh.rotation.z }
    const spins = { x: fromRot.x + Math.PI * 2 * (2 + Math.floor(Math.random() * 2)), y: fromRot.y + Math.PI * 2 * 2, z: fromRot.z + Math.PI * 2 * (2 + Math.floor(Math.random() * 2)) }
    // Final rotation must equal target modulo 2PI.
    const endRot = {
      x: spins.x + ((target[0] - (spins.x % (Math.PI * 2)) + Math.PI * 4) % (Math.PI * 2)),
      y: spins.y + ((target[1] - (spins.y % (Math.PI * 2)) + Math.PI * 4) % (Math.PI * 2)),
      z: spins.z + ((target[2] - (spins.z % (Math.PI * 2)) + Math.PI * 4) % (Math.PI * 2))
    }
    const centre = new THREE.Vector3(0, 0.7, 0)
    await new Promise(res => {
      const step = () => {
        const t = Math.min(1, (performance.now() - start) / dur)
        const e = 1 - Math.pow(1 - t, 3)
        this.mesh.rotation.set(fromRot.x + (endRot.x - fromRot.x) * e, fromRot.y + (endRot.y - fromRot.y) * e, fromRot.z + (endRot.z - fromRot.z) * e)
        this.mesh.position.lerpVectors(this.home, centre, Math.sin(Math.min(1, t * 1.4) * Math.PI / 2))
        this.mesh.position.y = 0.7 + Math.abs(Math.sin(t * Math.PI * 3)) * (1 - t) * 1.1
        if (t < 1) requestAnimationFrame(step); else { this.mesh.position.copy(centre); this.mesh.position.y = 0.7; res() }
      }
      step()
    })
    this.rolling = false
    this.onSettle?.(value)
    return value
  }
  reset() { this.mesh.position.copy(this.home); this.mesh.rotation.set(0, 0, 0) }
  // Dice skins: Classic (cream), Gold, Neon Cyber — tint the die faces.
  setSkin(skinId) {
    const colors = { classic: 0xffffff, gold: 0xf5b82e, neon: 0x22d3ee }
    const c = colors[skinId] || 0xffffff
    for (const m of this.mesh.material) { m.color.setHex(c); m.emissive.setHex(skinId === 'neon' ? 0x0e7490 : 0x000000); m.emissiveIntensity = skinId === 'neon' ? 0.5 : 0 }
  }
}
