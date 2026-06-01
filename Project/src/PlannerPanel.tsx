import { useMemo, useState } from 'react'
import type { ApiEvent, ApiPlan, Tag } from './api'

type PlannerType = 'both' | 'events' | 'plans'
type PlanLength = 'quick' | 'half-day' | 'full-day'

type PlannerItem = {
    type: 'event' | 'plan'
    id: string
    name: string
    description: string | null
    lat: number
    lng: number
    budget: number | null
    tags: Tag[]
    eventTime?: string
    distanceFromCenter: number
    score: number
    reasons: string[]
}

type RouteStop = PlannerItem & {
    stopNumber: number
    legDistance: number
}

type PlannerPanelProps = {
    events: ApiEvent[]
    plans: ApiPlan[]
    mapCenter: [number, number]
    tags: Tag[]
    onClose: () => void
    onOpenEventDetails: (eventId: string) => void
    onCenterOnMap: (position: [number, number]) => void
}

const EARTH_RADIUS_KM = 6371
const lengthToStops: Record<PlanLength, number> = {
    quick: 2,
    'half-day': 4,
    'full-day': 6,
}

function toRadians(value: number) {
    return value * Math.PI / 180
}

function distanceKm(from: [number, number], to: [number, number]) {
    const dLat = toRadians(to[0] - from[0])
    const dLng = toRadians(to[1] - from[1])
    const lat1 = toRadians(from[0])
    const lat2 = toRadians(to[0])
    const a = Math.sin(dLat / 2) ** 2
        + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
    return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatBudget(budget: number | null) {
    return budget == null ? 'Budget unknown' : `€${budget.toFixed(2)}`
}

function formatEventTime(iso: string) {
    return new Date(iso).toLocaleString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    })
}

function getPreview(description: string | null) {
    if (!description) return 'No description yet.'
    return description.length > 120 ? `${description.slice(0, 117)}...` : description
}

function hasValidCoordinates(item: { lat: number; lng: number }) {
    return Number.isFinite(item.lat) && Number.isFinite(item.lng)
}

function scoreItem(
    item: Omit<PlannerItem, 'score' | 'reasons'>,
    radiusKm: number,
    selectedTagIds: Set<number>,
    budgetMax: number | null,
): Pick<PlannerItem, 'score' | 'reasons'> {
    const reasons = [`${item.distanceFromCenter.toFixed(1)}km from the map center`]
    const distanceScore = Math.max(0, 30 * (1 - item.distanceFromCenter / radiusKm))

    let tagScore = 0
    if (selectedTagIds.size > 0) {
        const tagIds = new Set(item.tags.map((tag) => tag.id))
        const matchedCount = [...selectedTagIds].filter((tagId) => tagIds.has(tagId)).length
        tagScore = 50 * (matchedCount / selectedTagIds.size)
        reasons.push(`matches ${matchedCount} selected tag${matchedCount === 1 ? '' : 's'}`)
    } else if (item.tags.length > 0) {
        reasons.push('has tags for the selected mood')
    }

    let budgetScore = 0
    if (budgetMax !== null) {
        if (item.budget === null) {
            budgetScore = 5
            reasons.push('budget is unknown')
        } else if (item.budget <= budgetMax) {
            budgetScore = 20
            reasons.push('within your max budget')
        } else {
            reasons.push('over your max budget')
        }
    }

    let timeScore = 0
    if (item.type === 'event' && item.eventTime) {
        const time = new Date(item.eventTime).getTime()
        if (Number.isFinite(time) && time >= Date.now()) {
            timeScore = 5
            reasons.push('upcoming event')
        }
    }

    return {
        score: Math.round((distanceScore + tagScore + budgetScore + timeScore) * 100) / 100,
        reasons,
    }
}

