import { Router, Response } from 'express'
import { z } from 'zod'
import { supabase } from '../index'
import { optionalAuth, requireAuth, AuthRequest } from '../middleware/auth'
import { canViewRecord, filterVisibleRecords, getFriendIds, normalizeVisibility } from '../utils/visibility'

const router = Router()

const EventSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  lat: z.number(),
  lng: z.number(),
  event_time: z.string().datetime(),
  budget: z.number().optional(),
  capacity: z.number().int().optional(),
  visibility: z.enum(['public', 'friends', 'private']).default('public'),
})

// GET /events — list all events with tags
router.get('/', optionalAuth, async (req: AuthRequest, res: Response) => {
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
      ),
      event_tags (
        tag:tags (
          id,
          name
        )
      )
    `)
    .order('event_time', { ascending: true })

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }

  // Flatten tags: event_tags: [{ tag: { id, name } }] -> tags: [{ id, name }]
  try {
    const friendIds = await getFriendIds(req.userId)
    const normalized = filterVisibleRecords((data ?? []).map((e: Record<string, unknown>) => ({
      ...e,
      visibility: normalizeVisibility(e.visibility),
      tags: ((e.event_tags as { tag: { id: number; name: string } }[]) ?? []).map((et) => et.tag),
      event_tags: undefined,
    })), req.userId, friendIds)

    res.json(normalized)
  } catch (visibilityError) {
    res.status(500).json({ error: visibilityError instanceof Error ? visibilityError.message : 'Failed to apply visibility.' })
  }
})

// GET /events/:id — single event with participants and tags
router.get('/:id', optionalAuth, async (req: AuthRequest, res: Response) => {
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
      ),
      event_tags (
        tag:tags (
          id,
          name
        )
      )
    `)
    .eq('id', req.params.id)
    .single()

  if (error) {
    res.status(404).json({ error: 'Event not found.' })
    return
  }

  try {
    const friendIds = await getFriendIds(req.userId)
    const normalized = {
      ...data,
      visibility: normalizeVisibility(data.visibility),
      tags: ((data.event_tags as { tag: { id: number; name: string } }[]) ?? []).map((et) => et.tag),
      event_tags: undefined,
    }

    if (filterVisibleRecords([normalized], req.userId, friendIds).length === 0) {
      res.status(404).json({ error: 'Event not found.' })
      return
    }

    res.json(normalized)
  } catch (visibilityError) {
    res.status(500).json({ error: visibilityError instanceof Error ? visibilityError.message : 'Failed to apply visibility.' })
  }
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

  // Attach tags if provided
  const tagIds: number[] = req.body.tag_ids ?? []
  if (tagIds.length > 0) {
    await supabase
      .from('event_tags')
      .insert(tagIds.map((tag_id) => ({ event_id: data.id, tag_id })))
  }

  res.status(201).json({ ...data, tags: [] })
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
  const { data: event } = await supabase
    .from('events')
    .select('capacity, creator_id, visibility')
    .eq('id', req.params.id)
    .single()

  if (!event) {
    res.status(404).json({ error: 'Event not found.' })
    return
  }

  const friendIds = await getFriendIds(req.userId)
  if (!canViewRecord({ ...event, visibility: normalizeVisibility(event.visibility) }, req.userId, friendIds)) {
    res.status(404).json({ error: 'Event not found.' })
    return
  }

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
