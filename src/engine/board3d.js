// board3d.js — Three.js board renderer: isometric camera, soft shadows,
// 4 switchable worlds. Guards WebGL failure (caller shows 2D fallback).
import * as THREE from 'three'
import { CLASSIC_TRACK, PLAYER_COLORS, gridToWorld } from './board.js'

export const WORLDS = {
  classic: { name: 'Classic', desc: 'Warm wood table & crisp tiles', table: 0x6b4226, tile: 0xf8f1de, accent: 0xf5b82e },
  jungle: { name: 'Jungle', desc: 'Mossy stone tiles & palm props', table: 0x1d3a24, tile: 0x9db08a, accent: 0x4ade80 },
  ocean: { name: 'Ocean Kingdom', desc: 'Shimmering water & coral corners', table: 0x0b3b5e, tile: 0xbfe8f2, accent: 0x22d3ee },
  cloud: { name: 'Cloud Kingdom', desc: 'Floating clouds & pastel sky', table: 0x7c6bb5, tile: 0xfff7ed, accent: 0xf0abfc }
}

export class Board3D {
  constructor(container) {
    this.container = container
    this.world = 'classic'
    this.clock = new THREE.Clock()
    this.animations = [] // {update(dt,t), done}
    this.pieceAnchors = new Map() // key `${player}:${piece}` -> THREE.Group
    this.worldProps = new THREE.Group()
    this.water = null; this.clouds = []
    let renderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    } catch (e) { throw new Error('WebGL unavailable: ' + e.message) }
    this.renderer = renderer
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.outputColorSpace = THREE.SRGBColorSpace
    container.appendChild(renderer.domElement)

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x0d1526)
    this.scene.fog = new THREE.Fog(0x0d1526, 26, 46)
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100)
    this.setCameraHome()

    const hemi = new THREE.HemisphereLight(0xfff4d6, 0x1a2c4d, 0.9); this.scene.add(hemi)
    this.sun = new THREE.DirectionalLight(0xffffff, 1.6)
    this.sun.position.set(8, 14, 6); this.sun.castShadow = true
    this.sun.shadow.mapSize.set(1024, 1024)
    this.sun.shadow.camera.left = -11; this.sun.shadow.camera.right = 11
    this.sun.shadow.camera.top = 11; this.sun.shadow.camera.bottom = -11
    this.scene.add(this.sun)

    this.boardGroup = new THREE.Group(); this.scene.add(this.boardGroup)
    this.scene.add(this.worldProps)
    this.buildBoard('classic')
    this.resize()
    window.addEventListener('resize', () => this.resize())
    this._raf = null
    this.startLoop()
  }

  setCameraHome() {
    this.camera.position.set(0, 15.5, 11.5)
    this.camera.lookAt(0, 0, 0.4)
    this.cameraHome = this.camera.position.clone()
  }
  shake(amount = 0.35, ms = 350) {
    const start = performance.now()
    const orig = this.cameraHome.clone()
    const step = () => {
      const el = performance.now() - start
      if (el > ms) { this.camera.position.copy(orig); this.camera.lookAt(0, 0, 0.4); return }
      const k = amount * (1 - el / ms)
      this.camera.position.set(orig.x + (Math.random() - 0.5) * k, orig.y + (Math.random() - 0.5) * k * 0.5, orig.z + (Math.random() - 0.5) * k)
      this.camera.lookAt(0, 0, 0.4)
      requestAnimationFrame(step)
    }
    step()
  }
  zoomTo(pos, ms = 450) {
    const from = this.camera.position.clone()
    const to = new THREE.Vector3(pos.x * 0.7, 9, pos.z * 0.7 + 6)
    const start = performance.now()
    const step = () => {
      const t = Math.min(1, (performance.now() - start) / ms)
      const e = 1 - Math.pow(1 - t, 3)
      this.camera.position.lerpVectors(from, to, e)
      this.camera.lookAt(pos.x, 0, pos.z)
      if (t < 1) requestAnimationFrame(step)
      else setTimeout(() => { this.camera.position.copy(this.cameraHome); this.camera.lookAt(0, 0, 0.4) }, 700)
    }
    step()
  }

  buildBoard(worldId) {
    this.world = worldId
    const w = WORLDS[worldId] || WORLDS.classic
    // Clear old board (keep piece anchors — they are re-parented in game.js).
    while (this.boardGroup.children.length) { const c = this.boardGroup.children.pop(); c.traverse?.(o => { o.geometry?.dispose?.() }) }
    while (this.worldProps.children.length) this.worldProps.children.pop()
    this.water = null; this.clouds = []
    this.scene.background = new THREE.Color(worldId === 'cloud' ? 0x8ea7d8 : worldId === 'ocean' ? 0x06283f : 0x0d1526)

    const table = new THREE.Mesh(new THREE.BoxGeometry(17.5, 0.6, 17.5), new THREE.MeshStandardMaterial({ color: w.table, roughness: 0.85 }))
    table.position.y = -0.55; table.receiveShadow = true; this.boardGroup.add(table)
    const base = new THREE.Mesh(new THREE.BoxGeometry(14.6, 0.5, 14.6), new THREE.MeshStandardMaterial({ color: w.tile, roughness: 0.6 }))
    base.position.y = -0.05; base.receiveShadow = true; this.boardGroup.add(base)

    // 52 track tiles.
    const tileGeo = new THREE.BoxGeometry(0.86, 0.22, 0.86)
    const safeSet = new Set([0, 8, 13, 21, 26, 34, 39, 47])
    CLASSIC_TRACK.forEach((tile, i) => {
      const p = gridToWorld(tile.c, tile.r)
      const isSafe = safeSet.has(i)
      const color = isSafe ? w.accent : (i % 2 ? 0xffffff : 0xf1f5f9)
      const m = new THREE.Mesh(tileGeo, new THREE.MeshStandardMaterial({ color, roughness: 0.55 }))
      m.position.set(p.x, 0.28, p.z); m.receiveShadow = true; m.castShadow = false
      this.boardGroup.add(m)
      if (isSafe) {
        const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), new THREE.MeshStandardMaterial({ color: 0xf5b82e, roughness: 0.3, metalness: 0.4, emissive: 0x7a5a00 }))
        star.position.set(p.x, 0.55, p.z); this.boardGroup.add(star)
      }
    })
    // Home lanes (coloured strips toward centre).
    const lanes = [
      { color: 0xef4444, cells: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]] },
      { color: 0x22c55e, cells: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]] },
      { color: 0xfacc15, cells: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]] },
      { color: 0x3b82f6, cells: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]] }
    ]
    for (const lane of lanes) for (const [c, r] of lane.cells) {
      const p = gridToWorld(c, r)
      const m = new THREE.Mesh(tileGeo, new THREE.MeshStandardMaterial({ color: lane.color, roughness: 0.5 }))
      m.position.set(p.x, 0.28, p.z); m.receiveShadow = true; this.boardGroup.add(m)
    }
    // Base yards (4 corners).
    const yards = [[2.5, 2.5, 0xef4444], [11.5, 2.5, 0x22c55e], [11.5, 11.5, 0xfacc15], [2.5, 11.5, 0x3b82f6]]
    for (const [c, r, color] of yards) {
      const p = gridToWorld(c, r)
      const yard = new THREE.Mesh(new THREE.CylinderGeometry(1.85, 1.95, 0.3, 4), new THREE.MeshStandardMaterial({ color, roughness: 0.6 }))
      yard.position.set(p.x, 0.3, p.z); yard.rotation.y = Math.PI / 4; yard.receiveShadow = true; this.boardGroup.add(yard)
      const inner = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.34, 4), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }))
      inner.position.set(p.x, 0.32, p.z); inner.rotation.y = Math.PI / 4; this.boardGroup.add(inner)
    }
    // Raised centre trophy goal.
    const centre = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.9, 4), new THREE.MeshStandardMaterial({ color: w.accent, roughness: 0.35, metalness: 0.35 }))
    centre.position.set(0, 0.85, 0); centre.rotation.y = Math.PI / 4; centre.castShadow = true; this.boardGroup.add(centre)
    const trophy = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), new THREE.MeshStandardMaterial({ color: 0xffd75e, roughness: 0.2, metalness: 0.8, emissive: 0x664400 }))
    trophy.position.set(0, 1.55, 0); this.boardGroup.add(trophy)

    // World props.
    if (worldId === 'jungle') {
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2
        const palm = new THREE.Group()
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, 1.4, 6), new THREE.MeshStandardMaterial({ color: 0x7c4a21 }))
        trunk.position.y = 0.7; palm.add(trunk)
        for (let l = 0; l < 5; l++) {
          const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.1, 4), new THREE.MeshStandardMaterial({ color: 0x22c55e }))
          leaf.position.set(Math.cos(l * 1.26) * 0.35, 1.5, Math.sin(l * 1.26) * 0.35); leaf.rotation.z = Math.cos(l * 1.26) * 0.9; palm.add(leaf)
        }
        palm.position.set(Math.cos(a) * 8.6, 0, Math.sin(a) * 8.6); this.worldProps.add(palm)
      }
    }
    if (worldId === 'ocean') {
      const water = new THREE.Mesh(new THREE.PlaneGeometry(34, 34), new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.55 }))
      water.rotation.x = -Math.PI / 2; water.position.y = -0.28; this.worldProps.add(water); this.water = water
      for (let i = 0; i < 8; i++) {
        const coral = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.9 + (i % 3) * 0.3, 6), new THREE.MeshStandardMaterial({ color: [0xf472b6, 0xfb923c, 0x22d3ee][i % 3] }))
        const a = (i / 8) * Math.PI * 2; coral.position.set(Math.cos(a) * 8.8, 0.2, Math.sin(a) * 8.8); this.worldProps.add(coral)
      }
    }
    if (worldId === 'cloud') {
      for (let i = 0; i < 9; i++) {
        const cloud = new THREE.Group()
        for (let j = 0; j < 4; j++) {
          const puff = new THREE.Mesh(new THREE.SphereGeometry(0.55 + Math.random() * 0.3, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }))
          puff.position.set(j * 0.6 - 0.9, Math.random() * 0.2, Math.random() * 0.4 - 0.2); cloud.add(puff)
        }
        const a = (i / 9) * Math.PI * 2
        cloud.position.set(Math.cos(a) * (8 + Math.random() * 2), 1.2 + Math.random() * 1.6, Math.sin(a) * (8 + Math.random() * 2))
        this.worldProps.add(cloud); this.clouds.push(cloud)
      }
    }
  }

  setWorld(id) { this.buildBoard(id) }
  resize() {
    const w = this.container.clientWidth || 360, h = this.container.clientHeight || 360
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h, false)
  }
  startLoop() {
    const tick = () => {
      this._raf = requestAnimationFrame(tick)
      const dt = Math.min(this.clock.getDelta(), 0.05)
      const t = this.clock.elapsedTime
      if (this.water) { this.water.position.y = -0.28 + Math.sin(t * 1.2) * 0.05; this.water.material.opacity = 0.5 + Math.sin(t * 0.8) * 0.08 }
      for (const c of this.clouds) { c.position.x += Math.sin(t * 0.3 + c.position.z) * 0.0015; c.position.y += Math.cos(t * 0.5) * 0.001 }
      for (let i = this.animations.length - 1; i >= 0; i--) {
        const a = this.animations[i]
        if (a.update(dt, t)) this.animations.splice(i, 1)
      }
      this.renderer.render(this.scene, this.camera)
    }
    tick()
  }
  addAnimation(fn) { this.animations.push({ update: fn }) }
  dispose() {
    if (this._raf) cancelAnimationFrame(this._raf)
    window.removeEventListener('resize', () => this.resize())
    this.renderer?.dispose?.()
    this.renderer?.domElement?.remove?.()
  }
  // Highlight ring under a movable piece.
  makeRing(color = 0xf5b82e) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.07, 10, 28), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.7 }))
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.42
    return ring
  }
}