function buildRoute(
    candidates: PlannerItem[],
    mapCenter: [number, number],
    targetStops: number,
    budgetMax: number | null,
): RouteStop[] {
    const remaining = [...candidates].sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        if (a.distanceFromCenter !== b.distanceFromCenter) return a.distanceFromCenter - b.distanceFromCenter
        if (a.type !== b.type) return a.type.localeCompare(b.type)
        return a.name.localeCompare(b.name)
    })
    const route: RouteStop[] = []
    let currentPosition = mapCenter
    let knownBudget = 0

    while (route.length < targetStops && remaining.length > 0) {
        const ranked = remaining
            .map((item) => {
                const legDistance = distanceKm(currentPosition, [item.lat, item.lng])
                const nextKnownBudget = knownBudget + (item.budget ?? 0)
                const budgetPenalty = budgetMax !== null && item.budget !== null && nextKnownBudget > budgetMax ? 80 : 0
                const legScore = Math.max(0, 35 * (1 - legDistance / Math.max(1, item.distanceFromCenter + legDistance)))
                return {
                    item,
                    legDistance,
                    routeScore: item.score + legScore - budgetPenalty,
                }
            })
            .sort((a, b) => {
                if (b.routeScore !== a.routeScore) return b.routeScore - a.routeScore
                if (a.legDistance !== b.legDistance) return a.legDistance - b.legDistance
                if (a.item.type !== b.item.type) return a.item.type.localeCompare(b.item.type)
                return a.item.name.localeCompare(b.item.name)
            })

        const next = ranked[0]
        if (!next || next.routeScore < -20) break

        route.push({
            ...next.item,
            stopNumber: route.length + 1,
            legDistance: next.legDistance,
            reasons: route.length === 0
                ? next.item.reasons
                : [...next.item.reasons, `nearest good next stop at ${next.legDistance.toFixed(1)}km`],
        })
        if (next.item.budget !== null) knownBudget += next.item.budget
        currentPosition = [next.item.lat, next.item.lng]
        remaining.splice(remaining.findIndex((item) => item.type === next.item.type && item.id === next.item.id), 1)
    }

    return route
}

