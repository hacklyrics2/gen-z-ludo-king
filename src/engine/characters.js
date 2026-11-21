// characters.js — articulated 3D cartoon characters.
// Hierarchy (as specified): rootGroup (X/Z + facing rotation Y)
//   -> bodyGroup (walk bounce) -> torso, head (hats/glasses/ears),
//      leftLegPivot, rightLegPivot, leftArmPivot, rightArmPivot.
// GLTF drop-in hook: replace buildProceduralRig() with loadGLB(url) below —
// drop a .glb from Meshy / Mixamo into public/models/<id>.glb and set
// CHARACTERS[id].glb = 'models/<id>.glb'. The loader keeps the same
// rootGroup/bodyGroup contract, so game.js needs no changes.
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

export const CHARACTERS = {
  grandpa:     { id: 'grandpa', name: 'Grandpa', title: 'The Stick Master', emoji: '👴', color: 0x2e7d6b, price: 0, catchphrase: 'Oye! Piche dekho, piche!', finisher: 'BONK!', finisherDesc: 'Swings his walking stick to BONK the rival.', prop: 'stick' },
  grandma:     { id: 'grandma', name: 'Grandma', title: 'The Chai Queen', emoji: '👵', color: 0xd94f70, price: 0, catchphrase: 'Beta, chai pee lo!', finisher: 'BONK!', finisherDesc: 'A loving but firm rolling-pin bonk.', prop: 'bun' },
  boss:        { id: 'boss', name: 'Boss', title: 'The Boardroom Shark', emoji: '🤵', color: 0x1f2937, price: 0, catchphrase: 'Meeting in 5 minutes!', finisher: 'BONK!', finisherDesc: 'Fires the rival with a briefcase bonk.', prop: 'tie' },
  gymbro:      { id: 'gymbro', name: 'Gym Bro', title: 'The Protein Prince', emoji: '💪', color: 0xea580c, price: 0, catchphrase: 'One more rep, bro!', finisher: 'BONK!', finisherDesc: 'Flexes so hard the rival bounces away.', prop: 'dumbbell' },
  influencer:  { id: 'influencer', name: 'Influencer', title: 'The Viral Star', emoji: '🤳', color: 0xec4899, price: 0, catchphrase: 'Like, share, subscribe!', finisher: 'BONK!', finisherDesc: 'Cancels the rival live on camera.', prop: 'phone' },
  vega:        { id: 'vega', name: 'Vega', title: 'The Neon Drifter', emoji: '🛸', color: 0x7c3aed, price: 180, catchphrase: 'Catch me if you can.', finisher: 'ZAP!', finisherDesc: 'Neon dash leaves the rival sparking.', prop: 'visor' },
  nyra:        { id: 'nyra', name: 'Nyra', title: 'The Tide Caller', emoji: '🌊', color: 0x0ea5e9, price: 300, catchphrase: 'Ride the wave.', finisher: 'SPLASH!', finisherDesc: 'A tidal wave washes the rival home.', prop: 'wave' },
  blaze:       { id: 'blaze', name: 'Blaze', title: 'The Ember Kid', emoji: '🔥', color: 0xdc2626, price: 450, catchphrase: 'Too hot to handle.', finisher: 'BOOM!', finisherDesc: 'Fireball sends the rival flying.', prop: 'flame' },
  glitch:      { id: 'glitch', name: 'Glitch', title: 'The Pixel Phantom', emoji: '👾', color: 0x22d3ee, price: 600, catchphrase: 'Error 404: rival not found.', finisher: 'GLITCH!', finisherDesc: 'Pixel-shatters the rival into cubes.', prop: 'antenna' },
  miso:        { id: 'miso', name: 'Miso', title: 'The Nap Champion', emoji: '🐱', color: 0xa855f7, price: 750, catchphrase: 'Meow. That is all.', finisher: 'SQUISH!', finisherDesc: 'Paw of Judgment: a gigantic plush paw squishes the rival flat, then bounces them back to base.', prop: 'hoodie' },
  chaibaba:    { id: 'chaibaba', name: 'Chai Baba', title: 'The Street Sage', emoji: '🧔', color: 0xb45309, price: 900, catchphrase: 'Chai garam, game garam!', finisher: 'BONK!', finisherDesc: 'Chai-kettle steam blast knocks the rival out.', prop: 'turban' }
}
export const CHARACTER_LIST = Object.values(CHARACTERS)

const _loader = new GLTFLoader()
export function loadGLB(url) {
  // Drop-in hook: returns a Promise<THREE.Group>. Usage:
  //   const g = await loadGLB('models/miso.glb'); rig.rootGroup.add(g)
  return new Promise((resolve, reject) => _loader.load(url, gltf => resolve(gltf.scene), undefined, reject))
}

function mat(color, rough = 0.7) { return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.05 }) }

