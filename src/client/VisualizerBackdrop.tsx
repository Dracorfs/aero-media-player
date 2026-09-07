import type { BackgroundConfig } from '../server/background'
import './VisualizerBackdrop.css'

interface VisualizerBackdropProps {
  config: BackgroundConfig | null
}

export function VisualizerBackdrop({ config }: VisualizerBackdropProps) {
  const style =
    config?.type === 'color'
      ? { backgroundColor: config.value }
      : config?.type === 'image'
        ? {
            backgroundImage: `url(/backgrounds/${config.value})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }
        : {}

  return <div className="visualizer-backdrop" style={style} />
}
