import { Router, Response } from 'express'
import { z } from 'zod'
import { supabase } from '../index.js'
import { requireAuth, AuthRequest } from '../middleware/auth.js'

const router = Router()

const UpdateProfileSchema = z.object({
  username: z.string().min(3).optional(),
  avatar_url: z.string().url().optional(),
})

// GET /users — list all users (public)
router.get('/', async (_req, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, username, avatar_url, created_at')
      .order('username', { ascending: true })

    if (error) {
      res.status(500).json({ error: 'Failed to fetch users', message: error.message })
      return
    }
    res.json(data)
  } catch (e) {
    res.status(500).json({ error: 'Internal server error', message: String(e) })
  }
})

// GET /users/me — get current user profile
router.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, username, email, avatar_url, created_at')
      .eq('id', req.userId!)
      .single()

    if (error) {
      res.status(404).json({ error: 'User not found' })
      return
    }
    res.json(data)
  } catch (e) {
    res.status(500).json({ error: 'Internal server error', message: String(e) })
  }
})

// PUT /users/me — update profile
router.put('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const parsed = UpdateProfileSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid profile data', details: parsed.error.flatten() })
      return
    }

    const { data, error } = await supabase
      .from('users')
      .update(parsed.data)
      .eq('id', req.userId!)
      .select('id, username, email, avatar_url, created_at')
      .single()

    if (error) {
      res.status(500).json({ error: 'Failed to update profile', message: error.message })
      return
    }
    res.json(data)
  } catch (e) {
    res.status(500).json({ error: 'Internal server error', message: String(e) })
  }
})

// GET /users/me/friends — list friends
router.get('/me/friends', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('friendships')
      .select('friend_id, users!friendships_friend_id_fkey(id, username, avatar_url)')
      .eq('user_id', req.userId!)

    if (error) {
      res.status(500).json({ error: 'Failed to fetch friends', message: error.message })
      return
    }
    res.json(data.map(f => f.users))
  } catch (e) {
    res.status(500).json({ error: 'Internal server error', message: String(e) })
  }
})

// POST /users/me/friends/:friendId — add friend
router.post('/me/friends/:friendId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const friendId = req.params.friendId

    if (friendId === req.userId) {
      res.status(400).json({ error: 'Cannot add yourself as a friend' })
      return
    }

    // Add both directions so friendship is mutual
    const { error } = await supabase
      .from('friendships')
      .insert([
        { user_id: req.userId, friend_id: friendId },
        { user_id: friendId, friend_id: req.userId },
      ])

    if (error) {
      if (error.code === '23505') {
        res.status(409).json({ error: 'Already friends' })
        return
      }
      res.status(500).json({ error: 'Failed to add friend', message: error.message })
      return
    }
    res.status(201).json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: 'Internal server error', message: String(e) })
  }
})

// DELETE /users/me/friends/:friendId — remove friend
router.delete('/me/friends/:friendId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const friendId = req.params.friendId

    const { error } = await supabase
      .from('friendships')
      .delete()
      .or(
        `and(user_id.eq.${req.userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${req.userId})`
      )

    if (error) {
      res.status(500).json({ error: 'Failed to remove friend', message: error.message })
      return
    }
    res.status(204).send()
  } catch (e) {
    res.status(500).json({ error: 'Internal server error', message: String(e) })
  }
})

// GET /users/:id — view another user's public profile
router.get('/:id', async (req, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, username, avatar_url, created_at')
      .eq('id', req.params.id)
      .single()

    if (error) {
      res.status(404).json({ error: 'User not found' })
      return
    }
    res.json(data)
  } catch (e) {
    res.status(500).json({ error: 'Internal server error', message: String(e) })
  }
})

export default router