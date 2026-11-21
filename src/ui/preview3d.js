// preview3d.js — reusable small Three.js character previews.
// Two modes:
//  - snapshotCharacter(id, playerColor): renders ONE frame of a character
//    rig to a data-URL PNG and disposes the renderer immediately. Safe to
//    call for every row (squad, store, avatar picker) — no persistent
//    WebGL contexts are left open.
//  - startPreview(canvas, { ids, board }): a live animated scene — one
//    rotating character, or a hero mini-scene of several characters
//    standing around a small 3D Ludo board. Returns { stop() }.
import * as THREE from 'three'
import { buildCharacterRig, animateIdle, CHARACTERS } from '../engine/characters.js'

function makeScene() {
  const scene = new THREE.Scene()
  scene.background = null
  const hemi = new THREE.HemisphereLight(0xfff4d6, 0x1a2c4d, 1.1)
  scene.add(hemi)
  const sun = new THREE.DirectionalLight(0xffffff, 1.4)
  sun.position.set(4, 8, 5)
  scene.add(sun)
  return scene
}

export function snapshotCharacter(characterId, playerColor = '#ef4444', size = 120) {
  try {
    const def = CHARACTERS[characterId] || CHARACTERS.grandpa
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
    renderer.setPixelRatio(1)
    renderer.setSize(size, size)
    const scene = makeScene()
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100)
    camera.position.set(0, 1.6, 4.2)
    camera.lookAt(0, 0.75, 0)
    const rig = buildCharacterRig(def, playerColor)
    rig.rootGroup.position.y = 0
    rig.rootGroup.scale.setScalar(0.95)
    scene.add(rig.rootGroup)
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.62, 0.62, 0.08, 24),
      new THREE.MeshStandardMaterial({ color: 0x1a2c4d, roughness: 0.6 })
    )
    disc.position.y = -0.04
    scene.add(disc)
    animateIdle(rig, 0.6)
    renderer.render(scene, camera)
    const url = renderer.domElement.toDataURL('image/png')
    renderer.dispose()
    return url
  } catch (e) {
    console.warn('[preview3d] snapshot failed', characterId, e)
    return ''
  }
}

export function startPreview(canvas, { ids = ['grandpa'], board = false, playerColors = [] } = {}) {
  if (!canvas) return { stop() {} }
  let renderer
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  } catch (e) {
    console.warn('[preview3d] WebGL unavailable for preview', e)
    return { stop() {} }
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  const scene = makeScene()
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100)
  const rigs = []
  const n = ids.length
  if (board) {
    const table = new THREE.Mesh(
      new THREE.BoxGeometry(4.6, 0.35, 4.6),
      new THREE.MeshStandardMaterial({ color: 0xf8f1de, roughness: 0.6 })
    )
    table.position.y = -0.18
    scene.add(table)
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(4.6, 0.1, 4.6),
      new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.8 })
    )
    base.position.y = -0.42
    scene.add(base)
    // Colourful corner yards, like the real board.
    const yardColors = [0xef4444, 0x22c55e, 0xfacc15, 0x3b82f6]
    yardColors.forEach((c, i) => {
      const yard = new THREE.Mesh(
        new THREE.BoxGeometry(1.5, 0.12, 1.5),
        new THREE.MeshStandardMaterial({ color: c, roughness: 0.55 })
      )
      yard.position.set(i % 2 === 0 ? -1.35 : 1.35, 0.02, i < 2 ? -1.35 : 1.35)
      scene.add(yard)
    })
    const centre = new THREE.Mesh(
      new THREE.ConeGeometry(0.55, 0.5, 4),
      new THREE.MeshStandardMaterial({ color: 0xf5b82e, roughness: 0.35, metalness: 0.3 })
    )
    centre.position.y = 0.3
    centre.rotation.y = Math.PI / 4
    scene.add(centre)
  }
  ids.forEach((id, i) => {
    const def = CHARACTERS[id] || CHARACTERS.grandpa
    const rig = buildCharacterRig(def, playerColors[i] || '#ef4444')
    if (board) {
      const angle = (i / Math.max(1, n)) * Math.PI * 2 - Math.PI / 2
      rig.rootGroup.position.set(Math.cos(angle) * 2.15, 0, Math.sin(angle) * 2.15)
      rig.rootGroup.rotation.y = -angle + Math.PI / 2
      rig.rootGroup.scale.setScalar(0.62)
    } else {
      rig.rootGroup.position.set(0, 0, 0)
      rig.rootGroup.scale.setScalar(0.95)
    }
    scene.add(rig.rootGroup)
    rigs.push(rig)
  })

  let raf = 0
  let stopped = false
  const resize = () => {
    const w = canvas.clientWidth || 300
    const h = canvas.clientHeight || 160
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    if (board) { camera.position.set(0, 5.4, 6.4); camera.lookAt(0, 0, 0.2) }
    else { camera.position.set(0, 1.7, 4.4); camera.lookAt(0, 0.8, 0) }
    camera.updateProjectionMatrix()
  }
  resize()
  const tick = (t) => {
    if (stopped) return
    const time = t / 1000
    rigs.forEach((rig, i) => {
      animateIdle(rig, time + i * 0.9)
      if (!board) rig.rootGroup.rotation.y = time * 0.5
      else rig.rootGroup.rotation.y += 0.002
    })
    renderer.render(scene, camera)
    raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)
  const onResize = () => resize()
  window.addEventListener('resize', onResize)
  return {
    stop() {
      stopped = true
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      try { renderer.dispose() } catch { /* ignore */ }
    }
  }
}
