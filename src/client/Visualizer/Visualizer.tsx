import { useEffect, useRef } from 'react'
import { createVisualizerScene, type VisualizerFrame, type VisualizerHandle } from './scene'

interface VisualizerProps {
  frame: VisualizerFrame
}

export function Visualizer({ frame }: VisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const handleRef = useRef<VisualizerHandle | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handle = createVisualizerScene(canvas)
    handleRef.current = handle

    function handleResize() {
      handle.resize(window.innerWidth, window.innerHeight)
    }
    handleResize()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      handle.dispose()
      handleRef.current = null
    }
  }, [])

  useEffect(() => {
    handleRef.current?.setFrame(frame)
  }, [frame])

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh' }}
    />
  )
}
