import { Router, Response } from 'express'
import { z } from 'zod'
import { supabase } from '../index'
import { requireAuth, AuthRequest } from '../middleware/auth'

const router = Router()

const UpdateProfileSchema = z.object({
  username: z.string().min(3).optional(),
  avatar_url: z.string().url().optional(),
})

type FriendRequestUser = {
  id: string
  username: string
  avatar_url: string | null
}

type FriendRequestRow = {
  id: string
  requester_id: string
  recipient_id: string
  status: string
  created_at: string
  updated_at: string | null
  requester?: FriendRequestUser
  recipient?: FriendRequestUser
}

async function areFriends(userId: string, friendId: string): Promise<boolean> {
  const { data } = await supabase
    .from('friendships')
    .select('friend_id')
    .eq('user_id', userId)
    .eq('friend_id', friendId)
    .maybeSingle()

  return Boolean(data)
}

// GET /users/me — get current user profile
router.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  const { data, error } = await supabase
    .from('users')
    .select('id, username, email, avatar_url, created_at')
    .eq('id', req.userId!)
    .single()

  if (error) {
    res.status(404).json({ error: 'User not found.' })
    return
  }
  res.json(data)
})

// PUT /users/me — update profile
router.put('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  const parsed = UpdateProfileSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }

  const { data, error } = await supabase
    .from('users')
    .update(parsed.data)
    .eq('id', req.userId!)
    .select('id, username, email, avatar_url, created_at')
    .single()

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }
  res.json(data)
})

// GET /users/me/friends — list friends
router.get('/me/friends', requireAuth, async (req: AuthRequest, res: Response) => {
  const { data, error } = await supabase
    .from('friendships')
    .select('friend_id, users!friendships_friend_id_fkey(id, username, avatar_url)')
    .eq('user_id', req.userId!)

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }
  res.json(data.map(f => f.users))
})

// GET /users/me/friend-requests — list incoming and outgoing pending requests
router.get('/me/friend-requests', requireAuth, async (req: AuthRequest, res: Response) => {
  const { data, error } = await supabase
    .from('friend_requests')
    .select(`
      id,
      requester_id,
      recipient_id,
      status,
      created_at,
      updated_at,
      requester:users!friend_requests_requester_id_fkey(id, username, avatar_url),
      recipient:users!friend_requests_recipient_id_fkey(id, username, avatar_url)
    `)
    .eq('status', 'pending')
    .or(`requester_id.eq.${req.userId},recipient_id.eq.${req.userId}`)
    .order('created_at', { ascending: false })

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }

  const rows = (data ?? []) as unknown as FriendRequestRow[]
  res.json({
    incoming: rows.filter((request) => request.recipient_id === req.userId),
    outgoing: rows.filter((request) => request.requester_id === req.userId),
  })
})

// POST /users/me/friend-requests/:userId — send a friend request
router.post('/me/friend-requests/:userId', requireAuth, async (req: AuthRequest, res: Response) => {
  const recipientId = String(req.params.userId)

  if (recipientId === req.userId) {
    res.status(400).json({ error: 'Cannot send a friend request to yourself.' })
    return
  }

  if (await areFriends(req.userId!, recipientId)) {
    res.status(409).json({ error: 'Already friends.' })
    return
  }

  const { data: reciprocal } = await supabase
    .from('friend_requests')
    .select('id')
    .eq('requester_id', recipientId)
    .eq('recipient_id', req.userId!)
    .eq('status', 'pending')
    .maybeSingle()

  if (reciprocal) {
    res.status(409).json({ error: 'Incoming friend request already pending.' })
    return
  }

  const { data: existing, error: existingError } = await supabase
    .from('friend_requests')
    .select('id, status')
    .eq('requester_id', req.userId!)
    .eq('recipient_id', recipientId)
    .maybeSingle()

  if (existingError) {
    res.status(500).json({ error: existingError.message })
    return
  }

  if (existing?.status === 'pending') {
    res.status(409).json({ error: 'Friend request already pending.' })
    return
  }
  if (existing?.status === 'accepted') {
    res.status(409).json({ error: 'Already friends.' })
    return
  }

  const payload = {
    requester_id: req.userId,
    recipient_id: recipientId,
    status: 'pending',
    updated_at: new Date().toISOString(),
  }

  const query = existing
    ? supabase.from('friend_requests').update(payload).eq('id', existing.id)
    : supabase.from('friend_requests').insert(payload)

  const { data, error } = await query
    .select(`
      id,
      requester_id,
      recipient_id,
      status,
      created_at,
      updated_at,
      requester:users!friend_requests_requester_id_fkey(id, username, avatar_url),
      recipient:users!friend_requests_recipient_id_fkey(id, username, avatar_url)
    `)
    .single()

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }

  res.status(existing ? 200 : 201).json(data)
})

