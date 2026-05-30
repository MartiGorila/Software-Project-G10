import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { supabase } from '../index'
import { requireAuth, AuthRequest } from '../middleware/auth'

const router = Router()

const TagSchema = z.object({
    name: z.string().min(1).max(50),
})

// GET /tags — list all tags
router.get('/', async (_req: Request, res: Response) => {
    const { data, error } = await supabase
        .from('tags')
        .select('id, name')
        .order('name', { ascending: true })

    if (error) {
        res.status(500).json({ error: error.message })
        return
    }
    res.json(data)
})

// POST /tags — create a tag (auth required)
router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
    const parsed = TagSchema.safeParse(req.body)
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() })
        return
    }

    const { data, error } = await supabase
        .from('tags')
        .insert({ name: parsed.data.name.toLowerCase().trim() })
        .select()
        .single()

    if (error) {
        if (error.code === '23505') {
            // Tag already exists — return the existing one
            const { data: existing } = await supabase
                .from('tags')
                .select('id, name')
                .eq('name', parsed.data.name.toLowerCase().trim())
                .single()
            res.status(200).json(existing)
            return
        }
        res.status(500).json({ error: error.message })
        return
    }
    res.status(201).json(data)
})

// POST /events/:id/tags — add tag to event (creator only)
router.post('/events/:id/tags', requireAuth, async (req: AuthRequest, res: Response) => {
    const { tag_id } = req.body
    if (!tag_id) {
        res.status(400).json({ error: 'tag_id is required' })
        return
    }

    // Verify event exists and user is creator
    const { data: event } = await supabase
        .from('events')
        .select('creator_id')
        .eq('id', req.params.id)
        .single()

    if (!event || event.creator_id !== req.userId) {
        res.status(403).json({ error: 'Not your event.' })
        return
    }

    const { error } = await supabase
        .from('event_tags')
        .insert({ event_id: req.params.id, tag_id })

    if (error && error.code !== '23505') {
        res.status(500).json({ error: error.message })
        return
    }
    res.status(201).json({ ok: true })
})

// DELETE /events/:id/tags/:tagId — remove tag from event (creator only)
router.delete('/events/:id/tags/:tagId', requireAuth, async (req: AuthRequest, res: Response) => {
    const { data: event } = await supabase
        .from('events')
        .select('creator_id')
        .eq('id', req.params.id)
        .single()

    if (!event || event.creator_id !== req.userId) {
        res.status(403).json({ error: 'Not your event.' })
        return
    }

    const { error } = await supabase
        .from('event_tags')
        .delete()
        .eq('event_id', req.params.id)
        .eq('tag_id', req.params.tagId)

    if (error) {
        res.status(500).json({ error: error.message })
        return
    }
    res.status(204).send()
})

// POST /plans/:id/tags — add tag to plan (creator only)
router.post('/plans/:id/tags', requireAuth, async (req: AuthRequest, res: Response) => {
    const { tag_id } = req.body
    if (!tag_id) {
        res.status(400).json({ error: 'tag_id is required' })
        return
    }

    const { data: plan } = await supabase
        .from('plans')
        .select('creator_id')
        .eq('id', req.params.id)
        .single()

    if (!plan || plan.creator_id !== req.userId) {
        res.status(403).json({ error: 'Not your plan.' })
        return
    }

    const { error } = await supabase
        .from('plan_tags')
        .insert({ plan_id: req.params.id, tag_id })

    if (error && error.code !== '23505') {
        res.status(500).json({ error: error.message })
        return
    }
    res.status(201).json({ ok: true })
})

// DELETE /plans/:id/tags/:tagId — remove tag from plan (creator only)
router.delete('/plans/:id/tags/:tagId', requireAuth, async (req: AuthRequest, res: Response) => {
    const { data: plan } = await supabase
        .from('plans')
        .select('creator_id')
        .eq('id', req.params.id)
        .single()

    if (!plan || plan.creator_id !== req.userId) {
        res.status(403).json({ error: 'Not your plan.' })
        return
    }

    const { error } = await supabase
        .from('plan_tags')
        .delete()
        .eq('plan_id', req.params.id)
        .eq('tag_id', req.params.tagId)

    if (error) {
        res.status(500).json({ error: error.message })
        return
    }
    res.status(204).send()
})

export default router