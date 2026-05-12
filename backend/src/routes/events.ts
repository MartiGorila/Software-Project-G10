import { Router, Response } from 'express'
import { z } from 'zod'
import { supabase } from '../index.js'
import { requireAuth, AuthRequest } from '../middleware/auth.js'

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
  try {
    const { data, error } = await supabase
      .from('events')
      .select(`
      *,
      creator:users!events_creator_id_fkey (
          id,
          username
      )
      `)
      .order('event_time', { ascending: true })

    if (error) {
      res.status(500).json({ error: 'Failed to fetch events', message: error.message })
      return
    }
    res.json(data)
  } catch (e) {
    res.status(500).json({ error: 'Internal server error', message: String(e) })
  }
})

// GET /events/:id — single event with participants
router.get('/:id', async (req, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('events')
      .select(`
        *,
        creator:users!events_creator_id_fkey (
          id,
          username
        ),
        event_participants (
          user_id,
          joined_at,
          user:users!event_participants_user_id_fkey (
            id,
            username
          )
        )
      `)
      .eq('id', req.params.id)
      .single()

    if (error) {
      res.status(404).json({ error: 'Event not found' })
      return
    }

    res.json(data)
  } catch (e) {
    res.status(500).json({ error: 'Internal server error', message: String(e) })
  }
})

// POST /events — create event (auth required)
router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const parsed = EventSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid event data', details: parsed.error.flatten() })
      return
    }

    const { data, error } = await supabase
      .from('events')
      .insert({ ...parsed.data, creator_id: req.userId })
      .select()
      .single()

    if (error) {
      res.status(500).json({ error: 'Failed to create event', message: error.message })
      return
    }
    res.status(201).json(data)
  } catch (e) {
    res.status(500).json({ error: 'Internal server error', message: String(e) })
  }
})

// PUT /events/:id — edit event (creator only)
router.put('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const parsed = EventSchema.partial().safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid event data', details: parsed.error.flatten() })
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
      res.status(404).json({ error: 'Event not found or you do not have permission to edit it' })
      return
    }
    res.json(data)
  } catch (e) {
    res.status(500).json({ error: 'Internal server error', message: String(e) })
  }
})

// DELETE /events/:id — delete event (creator only)
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', req.params.id)
      .eq('creator_id', req.userId!)

    if (error) {
      res.status(500).json({ error: 'Failed to delete event', message: error.message })
      return
    }
    res.status(204).send()
  } catch (e) {
    res.status(500).json({ error: 'Internal server error', message: String(e) })
  }
})

// POST /events/:id/join — join event
router.post('/:id/join', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
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
        res.status(409).json({ error: 'Event is full' })
        return
      }
    }

    const { error } = await supabase
      .from('event_participants')
      .insert({ user_id: req.userId, event_id: req.params.id })

    if (error) {
      if (error.code === '23505') {
        res.status(409).json({ error: 'Already joined this event' })
        return
      }
      res.status(500).json({ error: 'Failed to join event', message: error.message })
      return
    }
    res.status(201).json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: 'Internal server error', message: String(e) })
  }
})

// DELETE /events/:id/join — leave event
router.delete('/:id/join', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { error } = await supabase
      .from('event_participants')
      .delete()
      .eq('event_id', req.params.id)
      .eq('user_id', req.userId!)

    if (error) {
      res.status(500).json({ error: 'Failed to leave event', message: error.message })
      return
    }
    res.status(204).send()
  } catch (e) {
    res.status(500).json({ error: 'Internal server error', message: String(e) })
  }
})

export default router