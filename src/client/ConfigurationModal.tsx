import { useState } from 'react'
import { ALLOWED_BACKGROUND_COLORS, setBackground, type BackgroundConfig } from '../server/background'
import './ConfigurationModal.css'

interface ConfigurationModalProps {
  isOpen: boolean
  onClose: () => void
  backgroundConfig: BackgroundConfig | null
  onBackgroundConfigChange: (config: BackgroundConfig) => void
}

export function ConfigurationModal({
  isOpen,
  onClose,
  backgroundConfig,
  onBackgroundConfigChange,
}: ConfigurationModalProps) {
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  async function selectColor(color: string) {
    setError(null)
    try {
      await setBackground({ data: { type: 'color', value: color } })
      onBackgroundConfigChange({ type: 'color', value: color })
    } catch {
      setError("Couldn't set that background. Try again.")
    }
  }

  return (
    <div className="configuration-modal__backdrop" onClick={onClose}>
      <div className="configuration-modal" onClick={(e) => e.stopPropagation()}>
        <div className="configuration-modal__header">
          <h2 className="configuration-modal__title">Background</h2>
          <button className="configuration-modal__close" onClick={onClose} aria-label="Close configuration">
            ×
          </button>
        </div>

        {error && <p className="configuration-modal__error">{error}</p>}

        <div className="configuration-modal__swatches">
          {ALLOWED_BACKGROUND_COLORS.map((color) => (
            <button
              key={color}
              className={
                backgroundConfig?.type === 'color' && backgroundConfig.value === color
                  ? 'configuration-modal__swatch configuration-modal__swatch--selected'
                  : 'configuration-modal__swatch'
              }
              style={{ backgroundColor: color }}
              onClick={() => selectColor(color)}
              aria-label={`Set background color ${color}`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
