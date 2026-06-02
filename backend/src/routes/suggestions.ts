import { Router, Request, Response } from 'express'
import { supabase } from '../index'
import { optionalAuth, AuthRequest } from '../middleware/auth'
import { filterVisibleRecords, getFriendIds, normalizeVisibility, Visibility } from '../utils/visibility'

const router = Router()

type Tag = {
  id: number
  name: string
}

type RawEvent = Record<string, unknown> & {
  id: string
  creator_id: string | null
  name: string
  description: string | null
  lat: number | null
  lng: number | null
  budget: number | string | null
  visibility?: Visibility | null
  event_time: string
  event_tags?: { tag: Tag }[]
}

type RawPlan = Record<string, unknown> & {
  id: string
  creator_id: string | null
  name: string
  description: string | null
  lat: number | null
  lng: number | null
  budget: number | string | null
  visibility?: Visibility | null
  plan_tags?: { tag: Tag }[]
}

type SuggestionType = 'event' | 'plan'

type SuggestionBase = {
  type: SuggestionType
  id: string
  creator_id: string | null
  name: string
  description: string | null
  lat: number
  lng: number
  budget: number | null
  visibility: Visibility
  tags: Tag[]
  event_time?: string
}

type SuggestionResult = SuggestionBase & {
  score: number
  distance_km: number
  reasons: string[]
}

