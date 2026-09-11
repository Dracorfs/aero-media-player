import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSidebar } from './useSidebar'

describe('useSidebar', () => {
  it('starts open, since the panel holds the only way to sign in', () => {
    const { result } = renderHook(() => useSidebar())
    expect(result.current.isOpen).toBe(true)
  })

  it('closes and reopens', () => {
    const { result } = renderHook(() => useSidebar())

    act(() => result.current.close())
    expect(result.current.isOpen).toBe(false)

    act(() => result.current.open())
    expect(result.current.isOpen).toBe(true)
  })

  it('is idempotent when asked to close or open twice', () => {
    const { result } = renderHook(() => useSidebar())

    act(() => result.current.close())
    act(() => result.current.close())
    expect(result.current.isOpen).toBe(false)

    act(() => result.current.open())
    act(() => result.current.open())
    expect(result.current.isOpen).toBe(true)
  })

  it('toggles from whichever state it is in', () => {
    const { result } = renderHook(() => useSidebar())

    act(() => result.current.toggle())
    expect(result.current.isOpen).toBe(false)

    act(() => result.current.toggle())
    expect(result.current.isOpen).toBe(true)
  })
})
