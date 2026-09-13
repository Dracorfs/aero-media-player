import { createServerFn } from '@tanstack/react-start'
import { getSpotifySession } from './session'
import {
  getStoredProfileImage,
  listProfileImageFiles,
  saveProfileImageFile,
  applyProfileImage,
  clearProfileImage as clearStoredProfileImageFile,
} from './profileImageStorage'

async function requireAuthenticatedSession(): Promise<void> {
  const session = await getSpotifySession()
  if (!session.data.accessToken) throw new Error('Not authenticated')
}

export const getProfileImageConfig = createServerFn({ method: 'GET' }).handler(async () =>
  getStoredProfileImage(),
)

export const setProfileImage = createServerFn({ method: 'POST' })
  .validator((data: { filename: string }) => {
    if (!data || typeof data.filename !== 'string' || data.filename.length === 0) {
      throw new Error('Invalid profile image filename')
    }
    return data
  })
  .handler(async ({ data }) => {
    await requireAuthenticatedSession()
    return applyProfileImage(data.filename)
  })

export const listProfileImages = createServerFn({ method: 'GET' }).handler(async () =>
  listProfileImageFiles(),
)

export const uploadProfileImage = createServerFn({ method: 'POST' })
  .validator((data: FormData) => {
    const file = data.get('image')
    if (!(file instanceof File)) throw new Error('Missing image file')
    return file
  })
  .handler(async ({ data }) => {
    await requireAuthenticatedSession()
    return { filename: await saveProfileImageFile(data) }
  })

export const clearProfileImage = createServerFn({ method: 'POST' }).handler(async () => {
  await requireAuthenticatedSession()
  await clearStoredProfileImageFile()
})