export function buildCharacterRig(def, playerColor = '#ef4444', customColor = null) {
  const rootGroup = new THREE.Group()
  const bodyGroup = new THREE.Group()
  rootGroup.add(bodyGroup)
  const skin = 0xf2c89b
  const shirt = customColor ? new THREE.Color(customColor) : new THREE.Color(def.color)
  const pants = 0x1f2937

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.28, 4, 12), mat(shirt))
  torso.position.y = 0.62; torso.castShadow = true; bodyGroup.add(torso)
  // Player-colour sash so pieces stay identifiable even in Fair Play mode.
  const sash = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.09, 0.1), mat(new THREE.Color(playerColor)))
  sash.position.set(0, 0.78, 0.22); bodyGroup.add(sash)

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 20, 16), mat(skin))
  head.position.y = 1.12; head.castShadow = true; bodyGroup.add(head)
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3 })
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), eyeMat)
    eye.position.set(sx * 0.09, 1.14, 0.21); bodyGroup.add(eye)
  }
  // Distinct headgear per character.
  if (def.prop === 'stick' || def.id === 'grandpa') {
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.28, 0.08, 16), mat(0xffffff))
    hat.position.y = 1.3; bodyGroup.add(hat)
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 8), mat(0x8b5a2b))
    stick.position.set(0.34, 0.55, 0.1); stick.rotation.z = 0.15; bodyGroup.add(stick)
  }
  if (def.id === 'grandma') {
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), mat(0xe5e7eb))
    bun.position.set(0, 1.36, -0.05); bodyGroup.add(bun)
  }
  if (def.id === 'boss') {
    const tie = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.3, 0.04), mat(0xdc2626))
    tie.position.set(0, 0.68, 0.26); bodyGroup.add(tie)
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.09, 0.05), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2, metalness: 0.6 }))
    glass.position.set(0, 1.15, 0.2); bodyGroup.add(glass)
  }
  if (def.id === 'gymbro') {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.035, 8, 20), mat(0xef4444))
    band.position.y = 1.28; band.rotation.x = Math.PI / 2; bodyGroup.add(band)
  }
  if (def.id === 'miso') {
    // Cat ears + purple hoodie (the screenshot look).
    for (const sx of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.18, 4), mat(0xa855f7))
      ear.position.set(sx * 0.14, 1.34, 0); ear.rotation.z = -sx * 0.25; bodyGroup.add(ear)
    }
    const hood = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.07, 8, 18), mat(0xa855f7))
    hood.position.set(0, 1.0, 0); hood.rotation.x = Math.PI / 2 - 0.4; bodyGroup.add(hood)
  }
  if (def.id === 'chaibaba') {
    const turban = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xf59e0b))
    turban.position.y = 1.14; bodyGroup.add(turban)
  }
  if (def.id === 'glitch') {
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.22, 6), mat(0x22d3ee))
    ant.position.set(0.12, 1.4, 0); bodyGroup.add(ant)
  }
  if (def.id === 'vega') {
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.1, 0.06), new THREE.MeshStandardMaterial({ color: 0x22d3ee, roughness: 0.1, metalness: 0.7, emissive: 0x0e7490 }))
    visor.position.set(0, 1.16, 0.2); bodyGroup.add(visor)
  }

  function limb(px, py, isLeg) {
    const pivot = new THREE.Group(); pivot.position.set(px, py, 0)
    const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(isLeg ? 0.07 : 0.06, isLeg ? 0.26 : 0.24, 4, 8), mat(isLeg ? pants : skin))
    mesh.position.y = isLeg ? -0.2 : -0.18; mesh.castShadow = true; pivot.add(mesh)
    bodyGroup.add(pivot); return pivot
  }
  const leftLegPivot = limb(-0.12, 0.42, true)
  const rightLegPivot = limb(0.12, 0.42, true)
  const leftArmPivot = limb(-0.32, 0.88, false)
  const rightArmPivot = limb(0.32, 0.88, false)
  // Arms hang slightly outwards.
  leftArmPivot.rotation.z = 0.25; rightArmPivot.rotation.z = -0.25

  const rig = { rootGroup, bodyGroup, torso, head, leftLegPivot, rightLegPivot, leftArmPivot, rightArmPivot, def, walkPhase: 0, baseArmL: 0.25, baseArmR: -0.25 }
  rootGroup.traverse(o => { if (o.isMesh) o.castShadow = true })
  return rig
}

// Sine-wave walk: legs/arms swing opposite, body hops. t = phase (radians).
export function animateWalk(rig, phase, amplitude = 0.55) {
  rig.walkPhase = phase
  rig.leftLegPivot.rotation.x = Math.sin(phase) * amplitude
  rig.rightLegPivot.rotation.x = -Math.sin(phase) * amplitude
  rig.leftArmPivot.rotation.x = -Math.sin(phase) * amplitude * 0.8
  rig.rightArmPivot.rotation.x = Math.sin(phase) * amplitude * 0.8
  rig.bodyGroup.position.y = Math.abs(Math.sin(phase)) * 0.07
}
export function animateIdle(rig, time) {
  rig.leftLegPivot.rotation.x = 0; rig.rightLegPivot.rotation.x = 0
  rig.leftArmPivot.rotation.x = Math.sin(time * 1.6) * 0.08
  rig.rightArmPivot.rotation.x = -Math.sin(time * 1.6) * 0.08
  rig.bodyGroup.position.y = Math.sin(time * 2) * 0.02
  rig.bodyGroup.rotation.y = Math.sin(time * 0.8) * 0.04
}
// Face the walking direction: angle from delta, smoothed by caller.
export function facingAngle(dx, dz) { return Math.atan2(dx, dz) }
export function lerpAngle(a, b, t) {
  let d = (b - a) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return a + d * t
}
