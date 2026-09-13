import { useEffect, useState } from 'react'
import {
  getProfileImageConfig,
  setProfileImage,
  listProfileImages,
  uploadProfileImage,
  clearProfileImage,
} from '../server/profileImage'
import { ProfileAvatar } from './ProfileAvatar'
import './ProfileImageModal.css'

interface ProfileImageModalProps {
  isOpen: boolean
  onClose: () => void
  selectedFilename: string | null
  onSelectionChange: (filename: string | null) => void
}

/**
 * The profile-picture picker: a plain gallery of previously uploaded images
 * plus an upload tile on one side, and a large framed "current picture"
 * preview with a Remove button on the other — the same two-zone layout as
 * the real Windows Live Messenger "Select a picture" dialog (see
 * tasks/plan.md, "Feature: Profile Picture Selector"), adapted to this app's
 * existing immediate-apply convention (no OK/Close step) instead of WLM's.
 * Chrome (backdrop, Aero titlebar, close button) mirrors `ConfigurationModal`
 * — this modal just never has tabs, since a profile picture is always image.
 */
export function ProfileImageModal({ isOpen, onClose, selectedFilename, onSelectionChange }: ProfileImageModalProps) {
  const [images, setImages] = useState<string[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen || images !== null) return
    listProfileImages()
      .then(setImages)
      .catch(() => {
        setError("Couldn't load your images. Try again.")
        setImages([])
      })
  }, [isOpen, images])

  useEffect(() => {
    if (!isOpen) setError(null)
  }, [isOpen])

  if (!isOpen) return null

  async function selectImage(filename: string) {
    setError(null)
    try {
      await setProfileImage({ data: { filename } })
      onSelectionChange(filename)
    } catch {
      setError("Couldn't set that profile picture. Try again.")
    }
  }

  async function removeSelection() {
    setError(null)
    try {
      await clearProfileImage()
      onSelectionChange(null)
    } catch {
      setError("Couldn't remove your profile picture. Try again.")
    }
  }

  async function handleUpload(file: File | undefined) {
    if (!file) return
    setError(null)
    try {
      const formData = new FormData()
      formData.append('image', file)
      const { filename } = await uploadProfileImage({ data: formData })
      setImages((prev) => [...(prev ?? []), filename])
      await selectImage(filename)
    } catch {
      setError("Couldn't upload that image. Try again.")
    }
  }

  return (
    <div className="profile-image-modal__backdrop" onClick={onClose}>
      <div className="profile-image-modal" onClick={(e) => e.stopPropagation()}>
        <div className="profile-image-modal__titlebar">
          <div className="profile-image-modal__controls">
            <button className="profile-image-modal__close" onClick={onClose} aria-label="Close profile picture picker">
              ×
            </button>
          </div>
        </div>

        <div className="profile-image-modal__body">
          <h2 className="profile-image-modal__heading">Select a picture</h2>

          {error && <p className="profile-image-modal__error">{error}</p>}

          <div className="profile-image-modal__layout">
            <div className="profile-image-modal__gallery">
              {images === null ? (
                <p className="profile-image-modal__status">Loading images...</p>
              ) : (
                images.map((filename) => (
                  <button
                    key={filename}
                    className={
                      selectedFilename === filename
                        ? 'profile-image-modal__thumb profile-image-modal__thumb--selected'
                        : 'profile-image-modal__thumb'
                    }
                    onClick={() => selectImage(filename)}
                    aria-label={`Set profile picture ${filename}`}
                  >
                    <img src={`/profile-images/${filename}`} alt="" />
                  </button>
                ))
              )}
              <label className="profile-image-modal__upload">
                Browse...
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    e.target.value = ''
                    handleUpload(file)
                  }}
                  aria-label="Upload new profile picture"
                />
              </label>
            </div>

            <div className="profile-image-modal__preview">
              <ProfileAvatar filename={selectedFilename} size="lg" />
              <button
                type="button"
                className="profile-image-modal__remove"
                onClick={removeSelection}
                disabled={selectedFilename === null}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
