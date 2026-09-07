import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, fireEvent, cleanup, screen } from '@testing-library/react'
import { ConfigurationModal } from './ConfigurationModal'
import { setBackground, listBackgroundImages, uploadBackgroundImage } from '../server/background'

vi.mock('../server/background', () => ({
  ALLOWED_BACKGROUND_COLORS: ['#0032db', '#0689e4', '#7aeafe', '#9fe11d', '#ccff7c', '#000000', '#ffffff'],
  setBackground: vi.fn(),
  listBackgroundImages: vi.fn(),
  uploadBackgroundImage: vi.fn(),
}))

afterEach(cleanup)

beforeEach(() => {
  vi.clearAllMocks()
})

const ALLOWED_BACKGROUND_COLORS = ['#0032db', '#0689e4', '#7aeafe', '#9fe11d', '#ccff7c', '#000000', '#ffffff']

describe('ConfigurationModal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <ConfigurationModal isOpen={false} onClose={vi.fn()} backgroundConfig={null} onBackgroundConfigChange={vi.fn()} />,
    )

    expect(container).toBeEmptyDOMElement()
  })

  it('shows all 7 color swatches by default', () => {
    render(<ConfigurationModal isOpen onClose={vi.fn()} backgroundConfig={null} onBackgroundConfigChange={vi.fn()} />)

    for (const color of ALLOWED_BACKGROUND_COLORS) {
      expect(screen.getByLabelText(`Set background color ${color}`)).not.toBeNull()
    }
  })

  it('selecting a color calls setBackground and notifies the parent', async () => {
    vi.mocked(setBackground).mockResolvedValue(undefined as never)
    const onBackgroundConfigChange = vi.fn()
    render(
      <ConfigurationModal
        isOpen
        onClose={vi.fn()}
        backgroundConfig={null}
        onBackgroundConfigChange={onBackgroundConfigChange}
      />,
    )

    fireEvent.click(screen.getByLabelText('Set background color #0032db'))

    await vi.waitFor(() =>
      expect(onBackgroundConfigChange).toHaveBeenCalledWith({ type: 'color', value: '#0032db' }),
    )
    expect(setBackground).toHaveBeenCalledWith({ data: { type: 'color', value: '#0032db' } })
  })

  it('shows an error message when selecting a color fails', async () => {
    vi.mocked(setBackground).mockRejectedValue(new Error('nope'))
    render(<ConfigurationModal isOpen onClose={vi.fn()} backgroundConfig={null} onBackgroundConfigChange={vi.fn()} />)

    fireEvent.click(screen.getByLabelText('Set background color #0032db'))

    expect(await screen.findByText(/couldn't set/i)).not.toBeNull()
  })

  it('clicking the backdrop closes the modal', () => {
    const onClose = vi.fn()
    const { container } = render(
      <ConfigurationModal isOpen onClose={onClose} backgroundConfig={null} onBackgroundConfigChange={vi.fn()} />,
    )

    fireEvent.click(container.querySelector('.configuration-modal__backdrop') as HTMLElement)

    expect(onClose).toHaveBeenCalled()
  })

  it('loads and shows uploaded images when switching to the Image tab', async () => {
    vi.mocked(listBackgroundImages).mockResolvedValue(['sunset.jpg'])
    render(<ConfigurationModal isOpen onClose={vi.fn()} backgroundConfig={null} onBackgroundConfigChange={vi.fn()} />)

    fireEvent.click(screen.getByText('Image'))

    expect(await screen.findByLabelText('Set background image sunset.jpg')).not.toBeNull()
  })

  it('uploading an image saves it and selects it', async () => {
    vi.mocked(listBackgroundImages).mockResolvedValue([])
    vi.mocked(uploadBackgroundImage).mockResolvedValue({ filename: 'new.png' })
    vi.mocked(setBackground).mockResolvedValue(undefined as never)
    const onBackgroundConfigChange = vi.fn()
    render(
      <ConfigurationModal
        isOpen
        onClose={vi.fn()}
        backgroundConfig={null}
        onBackgroundConfigChange={onBackgroundConfigChange}
      />,
    )

    fireEvent.click(screen.getByText('Image'))
    await screen.findByLabelText('Upload new image')

    const file = new File(['x'], 'new.png', { type: 'image/png' })
    fireEvent.change(screen.getByLabelText('Upload new image'), { target: { files: [file] } })

    await vi.waitFor(() =>
      expect(onBackgroundConfigChange).toHaveBeenCalledWith({ type: 'image', value: 'new.png' }),
    )
    expect(uploadBackgroundImage).toHaveBeenCalled()
  })
})
