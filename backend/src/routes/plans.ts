import { Router, Response } from 'express'
import { z } from 'zod'
import { supabase } from '../index'
import { requireAuth, AuthRequest } from '../middleware/auth'

const router = Router()

const PlanSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  lat: z.number(),
  lng: z.number(),
  budget: z.number().optional(),
})

// GET /plans — list all plans with tags
router.get('/', async (_req, res: Response) => {
  const { data, error } = await supabase
    .from('plans')
    .select(`
      *,
      creator:users!plans_creator_id_fkey (
        id,
        username
      ),
      plan_tags (
        tag:tags (
          id,
          name
        )
      )
    `)
    .order('created_at', { ascending: false })

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }

  const normalized = (data ?? []).map((p: Record<string, unknown>) => ({
    ...p,
    tags: ((p.plan_tags as { tag: { id: number; name: string } }[]) ?? []).map((pt) => pt.tag),
    plan_tags: undefined,
  }))

  res.json(normalized)
})

// GET /plans/:id — single plan with tags
router.get('/:id', async (req, res: Response) => {
  const { data, error } = await supabase
    .from('plans')
    .select(`
      *,
      creator:users!plans_creator_id_fkey (
        id,
        username
      ),
      plan_tags (
        tag:tags (
          id,
          name
        )
      )
    `)
    .eq('id', req.params.id)
    .single()

  if (error) {
    res.status(404).json({ error: 'Plan not found.' })
    return
  }

  const normalized = {
    ...data,
    tags: ((data.plan_tags as { tag: { id: number; name: string } }[]) ?? []).map((pt) => pt.tag),
    plan_tags: undefined,
  }

  res.json(normalized)
})

// POST /plans — create plan (auth required)
router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const parsed = PlanSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }

  const { data, error } = await supabase
    .from('plans')
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
      .from('plan_tags')
      .insert(tagIds.map((tag_id) => ({ plan_id: data.id, tag_id })))
  }

  res.status(201).json({ ...data, tags: [] })
})

// PUT /plans/:id — edit plan (creator only)
router.put('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const parsed = PlanSchema.partial().safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }

  const { data, error } = await supabase
    .from('plans')
    .update(parsed.data)
    .eq('id', req.params.id)
    .eq('creator_id', req.userId!)
    .select()
    .single()

  if (error || !data) {
    res.status(404).json({ error: 'Plan not found or not yours.' })
    return
  }
  res.json(data)
})

// DELETE /plans/:id — delete plan (creator only)
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const { error } = await supabase
    .from('plans')
    .delete()
    .eq('id', req.params.id)
    .eq('creator_id', req.userId!)

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }
  res.status(204).send()
})

export default router