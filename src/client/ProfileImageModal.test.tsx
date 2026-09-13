import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, fireEvent, cleanup, screen } from '@testing-library/react'
import { ProfileImageModal } from './ProfileImageModal'
import { setProfileImage, listProfileImages, uploadProfileImage, clearProfileImage } from '../server/profileImage'

vi.mock('../server/profileImage', () => ({
  setProfileImage: vi.fn(),
  listProfileImages: vi.fn(),
  uploadProfileImage: vi.fn(),
  clearProfileImage: vi.fn(),
}))

afterEach(cleanup)

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(listProfileImages).mockResolvedValue([])
})

describe('ProfileImageModal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <ProfileImageModal isOpen={false} onClose={vi.fn()} selectedFilename={null} onSelectionChange={vi.fn()} />,
    )

    expect(container).toBeEmptyDOMElement()
  })

  it('loads and shows uploaded images on open', async () => {
    vi.mocked(listProfileImages).mockResolvedValue(['avatar.jpg'])
    render(<ProfileImageModal isOpen onClose={vi.fn()} selectedFilename={null} onSelectionChange={vi.fn()} />)

    expect(await screen.findByLabelText('Set profile picture avatar.jpg')).not.toBeNull()
  })

  it('the preview reflects the current selection', async () => {
    vi.mocked(listProfileImages).mockResolvedValue(['avatar.jpg'])
    render(<ProfileImageModal isOpen onClose={vi.fn()} selectedFilename="avatar.jpg" onSelectionChange={vi.fn()} />)

    await screen.findByLabelText('Set profile picture avatar.jpg')
    const images = screen.getAllByRole('img')
    expect(images.some((img) => img.getAttribute('src') === '/profile-images/avatar.jpg')).toBe(true)
  })

  it('selecting a gallery tile calls setProfileImage and notifies the parent', async () => {
    vi.mocked(listProfileImages).mockResolvedValue(['avatar.jpg'])
    vi.mocked(setProfileImage).mockResolvedValue('avatar.jpg')
    const onSelectionChange = vi.fn()
    render(<ProfileImageModal isOpen onClose={vi.fn()} selectedFilename={null} onSelectionChange={onSelectionChange} />)

    fireEvent.click(await screen.findByLabelText('Set profile picture avatar.jpg'))

    await vi.waitFor(() => expect(onSelectionChange).toHaveBeenCalledWith('avatar.jpg'))
    expect(setProfileImage).toHaveBeenCalledWith({ data: { filename: 'avatar.jpg' } })
  })

  it('shows an error message when selecting an image fails', async () => {
    vi.mocked(listProfileImages).mockResolvedValue(['avatar.jpg'])
    vi.mocked(setProfileImage).mockRejectedValue(new Error('nope'))
    render(<ProfileImageModal isOpen onClose={vi.fn()} selectedFilename={null} onSelectionChange={vi.fn()} />)

    fireEvent.click(await screen.findByLabelText('Set profile picture avatar.jpg'))

    expect(await screen.findByText(/couldn't set/i)).not.toBeNull()
  })

  it('the Remove button is disabled with nothing to remove', () => {
    render(<ProfileImageModal isOpen onClose={vi.fn()} selectedFilename={null} onSelectionChange={vi.fn()} />)

    expect(screen.getByRole('button', { name: /remove/i })).toBeDisabled()
  })

  it('clicking Remove clears the selection', async () => {
    vi.mocked(clearProfileImage).mockResolvedValue(undefined)
    const onSelectionChange = vi.fn()
    render(
      <ProfileImageModal isOpen onClose={vi.fn()} selectedFilename="avatar.jpg" onSelectionChange={onSelectionChange} />,
    )

    fireEvent.click(screen.getByRole('button', { name: /remove/i }))

    await vi.waitFor(() => expect(onSelectionChange).toHaveBeenCalledWith(null))
    expect(clearProfileImage).toHaveBeenCalledTimes(1)
  })

  it('shows an error message when removing fails', async () => {
    vi.mocked(clearProfileImage).mockRejectedValue(new Error('nope'))
    render(<ProfileImageModal isOpen onClose={vi.fn()} selectedFilename="avatar.jpg" onSelectionChange={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /remove/i }))

    expect(await screen.findByText(/couldn't remove/i)).not.toBeNull()
  })

  it('clicking the backdrop closes the modal', () => {
    const onClose = vi.fn()
    const { container } = render(
      <ProfileImageModal isOpen onClose={onClose} selectedFilename={null} onSelectionChange={vi.fn()} />,
    )

    fireEvent.click(container.querySelector('.profile-image-modal__backdrop') as HTMLElement)

    expect(onClose).toHaveBeenCalled()
  })

  it('uploading an image saves it and selects it', async () => {
    vi.mocked(listProfileImages).mockResolvedValue([])
    vi.mocked(uploadProfileImage).mockResolvedValue({ filename: 'new.png' })
    vi.mocked(setProfileImage).mockResolvedValue('new.png')
    const onSelectionChange = vi.fn()
    render(<ProfileImageModal isOpen onClose={vi.fn()} selectedFilename={null} onSelectionChange={onSelectionChange} />)

    await screen.findByLabelText('Upload new profile picture')

    const file = new File(['x'], 'new.png', { type: 'image/png' })
    fireEvent.change(screen.getByLabelText('Upload new profile picture'), { target: { files: [file] } })

    await vi.waitFor(() => expect(onSelectionChange).toHaveBeenCalledWith('new.png'))
    expect(uploadProfileImage).toHaveBeenCalled()
  })
})
