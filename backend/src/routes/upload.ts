import { Router, Response } from 'express'
import multer from 'multer'
import { supabase } from '../index'
import { requireAuth, AuthRequest } from '../middleware/auth'

const router = Router()

const AVATAR_BUCKET = 'avatars'
const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024

const allowedMimeTypes = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp'])

const extensionForMimeType: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_AVATAR_SIZE_BYTES,
  },
  fileFilter: (_req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      callback(new Error('Avatar must be a PNG, JPG, or WebP image.'))
      return
    }

    callback(null, true)
  },
})

router.post('/avatar', requireAuth, (req: AuthRequest, res: Response) => {
  upload.single('avatar')(req, res, async (uploadError) => {
    if (uploadError) {
      const message =
        uploadError instanceof multer.MulterError && uploadError.code === 'LIMIT_FILE_SIZE'
          ? 'Avatar image must be 2MB or smaller.'
          : uploadError instanceof Error
            ? uploadError.message
            : 'Invalid avatar upload.'

      res.status(400).json({ error: message })
      return
    }

    const file = req.file
    if (!file) {
      res.status(400).json({ error: 'Avatar file is required.' })
      return
    }

    const extension = extensionForMimeType[file.mimetype]
    if (!extension) {
      res.status(400).json({ error: 'Avatar must be a PNG, JPG, or WebP image.' })
      return
    }

    const path = `users/${req.userId}/avatar.${extension}`

    const { error: storageError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(path, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      })

    if (storageError) {
      res.status(500).json({ error: 'Avatar storage bucket is not configured.' })
      return
    }

    const { data: publicUrlData } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path)
    const avatarUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`

    const { data, error: updateError } = await supabase
      .from('users')
      .update({ avatar_url: avatarUrl })
      .eq('id', req.userId!)
      .select('id, username, email, avatar_url, created_at')
      .single()

    if (updateError) {
      res.status(500).json({ error: updateError.message })
      return
    }

    res.json(data)
  })
})

export default router