function parseRequiredNumber(value: unknown): number | null {
  if (typeof value !== 'string' || value.trim() === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function parseOptionalNumber(value: unknown): number | null | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'string' || value.trim() === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function parseTagIds(value: unknown): number[] | null {
  if (value === undefined || value === '') return []
  if (typeof value !== 'string') return null

  const ids = value.split(',').map((raw) => Number(raw.trim()))
  if (ids.some((id) => !Number.isInteger(id) || id <= 0)) return null
  return [...new Set(ids)]
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function haversineKm(fromLat: number, fromLng: number, toLat: number, toLng: number): number {
  const earthRadiusKm = 6371
  const toRadians = (degrees: number) => degrees * Math.PI / 180
  const dLat = toRadians(toLat - fromLat)
  const dLng = toRadians(toLng - fromLng)
  const lat1 = toRadians(fromLat)
  const lat2 = toRadians(toLat)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function normalizeEvent(event: RawEvent): SuggestionBase | null {
  if (typeof event.lat !== 'number' || typeof event.lng !== 'number') return null
  if (!Number.isFinite(event.lat) || !Number.isFinite(event.lng)) return null

  return {
    type: 'event',
    id: event.id,
    creator_id: event.creator_id,
    name: event.name,
    description: event.description,
    lat: event.lat,
    lng: event.lng,
    budget: toNumber(event.budget),
    visibility: normalizeVisibility(event.visibility),
    tags: (event.event_tags ?? []).map((eventTag) => eventTag.tag).filter(Boolean),
    event_time: event.event_time,
  }
}

function normalizePlan(plan: RawPlan): SuggestionBase | null {
  if (typeof plan.lat !== 'number' || typeof plan.lng !== 'number') return null
  if (!Number.isFinite(plan.lat) || !Number.isFinite(plan.lng)) return null

  return {
    type: 'plan',
    id: plan.id,
    creator_id: plan.creator_id,
    name: plan.name,
    description: plan.description,
    lat: plan.lat,
    lng: plan.lng,
    budget: toNumber(plan.budget),
    visibility: normalizeVisibility(plan.visibility),
    tags: (plan.plan_tags ?? []).map((planTag) => planTag.tag).filter(Boolean),
  }
}

function scoreSuggestion(
  item: SuggestionBase,
  distanceKm: number,
  radiusKm: number,
  selectedTagIds: number[],
  budgetMax: number | undefined,
): SuggestionResult {
  const reasons: string[] = [`${distanceKm.toFixed(1)} km away`]
  const distanceScore = Math.max(0, 30 * (1 - distanceKm / radiusKm))

  let tagScore = 0
  if (selectedTagIds.length > 0) {
    const itemTagIds = new Set(item.tags.map((tag) => tag.id))
    const matchedCount = selectedTagIds.filter((tagId) => itemTagIds.has(tagId)).length
    tagScore = 50 * (matchedCount / selectedTagIds.length)
    reasons.push(matchedCount > 0
      ? `matches ${matchedCount} selected tag${matchedCount === 1 ? '' : 's'}`
      : 'no matching selected tags')
  }

  let budgetScore = 0
  if (budgetMax !== undefined) {
    if (item.budget === null) {
      budgetScore = 5
      reasons.push('budget unknown')
    } else if (item.budget <= budgetMax) {
      budgetScore = 20
      reasons.push('within budget')
    } else {
      reasons.push('over budget')
    }
  }

  const score = Math.round((distanceScore + tagScore + budgetScore) * 100) / 100
  return {
    ...item,
    score,
    distance_km: Math.round(distanceKm * 100) / 100,
    reasons,
  }
}

router.get('/', optionalAuth, async (req: AuthRequest & Request, res: Response) => {
  const lat = parseRequiredNumber(req.query.lat)
  const lng = parseRequiredNumber(req.query.lng)
  if (lat === null || lng === null || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    res.status(400).json({ error: 'Valid lat and lng query parameters are required.' })
    return
  }

  const radius = parseOptionalNumber(req.query.radius) ?? 10
  if (radius === null || radius <= 0) {
    res.status(400).json({ error: 'radius must be a positive number.' })
    return
  }

  const budgetMax = parseOptionalNumber(req.query.budget_max)
  if (budgetMax === null || (budgetMax !== undefined && budgetMax < 0)) {
    res.status(400).json({ error: 'budget_max must be a non-negative number.' })
    return
  }

  const selectedTagIds = parseTagIds(req.query.tag_ids)
  if (selectedTagIds === null) {
    res.status(400).json({ error: 'tag_ids must be a comma-separated list of positive integers.' })
    return
  }

  const type = req.query.type ?? 'all'
  if (type !== 'all' && type !== 'events' && type !== 'plans') {
    res.status(400).json({ error: 'type must be one of all, events, or plans.' })
    return
  }

  const [eventsResult, plansResult] = await Promise.all([
    type === 'plans'
      ? Promise.resolve({ data: [], error: null })
      : supabase
        .from('events')
        .select(`
          id,
          creator_id,
          name,
          description,
          lat,
          lng,
          budget,
          visibility,
          event_time,
          event_tags (
            tag:tags (
              id,
              name
            )
          )
        `),
    type === 'events'
      ? Promise.resolve({ data: [], error: null })
      : supabase
        .from('plans')
        .select(`
          id,
          creator_id,
          name,
          description,
          lat,
          lng,
          budget,
          visibility,
          plan_tags (
            tag:tags (
              id,
              name
            )
          )
        `),
  ])

  if (eventsResult.error) {
    res.status(500).json({ error: eventsResult.error.message })
    return
  }
  if (plansResult.error) {
    res.status(500).json({ error: plansResult.error.message })
    return
  }

  try {
    const friendIds = await getFriendIds(req.userId)
    const events = ((eventsResult.data ?? []) as RawEvent[]).map(normalizeEvent).filter((item): item is SuggestionBase => item !== null)
    const plans = ((plansResult.data ?? []) as RawPlan[]).map(normalizePlan).filter((item): item is SuggestionBase => item !== null)
    const results = filterVisibleRecords([...events, ...plans], req.userId, friendIds)
      .map((item) => {
        const distanceKm = haversineKm(lat, lng, item.lat, item.lng)
        if (distanceKm > radius) return null
        return scoreSuggestion(item, distanceKm, radius, selectedTagIds, budgetMax)
      })
      .filter((item): item is SuggestionResult => item !== null)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        if (a.distance_km !== b.distance_km) return a.distance_km - b.distance_km
        if (a.type !== b.type) return a.type.localeCompare(b.type)
        return a.name.localeCompare(b.name)
      })

    res.json({ results })
  } catch (visibilityError) {
    res.status(500).json({ error: visibilityError instanceof Error ? visibilityError.message : 'Failed to apply visibility.' })
  }
})

export default router
