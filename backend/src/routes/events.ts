import { Router, Response } from 'express'
import { z } from 'zod'
import { supabase } from '../index'
import { requireAuth, AuthRequest } from '../middleware/auth'

const router = Router()

const EventSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  lat: z.number(),
  lng: z.number(),
  event_time: z.string().datetime(),
  budget: z.number().optional(),
  capacity: z.number().int().optional(),
})

// GET /events — list all events
router.get('/', async (_req, res: Response) => {
  const { data, error } = await supabase
    .from('events')
    .select('*, users(username)')
    .order('event_time', { ascending: true })

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }
  res.json(data)
})

// GET /events/:id — single event with participants
router.get('/:id', async (req, res: Response) => {
  const { data, error } = await supabase
    .from('events')
    .select('*, users(username), event_participants(user_id, users(username))')
    .eq('id', req.params.id)
    .single()

  if (error) {
    res.status(404).json({ error: 'Event not found.' })
    return
  }
  res.json(data)
})

// POST /events — create event (auth required)
router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const parsed = EventSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }

  const { data, error } = await supabase
    .from('events')
    .insert({ ...parsed.data, creator_id: req.userId })
    .select()
    .single()

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }
  res.status(201).json(data)
})

// PUT /events/:id — edit event (creator only)
router.put('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const parsed = EventSchema.partial().safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }

  const { data, error } = await supabase
    .from('events')
    .update(parsed.data)
    .eq('id', req.params.id)
    .eq('creator_id', req.userId!)
    .select()
    .single()

  if (error || !data) {
    res.status(404).json({ error: 'Event not found or not yours.' })
    return
  }
  res.json(data)
})

// DELETE /events/:id — delete event (creator only)
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', req.params.id)
    .eq('creator_id', req.userId!)

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }
  res.status(204).send()
})

// POST /events/:id/join — join event
router.post('/:id/join', requireAuth, async (req: AuthRequest, res: Response) => {
  // Check capacity first
  const { data: event } = await supabase
    .from('events')
    .select('capacity')
    .eq('id', req.params.id)
    .single()

  if (event?.capacity !== null && event?.capacity !== undefined) {
    const { count } = await supabase
      .from('event_participants')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', req.params.id)

    if (count !== null && count >= event.capacity) {
      res.status(409).json({ error: 'Event is full.' })
      return
    }
  }

  const { error } = await supabase
    .from('event_participants')
    .insert({ user_id: req.userId, event_id: req.params.id })

  if (error) {
    if (error.code === '23505') {
      res.status(409).json({ error: 'Already joined.' })
      return
    }
    res.status(500).json({ error: error.message })
    return
  }
  res.status(201).json({ ok: true })
})

// DELETE /events/:id/join — leave event
router.delete('/:id/join', requireAuth, async (req: AuthRequest, res: Response) => {
  const { error } = await supabase
    .from('event_participants')
    .delete()
    .eq('event_id', req.params.id)
    .eq('user_id', req.userId!)

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }
  res.status(204).send()
})

export default router