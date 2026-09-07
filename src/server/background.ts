import { createServerFn } from '@tanstack/react-start'
import { getSpotifySession } from './session'
import { ALLOWED_BACKGROUND_COLORS, isAllowedColor, sanitizeImageFilename, type BackgroundConfig } from '../shared/background'
import { getStoredBackground, listBackgroundImageFiles, saveBackgroundImageFile, applyBackground } from './backgroundStorage'

export { ALLOWED_BACKGROUND_COLORS, isAllowedColor, sanitizeImageFilename }
export type { BackgroundConfig }

async function requireAuthenticatedSession(): Promise<void> {
  const session = await getSpotifySession()
  if (!session.data.accessToken) throw new Error('Not authenticated')
}

export const getBackgroundConfig = createServerFn({ method: 'GET' }).handler(async () => getStoredBackground())

export const setBackground = createServerFn({ method: 'POST' })
  .validator((data: BackgroundConfig) => {
    if (!data || (data.type !== 'color' && data.type !== 'image') || typeof data.value !== 'string') {
      throw new Error('Invalid background config')
    }
    return data
  })
  .handler(async ({ data }) => {
    await requireAuthenticatedSession()
    return applyBackground(data)
  })

export const listBackgroundImages = createServerFn({ method: 'GET' }).handler(async () => listBackgroundImageFiles())

export const uploadBackgroundImage = createServerFn({ method: 'POST' })
  .validator((data: FormData) => {
    const file = data.get('image')
    if (!(file instanceof File)) throw new Error('Missing image file')
    return file
  })
  .handler(async ({ data }) => {
    await requireAuthenticatedSession()
    return { filename: await saveBackgroundImageFile(data) }
  })
