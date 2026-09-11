import { useCallback, useState } from 'react'

interface SidebarState {
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
}

/**
 * Open/closed state for the library sidebar. It starts open: on a cold load
 * the panel is what offers sign-in, and once signed in it is how a track gets
 * picked, so hiding it by default would hide the only way in.
 */
export function useSidebar(): SidebarState {
  const [isOpen, setIsOpen] = useState(true)

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  const toggle = useCallback(() => setIsOpen((prev) => !prev), [])

  return { isOpen, open, close, toggle }
}