// POST /users/me/friend-requests/:requestId/accept — accept an incoming request
router.post('/me/friend-requests/:requestId/accept', requireAuth, async (req: AuthRequest, res: Response) => {
  const { data: request, error: requestError } = await supabase
    .from('friend_requests')
    .select('id, requester_id, recipient_id, status')
    .eq('id', req.params.requestId)
    .eq('recipient_id', req.userId!)
    .eq('status', 'pending')
    .maybeSingle()

  if (requestError) {
    res.status(500).json({ error: requestError.message })
    return
  }
  if (!request) {
    res.status(404).json({ error: 'Friend request not found.' })
    return
  }

  const { error: friendshipError } = await supabase
    .from('friendships')
    .upsert([
      { user_id: request.requester_id, friend_id: request.recipient_id },
      { user_id: request.recipient_id, friend_id: request.requester_id },
    ], { onConflict: 'user_id,friend_id' })

  if (friendshipError) {
    res.status(500).json({ error: friendshipError.message })
    return
  }

  const { error: updateError } = await supabase
    .from('friend_requests')
    .update({ status: 'accepted', updated_at: new Date().toISOString() })
    .eq('id', request.id)

  if (updateError) {
    res.status(500).json({ error: updateError.message })
    return
  }

  res.json({ ok: true })
})

// POST /users/me/friend-requests/:requestId/reject — reject an incoming request
router.post('/me/friend-requests/:requestId/reject', requireAuth, async (req: AuthRequest, res: Response) => {
  const { data, error } = await supabase
    .from('friend_requests')
    .update({ status: 'rejected', updated_at: new Date().toISOString() })
    .eq('id', req.params.requestId)
    .eq('recipient_id', req.userId!)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle()

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }
  if (!data) {
    res.status(404).json({ error: 'Friend request not found.' })
    return
  }

  res.json({ ok: true })
})

// DELETE /users/me/friend-requests/:requestId — cancel an outgoing request
router.delete('/me/friend-requests/:requestId', requireAuth, async (req: AuthRequest, res: Response) => {
  const { data, error } = await supabase
    .from('friend_requests')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', req.params.requestId)
    .eq('requester_id', req.userId!)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle()

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }
  if (!data) {
    res.status(404).json({ error: 'Friend request not found.' })
    return
  }

  res.status(204).send()
})

// POST /users/me/friends/:friendId — add friend
router.post('/me/friends/:friendId', requireAuth, async (req: AuthRequest, res: Response) => {
  const friendId = req.params.friendId

  if (friendId === req.userId) {
    res.status(400).json({ error: 'Cannot add yourself as a friend.' })
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
      res.status(409).json({ error: 'Already friends.' })
      return
    }
    res.status(500).json({ error: error.message })
    return
  }
  res.status(201).json({ ok: true })
})

// DELETE /users/me/friends/:friendId — remove friend
router.delete('/me/friends/:friendId', requireAuth, async (req: AuthRequest, res: Response) => {
  const friendId = req.params.friendId

  const { error } = await supabase
    .from('friendships')
    .delete()
    .or(
      `and(user_id.eq.${req.userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${req.userId})`
    )

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }
  res.status(204).send()
})

// GET /users/:id — view another user's public profile
router.get('/:id', async (req, res: Response) => {
  const { data, error } = await supabase
    .from('users')
    .select('id, username, avatar_url, created_at')
    .eq('id', req.params.id)
    .single()

  if (error) {
    res.status(404).json({ error: 'User not found.' })
    return
  }
  res.json(data)
})

export default router
