import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'

const BAR_COUNT = 32

// Slowdown factors applied on top of the real per-track bpm so the pulse
// reads as music-reactive without feeling frantic — the carpet is calmed
// down more aggressively than the bars since it's a background element.
const BAR_SPEED_FACTOR = 0.75 // 25% slower
const CARPET_SPEED_FACTOR = 0.5 // 50% slower

export interface VisualizerFrame {
  progressMs: number
  durationMs: number
  bpm: number
  palette: string[]
  isPlaying: boolean
  volumeIntensity: number
}

/**
 * How far the incoming `progressMs` may differ from the locally interpolated
 * position before we treat it as a real seek / track change and resync.
 * The SDK reports position at roughly 1s granularity, so a smaller threshold
 * would fight the smooth local rAF interpolation on every event.
 */
export const PROGRESS_RESYNC_THRESHOLD_MS = 1500

export function shouldResyncProgress(
  incomingProgressMs: number,
  elapsedProgressMs: number,
  threshold = PROGRESS_RESYNC_THRESHOLD_MS,
): boolean {
  return Math.abs(incomingProgressMs - elapsedProgressMs) > threshold
}

export interface VisualizerHandle {
  setFrame: (frame: VisualizerFrame) => void
  resize: (width: number, height: number) => void
  dispose: () => void
}

export function createVisualizerScene(canvas: HTMLCanvasElement): VisualizerHandle {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100)
  camera.position.set(0, 4, 14)
  camera.lookAt(0, 0, 0)

  scene.add(new THREE.AmbientLight(0xffffff, 0.7))
  const keyLight = new THREE.PointLight(0xffffff, 2.5, 50)
  keyLight.position.set(5, 10, 8)
  scene.add(keyLight)
  const fillLight = new THREE.PointLight(0xffffff, 1.2, 50)
  fillLight.position.set(-6, 6, 10)
  scene.add(fillLight)

  const barGeometry = new THREE.BoxGeometry(0.4, 1, 0.4)
  // Low metalness with no environment map: a metallic surface reflects only
  // its environment, and without one it reads as near-black regardless of
  // `color` — only its direct specular highlight would show. Keeping
  // metalness low lets the diffuse term actually display each bar's color.
  const barMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x7fd8e8,
    metalness: 0.15,
    roughness: 0.3,
    clearcoat: 1,
    clearcoatRoughness: 0.1,
    transmission: 0,
  })

  const bars: THREE.Mesh[] = []
  for (let i = 0; i < BAR_COUNT; i++) {
    const bar = new THREE.Mesh(barGeometry, barMaterial.clone())
    bar.position.x = (i - BAR_COUNT / 2) * 0.55
    scene.add(bar)
    bars.push(bar)
  }

  const waveGeometry = new THREE.PlaneGeometry(20, 6, 80, 16)
  const waveMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xc9d6df,
    metalness: 0.3,
    roughness: 0.2,
    clearcoat: 1,
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide,
  })
  const wave = new THREE.Mesh(waveGeometry, waveMaterial)
  wave.rotation.x = -Math.PI / 2.4
  wave.position.y = -2
  scene.add(wave)

  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.9, 0.6, 0.1))

  let frame: VisualizerFrame = {
    progressMs: 0,
    durationMs: 1,
    bpm: 120,
    palette: ['#7fd8e8', '#c9d6df', '#3fa9c9', '#e8f4f8'],
    isPlaying: false,
    volumeIntensity: 1,
  }
  let rafId: number | null = null
  let lastTimestamp = performance.now()
  let elapsedProgressMs = 0

  const wavePositions = waveGeometry.attributes.position

  function animate(timestamp: number) {
    rafId = requestAnimationFrame(animate)
    const deltaMs = timestamp - lastTimestamp
    lastTimestamp = timestamp

    if (frame.isPlaying) {
      elapsedProgressMs += deltaMs
    }

    const beatMs = 60000 / (frame.bpm * BAR_SPEED_FACTOR)
    const beatPhase = (elapsedProgressMs % beatMs) / beatMs
    const palette = frame.palette.length > 0 ? frame.palette : ['#7fd8e8']

    bars.forEach((bar, i) => {
      const barPhase = (beatPhase + i / BAR_COUNT) % 1
      const height = 0.6 + Math.abs(Math.sin(barPhase * Math.PI * 2)) * 3 * frame.volumeIntensity
      bar.scale.y = height
      bar.position.y = height / 2 - 1.5
      const material = bar.material as THREE.MeshPhysicalMaterial
      material.color.set(palette[i % palette.length])
    })

    const carpetBeatMs = 60000 / (frame.bpm * CARPET_SPEED_FACTOR)
    const carpetBeatPhase = (elapsedProgressMs % carpetBeatMs) / carpetBeatMs
    const pulse = Math.abs(Math.sin(carpetBeatPhase * Math.PI * 2))
    const carpetElapsedMs = elapsedProgressMs * CARPET_SPEED_FACTOR

    for (let i = 0; i < wavePositions.count; i++) {
      const x = wavePositions.getX(i)
      const y = wavePositions.getY(i)
      const xWave = Math.sin(x * 0.5 + carpetElapsedMs * 0.002)
      const depthWave = Math.sin(y * 0.9 + x * 0.15 - carpetElapsedMs * 0.0015)
      const amplitude = (0.25 + pulse * 0.35) * frame.volumeIntensity
      const z = (xWave * 0.6 + depthWave * 0.4) * amplitude
      wavePositions.setZ(i, z)
    }
    wavePositions.needsUpdate = true

    composer.render()
  }
  rafId = requestAnimationFrame(animate)

  return {
    setFrame: (next) => {
      // Between events the animation runs off the local rAF clock; when the
      // reported position diverges (a seek, a track change, or drift after a
      // pause/throttle) snap the animation's position basis back to reality.
      if (shouldResyncProgress(next.progressMs, elapsedProgressMs)) {
        elapsedProgressMs = next.progressMs
      }
      frame = next
    },
    resize: (width, height) => {
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
      composer.setSize(width, height)
    },
    dispose: () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      renderer.dispose()
      barGeometry.dispose()
      barMaterial.dispose()
      waveGeometry.dispose()
      waveMaterial.dispose()
    },
  }
}
