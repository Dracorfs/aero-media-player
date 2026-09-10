import { useEffect, useState } from 'react'
import {
  ALLOWED_BACKGROUND_COLORS,
  setBackground,
  listBackgroundImages,
  uploadBackgroundImage,
  type BackgroundConfig,
} from '../server/background'
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
  const [mode, setMode] = useState<'color' | 'image'>('color')
  const [images, setImages] = useState<string[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen || mode !== 'image' || images !== null) return
    listBackgroundImages()
      .then(setImages)
      .catch(() => {
        setError("Couldn't load your images. Try again.")
        setImages([])
      })
  }, [isOpen, mode, images])

  useEffect(() => {
    if (!isOpen) {
      setError(null)
      setMode('color')
    }
  }, [isOpen])

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

  async function selectImage(filename: string) {
    setError(null)
    try {
      await setBackground({ data: { type: 'image', value: filename } })
      onBackgroundConfigChange({ type: 'image', value: filename })
    } catch {
      setError("Couldn't set that background. Try again.")
    }
  }

  async function handleUpload(file: File | undefined) {
    if (!file) return
    setError(null)
    try {
      const formData = new FormData()
      formData.append('image', file)
      const { filename } = await uploadBackgroundImage({ data: formData })
      setImages((prev) => [...(prev ?? []), filename])
      await selectImage(filename)
    } catch {
      setError("Couldn't upload that image. Try again.")
    }
  }

  return (
    <div className="configuration-modal__backdrop" onClick={onClose}>
      <div className="configuration-modal" onClick={(e) => e.stopPropagation()}>
        <div className="configuration-modal__titlebar">
          <span className="configuration-modal__title">Background</span>
          <div className="configuration-modal__controls">
            <button className="configuration-modal__close" onClick={onClose} aria-label="Close configuration">
              ×
            </button>
          </div>
        </div>

        <div className="configuration-modal__body">
          <div className="configuration-modal__tabs">
            <button
              className={
                mode === 'color'
                  ? 'configuration-modal__tab configuration-modal__tab--active'
                  : 'configuration-modal__tab'
              }
              onClick={() => setMode('color')}
            >
              Color
            </button>
            <button
              className={
                mode === 'image'
                  ? 'configuration-modal__tab configuration-modal__tab--active'
                  : 'configuration-modal__tab'
              }
              onClick={() => setMode('image')}
            >
              Image
            </button>
          </div>

          {error && <p className="configuration-modal__error">{error}</p>}

          {mode === 'color' ? (
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
          ) : (
            <div className="configuration-modal__images">
              {images === null ? (
                <p className="configuration-modal__status">Loading images...</p>
              ) : (
                images.map((filename) => (
                  <button
                    key={filename}
                    className={
                      backgroundConfig?.type === 'image' && backgroundConfig.value === filename
                        ? 'configuration-modal__thumb configuration-modal__thumb--selected'
                        : 'configuration-modal__thumb'
                    }
                    onClick={() => selectImage(filename)}
                    aria-label={`Set background image ${filename}`}
                  >
                    <img src={`/backgrounds/${filename}`} alt="" />
                  </button>
                ))
              )}
              <label className="configuration-modal__upload">
                Upload new image
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    e.target.value = ''
                    handleUpload(file)
                  }}
                  aria-label="Upload new image"
                />
              </label>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
