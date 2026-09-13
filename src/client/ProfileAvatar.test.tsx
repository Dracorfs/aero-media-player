import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, fireEvent, screen } from '@testing-library/react'
import { ProfileAvatar } from './ProfileAvatar'

afterEach(cleanup)

describe('ProfileAvatar', () => {
  it('shows the selected image when a filename is given', () => {
    render(<ProfileAvatar filename="avatar.jpg" />)

    expect(screen.getByRole('img')).toHaveAttribute('src', '/profile-images/avatar.jpg')
  })

  it('shows the default icon when there is no selection', () => {
    render(<ProfileAvatar filename={null} />)

    expect(screen.getByRole('img')).toHaveAttribute('src', '/default-avatar.png')
  })

  it('renders as a clickable button and fires onClick when a handler is given', () => {
    const onClick = vi.fn()
    render(<ProfileAvatar filename={null} onClick={onClick} />)

    const button = screen.getByRole('button', { name: /change profile picture/i })
    fireEvent.click(button)

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('renders as a non-interactive element when no handler is given', () => {
    render(<ProfileAvatar filename={null} />)

    expect(screen.queryByRole('button')).toBeNull()
  })

  it('accepts a custom aria-label for the interactive form', () => {
    render(<ProfileAvatar filename={null} onClick={vi.fn()} label="Current profile picture" />)

    expect(screen.getByRole('button', { name: /current profile picture/i })).toBeInTheDocument()
  })
})
