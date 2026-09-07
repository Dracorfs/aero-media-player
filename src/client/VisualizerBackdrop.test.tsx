import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { VisualizerBackdrop } from './VisualizerBackdrop'

afterEach(cleanup)

describe('VisualizerBackdrop', () => {
  it('renders a solid background color for a color config', () => {
    const { container } = render(<VisualizerBackdrop config={{ type: 'color', value: '#0032db' }} />)
    const backdrop = container.querySelector('.visualizer-backdrop') as HTMLElement

    expect(backdrop.style.backgroundColor).toBe('rgb(0, 50, 219)')
  })

  it('renders a cover background image for an image config', () => {
    const { container } = render(<VisualizerBackdrop config={{ type: 'image', value: 'abc123.jpg' }} />)
    const backdrop = container.querySelector('.visualizer-backdrop') as HTMLElement

    expect(backdrop.style.backgroundImage).toBe('url("/backgrounds/abc123.jpg")')
    expect(backdrop.style.backgroundSize).toBe('cover')
  })

  it('renders with no special background when there is no config yet', () => {
    const { container } = render(<VisualizerBackdrop config={null} />)
    const backdrop = container.querySelector('.visualizer-backdrop') as HTMLElement

    expect(backdrop.style.backgroundColor).toBe('')
    expect(backdrop.style.backgroundImage).toBe('')
  })
})
