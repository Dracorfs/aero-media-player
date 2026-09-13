import './ProfileAvatar.css'

interface ProfileAvatarProps {
  /** Selected profile picture filename under `public/profile-images/`, or `null` for the default icon. */
  filename: string | null
  /** `sm` for the sidebar button, `lg` for the picker's current-picture preview. Omit for the base size. */
  size?: 'sm' | 'lg'
  /** Present only when the avatar should be a clickable control (the sidebar button). */
  onClick?: () => void
  /** aria-label when `onClick` is set. Defaults to a sensible "change picture" label. */
  label?: string
}

/**
 * The framed avatar display — the one place the Aero frame (see
 * `ProfileAvatar.css`) is drawn. Used both standalone (the sidebar's
 * clickable avatar button) and inside `ProfileImageModal` (the large
 * "current picture" preview). The picker's small gallery thumbnails
 * deliberately do NOT use this component — see tasks/plan.md, "Feature:
 * Profile Picture Selector".
 */
export function ProfileAvatar({ filename, size, onClick, label }: ProfileAvatarProps) {
  const className = `profile-avatar${size ? ` profile-avatar--${size}` : ''}`
  const src = filename ? `/profile-images/${filename}` : '/default-avatar.png'
  const alt = filename ? 'Profile picture' : 'Default profile picture'

  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick} aria-label={label ?? 'Change profile picture'}>
        <img className="profile-avatar__image" src={src} alt={alt} />
      </button>
    )
  }

  return (
    <span className={className}>
      <img className="profile-avatar__image" src={src} alt={alt} />
    </span>
  )
}