export default function PlannerPanel({
    events,
    plans,
    mapCenter,
    tags,
    onClose,
    onOpenEventDetails,
    onCenterOnMap,
}: PlannerPanelProps) {
    const [radiusKm, setRadiusKm] = useState('10')
    const [budgetMax, setBudgetMax] = useState('')
    const [typeMix, setTypeMix] = useState<PlannerType>('both')
    const [planLength, setPlanLength] = useState<PlanLength>('quick')
    const [selectedTagIds, setSelectedTagIds] = useState<Set<number>>(new Set())

    const parsedRadius = Number(radiusKm)
    const safeRadius = Number.isFinite(parsedRadius) && parsedRadius > 0 ? parsedRadius : 10
    const parsedBudget = budgetMax.trim() === '' ? null : Number(budgetMax)
    const safeBudgetMax = parsedBudget !== null && Number.isFinite(parsedBudget) && parsedBudget >= 0 ? parsedBudget : null

    const route = useMemo(() => {
        const selectedTags = selectedTagIds
        const normalized: PlannerItem[] = [
            ...(typeMix === 'plans' ? [] : events.filter(hasValidCoordinates).map((event) => {
                const base = {
                    type: 'event' as const,
                    id: event.id,
                    name: event.name,
                    description: event.description,
                    lat: event.lat,
                    lng: event.lng,
                    budget: event.budget,
                    tags: event.tags ?? [],
                    eventTime: event.event_time,
                    distanceFromCenter: distanceKm(mapCenter, [event.lat, event.lng]),
                }
                return { ...base, ...scoreItem(base, safeRadius, selectedTags, safeBudgetMax) }
            })),
            ...(typeMix === 'events' ? [] : plans.filter(hasValidCoordinates).map((plan) => {
                const base = {
                    type: 'plan' as const,
                    id: plan.id,
                    name: plan.name,
                    description: plan.description,
                    lat: plan.lat,
                    lng: plan.lng,
                    budget: plan.budget,
                    tags: plan.tags ?? [],
                    distanceFromCenter: distanceKm(mapCenter, [plan.lat, plan.lng]),
                }
                return { ...base, ...scoreItem(base, safeRadius, selectedTags, safeBudgetMax) }
            })),
        ]

        const candidates = normalized
            .filter((item) => item.distanceFromCenter <= safeRadius)
            .filter((item) => {
                if (selectedTags.size === 0) return true
                const itemTagIds = new Set(item.tags.map((tag) => tag.id))
                return [...selectedTags].every((tagId) => itemTagIds.has(tagId))
            })

        return buildRoute(candidates, mapCenter, lengthToStops[planLength], safeBudgetMax)
    }, [events, mapCenter, planLength, plans, safeBudgetMax, safeRadius, selectedTagIds, typeMix])

    const knownBudget = route.reduce((total, stop) => total + (stop.budget ?? 0), 0)
    const hasUnknownBudget = route.some((stop) => stop.budget === null)
    const totalDistance = route.reduce((total, stop) => total + stop.legDistance, 0)

    const toggleTag = (tagId: number) => {
        setSelectedTagIds((previous) => {
            const next = new Set(previous)
            next.has(tagId) ? next.delete(tagId) : next.add(tagId)
            return next
        })
    }

    return (
        <div className="planner-backdrop" onClick={onClose}>
            <section className="planner-panel" aria-label="Route planner" onClick={(event) => event.stopPropagation()}>
                <div className="planner-panel__header">
                    <div>
                        <span className="planner-panel__eyebrow">Random planner</span>
                        <h2>Build a nearby route</h2>
                        <p>Built from nearby plans/events matching your filters.</p>
                    </div>
                    <button type="button" className="explore-panel__close" onClick={onClose} aria-label="Close planner">
                        x
                    </button>
                </div>

                <div className="planner-panel__body">
                    <div className="planner-toolbar">
                        <div className="planner-controls">
                            <label className="planner-field">
                                <span>Radius</span>
                                <input
                                    type="number"
                                    min="1"
                                    max="100"
                                    value={radiusKm}
                                    onChange={(event) => setRadiusKm(event.target.value)}
                                />
                            </label>
                            <label className="planner-field">
                                <span>Budget</span>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="Any"
                                    value={budgetMax}
                                    onChange={(event) => setBudgetMax(event.target.value)}
                                />
                            </label>
                            <label className="planner-field">
                                <span>Mix</span>
                                <select value={typeMix} onChange={(event) => setTypeMix(event.target.value as PlannerType)}>
                                    <option value="both">Both</option>
                                    <option value="events">Events only</option>
                                    <option value="plans">Plans only</option>
                                </select>
                            </label>
                            <label className="planner-field">
                                <span>Length</span>
                                <select value={planLength} onChange={(event) => setPlanLength(event.target.value as PlanLength)}>
                                    <option value="quick">Quick · 2</option>
                                    <option value="half-day">Half-day · 4</option>
                                    <option value="full-day">Full-day · 6</option>
                                </select>
                            </label>
                        </div>

                        <div className="planner-tags" aria-label="Planner tag filters">
                            <span>Tags</span>
                            <div className="planner-tags__list">
                                {tags.length === 0 && <em>No tags available.</em>}
                                {tags.map((tag) => (
                                    <button
                                        key={tag.id}
                                        type="button"
                                        className={selectedTagIds.has(tag.id) ? 'planner-tag planner-tag--active' : 'planner-tag'}
                                        onClick={() => toggleTag(tag.id)}
                                    >
                                        #{tag.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="planner-summary">
                        <div>
                            <strong>{route.length}</strong>
                            <span>stops</span>
                        </div>
                        <div>
                            <strong>€{knownBudget.toFixed(2)}</strong>
                            <span>{hasUnknownBudget ? 'known budget, some unknown' : 'known budget'}</span>
                        </div>
                        <div>
                            <strong>{totalDistance.toFixed(1)}km</strong>
                            <span>route distance</span>
                        </div>
                    </div>

                    <div className="planner-route">
                        {route.length === 0 && (
                            <div className="planner-empty">
                                No route could be generated with these filters. Try widening the radius or clearing tags.
                            </div>
                        )}
                        {route.map((stop) => (
                            <article key={`${stop.type}-${stop.id}`} className="planner-stop">
                                <div className="planner-stop__rail">
                                    <div className="planner-stop__number">{stop.stopNumber}</div>
                                </div>
                                <div className="planner-stop__content">
                                    <div className="planner-stop__topline">
                                        <span className={`explore-card__badge explore-card__badge--${stop.type}`}>
                                            {stop.type === 'event' ? 'Event' : 'Plan'}
                                        </span>
                                        <span className="explore-card__distance">
                                            {stop.legDistance.toFixed(1)}km leg · {stop.distanceFromCenter.toFixed(1)}km from center
                                        </span>
                                    </div>
                                    <h3>{stop.name}</h3>
                                    <p>{getPreview(stop.description)}</p>
                                    <div className="explore-card__meta">
                                        <span>{formatBudget(stop.budget)}</span>
                                        {stop.type === 'event' && stop.eventTime && <span>{formatEventTime(stop.eventTime)}</span>}
                                    </div>
                                    {stop.tags.length > 0 && (
                                        <div className="explore-card__tags">
                                            {stop.tags.map((tag) => (
                                                <span key={tag.id}>#{tag.name}</span>
                                            ))}
                                        </div>
                                    )}
                                    <div className="planner-stop__reasons">
                                        {stop.reasons.map((reason) => (
                                            <span key={reason}>{reason}</span>
                                        ))}
                                    </div>
                                    <div className="planner-stop__actions">
                                        {stop.type === 'event' && (
                                            <button
                                                type="button"
                                                className="planner-action"
                                                onClick={() => {
                                                    onOpenEventDetails(stop.id)
                                                    onClose()
                                                }}
                                            >
                                                Open full event details
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            className="planner-action planner-action--secondary"
                                            onClick={() => {
                                                onCenterOnMap([stop.lat, stop.lng])
                                                onClose()
                                            }}
                                        >
                                            Center on map
                                        </button>
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    )
}
