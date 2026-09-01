import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'

const BAR_COUNT = 32

export interface VisualizerFrame {
  progressMs: number
  durationMs: number
  bpm: number
  palette: string[]
  isPlaying: boolean
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

  scene.add(new THREE.AmbientLight(0xffffff, 0.4))
  const keyLight = new THREE.PointLight(0xffffff, 2, 50)
  keyLight.position.set(5, 10, 8)
  scene.add(keyLight)

  const barGeometry = new THREE.BoxGeometry(0.4, 1, 0.4)
  const barMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x7fd8e8,
    metalness: 0.6,
    roughness: 0.15,
    clearcoat: 1,
    clearcoatRoughness: 0.1,
    transmission: 0.2,
  })

  const bars: THREE.Mesh[] = []
  for (let i = 0; i < BAR_COUNT; i++) {
    const bar = new THREE.Mesh(barGeometry, barMaterial.clone())
    bar.position.x = (i - BAR_COUNT / 2) * 0.55
    scene.add(bar)
    bars.push(bar)
  }

  const waveGeometry = new THREE.PlaneGeometry(20, 6, 80, 1)
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

    const beatMs = 60000 / frame.bpm
    const beatPhase = (elapsedProgressMs % beatMs) / beatMs
    const palette = frame.palette.length > 0 ? frame.palette : ['#7fd8e8']

    bars.forEach((bar, i) => {
      const barPhase = (beatPhase + i / BAR_COUNT) % 1
      const height = 0.6 + Math.abs(Math.sin(barPhase * Math.PI * 2)) * 3
      bar.scale.y = height
      bar.position.y = height / 2 - 1.5
      const material = bar.material as THREE.MeshPhysicalMaterial
      material.color.set(palette[i % palette.length])
    })

    for (let i = 0; i < wavePositions.count; i++) {
      const x = wavePositions.getX(i)
      const z = Math.sin(x * 0.5 + elapsedProgressMs * 0.002) * 0.4
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
