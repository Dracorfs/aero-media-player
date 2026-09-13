import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, cleanup, fireEvent, screen, act } from '@testing-library/react'
import { Sidebar, SidebarReveal } from './Sidebar'
import { getPlaylists, getPlaylistTracks } from '../server/spotify-api'

vi.mock('../server/spotify-api', () => ({
  getPlaylists: vi.fn(),
  getPlaylistTracks: vi.fn(),
}))

afterEach(cleanup)

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getPlaylists).mockResolvedValue([{ id: 'p1', name: 'Chill', uri: 'spotify:playlist:p1' }])
  vi.mocked(getPlaylistTracks).mockResolvedValue([
    { uri: 'spotify:track:t1', name: 'Song A', artists: 'Artist A' },
  ])
})

function renderSidebar(overrides: Partial<Parameters<typeof Sidebar>[0]> = {}) {
  const props = {
    isOpen: true,
    onClose: vi.fn(),
    isSignedIn: false,
    isSigningIn: false,
    isPopupBlocked: false,
    onSignIn: vi.fn(),
    onSignOut: vi.fn(),
    onSelectTrack: vi.fn(),
    profileImageFilename: null,
    onOpenProfilePicker: vi.fn(),
    ...overrides,
  }
  return { ...render(<Sidebar {...props} />), props }
}

describe('Sidebar when signed out', () => {
  it('offers sign-in and starts it when clicked', () => {
    const { props } = renderSidebar()

    fireEvent.click(screen.getByRole('button', { name: /sign in with spotify/i }))

    expect(props.onSignIn).toHaveBeenCalledTimes(1)
  })

  it('shows a pending state while the sign-in tab is open', () => {
    renderSidebar({ isSigningIn: true })

    const button = screen.getByRole('button', { name: /waiting for spotify/i })
    expect(button).toBeDisabled()
  })

  it('offers a same-tab fallback when the popup was blocked', () => {
    renderSidebar({ isPopupBlocked: true })

    expect(screen.getByRole('link', { name: /sign in in this tab/i })).toHaveAttribute('href', '/login')
  })

  it('does not show the fallback link when the popup opened fine', () => {
    renderSidebar()

    expect(screen.queryByRole('link', { name: /sign in in this tab/i })).toBeNull()
  })

  it('shows neither the picker nor sign-off', () => {
    renderSidebar()

    expect(screen.queryByRole('button', { name: /sign off/i })).toBeNull()
    expect(getPlaylists).not.toHaveBeenCalled()
  })
})

describe('Sidebar when signed in', () => {
  it('shows the playlist picker', async () => {
    renderSidebar({ isSignedIn: true })

    expect(await screen.findByText('Chill')).toBeInTheDocument()
  })

  it('forwards a picked track to the caller', async () => {
    const { props } = renderSidebar({ isSignedIn: true })

    fireEvent.click(await screen.findByText('Chill'))
    fireEvent.click(await screen.findByText(/Song A/))

    expect(props.onSelectTrack).toHaveBeenCalledWith('spotify:playlist:p1', 'spotify:track:t1')
  })

  it('offers sign-off and calls it when clicked', () => {
    const { props } = renderSidebar({ isSignedIn: true })

    fireEvent.click(screen.getByRole('button', { name: /sign off/i }))

    expect(props.onSignOut).toHaveBeenCalledTimes(1)
  })

  it('no longer offers sign-in', () => {
    renderSidebar({ isSignedIn: true })

    expect(screen.queryByRole('button', { name: /sign in with spotify/i })).toBeNull()
  })

  it('embeds the picker without its standalone card chrome', async () => {
    const { container } = renderSidebar({ isSignedIn: true })

    await screen.findByText('Chill')
    expect(container.querySelector('.playlist-picker--embedded')).not.toBeNull()
  })
})

describe('Sidebar open and closed', () => {
  it('closes when the close control is used', () => {
    const { props } = renderSidebar()

    fireEvent.click(screen.getByRole('button', { name: /close sidebar/i }))

    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  it('is exposed to assistive tech while open', () => {
    const { container } = renderSidebar()

    expect(container.querySelector('.sidebar')).toHaveAttribute('aria-hidden', 'false')
    expect(container.querySelector('.sidebar--closed')).toBeNull()
  })

  it('is hidden and unreachable once closed', () => {
    const { container } = renderSidebar({ isOpen: false })

    expect(container.querySelector('.sidebar--closed')).not.toBeNull()
    expect(container.querySelector('.sidebar')).toHaveAttribute('aria-hidden', 'true')
    // getByRole respects aria-hidden, so this is the "nothing left to click"
    // check rather than a styling assertion.
    expect(screen.queryByRole('button', { name: /close sidebar/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /sign in with spotify/i })).toBeNull()
  })
})

describe('SidebarReveal', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function move() {
    fireEvent.mouseMove(window)
  }

  it('is absent until the mouse moves', () => {
    render(<SidebarReveal isSidebarOpen={false} onOpen={vi.fn()} />)

    expect(screen.queryByRole('button', { name: /show library/i })).toBeNull()
  })

  it('appears on mouse movement while the sidebar is closed', () => {
    render(<SidebarReveal isSidebarOpen={false} onOpen={vi.fn()} />)

    move()

    expect(screen.getByRole('button', { name: /show library/i })).toBeInTheDocument()
  })

  it('reopens the sidebar when clicked', () => {
    const onOpen = vi.fn()
    render(<SidebarReveal isSidebarOpen={false} onOpen={onOpen} />)

    move()
    fireEvent.click(screen.getByRole('button', { name: /show library/i }))

    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('stays away while the sidebar is open', () => {
    render(<SidebarReveal isSidebarOpen onOpen={vi.fn()} />)

    move()

    expect(screen.queryByRole('button', { name: /show library/i })).toBeNull()
  })

  it('fades out again after the mouse settles', () => {
    render(<SidebarReveal isSidebarOpen={false} onOpen={vi.fn()} />)

    move()
    act(() => {
      vi.advanceTimersByTime(2000)
    })

    expect(screen.queryByRole('button', { name: /show library/i })).toBeNull()
  })
})

describe('Sidebar profile picture button', () => {
  it('is present and clickable when signed in', () => {
    const { props } = renderSidebar({ isSignedIn: true })

    fireEvent.click(screen.getByRole('button', { name: /change profile picture/i }))

    expect(props.onOpenProfilePicker).toHaveBeenCalledTimes(1)
  })

  it('is absent when signed out', () => {
    renderSidebar({ isSignedIn: false })

    expect(screen.queryByRole('button', { name: /change profile picture/i })).toBeNull()
  })
})
