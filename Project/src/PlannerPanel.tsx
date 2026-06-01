import { useMemo, useState } from 'react'
import type { ApiEvent, ApiPlan, Tag } from './api'
import { getCategoryIcon, getVisibleTags } from './categoryIcons'
import type { SavedRouteDraft } from './savedContent'

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
    isLoggedIn: boolean
    onSaveRoute: (route: SavedRouteDraft) => { saved: boolean; message: string }
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

function formatEventClock(iso: string) {
    return new Date(iso).toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
    })
}

function formatRouteDate(dateKey: string) {
    const [year, month, day] = dateKey.split('-').map(Number)
    return new Date(year, month - 1, day).toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
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

function eventTimeMs(item: PlannerItem) {
    if (item.type !== 'event' || !item.eventTime) return null
    const time = new Date(item.eventTime).getTime()
    return Number.isFinite(time) ? time : null
}

function eventDateKey(item: PlannerItem) {
    if (item.type !== 'event' || !item.eventTime) return null
    const date = new Date(item.eventTime)
    if (!Number.isFinite(date.getTime())) return null
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

function withUniqueReason(item: PlannerItem, reason: string): PlannerItem {
    return item.reasons.includes(reason) ? item : { ...item, reasons: [...item.reasons, reason] }
}

function selectRouteCandidates(
    candidates: PlannerItem[],
    mapCenter: [number, number],
    targetStops: number,
    budgetMax: number | null,
): PlannerItem[] {
    const remaining = [...candidates].sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        if (a.distanceFromCenter !== b.distanceFromCenter) return a.distanceFromCenter - b.distanceFromCenter
        if (a.type !== b.type) return a.type.localeCompare(b.type)
        return a.name.localeCompare(b.name)
    })
    const selected: PlannerItem[] = []
    let currentPosition = mapCenter
    let knownBudget = 0

    while (selected.length < targetStops && remaining.length > 0) {
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

        selected.push(next.item)
        if (next.item.budget !== null) knownBudget += next.item.budget
        currentPosition = [next.item.lat, next.item.lng]
        remaining.splice(remaining.findIndex((item) => item.type === next.item.type && item.id === next.item.id), 1)
    }

    return selected
}

function nearestFirst(items: PlannerItem[], start: [number, number]) {
    const remaining = [...items]
    const ordered: PlannerItem[] = []
    let currentPosition = start

    while (remaining.length > 0) {
        remaining.sort((a, b) => {
            const aDistance = distanceKm(currentPosition, [a.lat, a.lng])
            const bDistance = distanceKm(currentPosition, [b.lat, b.lng])
            if (aDistance !== bDistance) return aDistance - bDistance
            if (b.score !== a.score) return b.score - a.score
            return a.name.localeCompare(b.name)
        })
        const next = remaining.shift()
        if (!next) break
        ordered.push(next)
        currentPosition = [next.lat, next.lng]
    }

    return ordered
}

function addStopNumbers(items: PlannerItem[], mapCenter: [number, number]): RouteStop[] {
    let currentPosition = mapCenter
    return items.map((item, index) => {
        const legDistance = distanceKm(currentPosition, [item.lat, item.lng])
        currentPosition = [item.lat, item.lng]
        return {
            ...item,
            stopNumber: index + 1,
            legDistance,
        }
    })
}

function orderRouteCandidates(selected: PlannerItem[], mapCenter: [number, number]): RouteStop[] {
    const timedEvents = selected
        .filter((item) => eventTimeMs(item) !== null)
        .sort((a, b) => {
            const aTime = eventTimeMs(a) ?? 0
            const bTime = eventTimeMs(b) ?? 0
            if (aTime !== bTime) return aTime - bTime
            return a.name.localeCompare(b.name)
        })
        .map((item) => withUniqueReason(item, `scheduled at ${formatEventClock(item.eventTime ?? '')}`))
    const untimedItems = selected.filter((item) => eventTimeMs(item) === null)

    if (timedEvents.length === 0) {
        return addStopNumbers(nearestFirst(untimedItems, mapCenter), mapCenter)
    }

    const slots: PlannerItem[][] = Array.from({ length: timedEvents.length + 1 }, () => [])

    untimedItems.forEach((item) => {
        const slotCosts = slots.map((_, slotIndex) => {
            if (slotIndex === 0) {
                return distanceKm(mapCenter, [item.lat, item.lng]) + distanceKm([item.lat, item.lng], [timedEvents[0].lat, timedEvents[0].lng])
            }

            const previousTimed = timedEvents[slotIndex - 1]
            const previousPoint: [number, number] = [previousTimed.lat, previousTimed.lng]

            if (slotIndex === timedEvents.length) {
                return distanceKm(previousPoint, [item.lat, item.lng])
            }

            const nextTimed = timedEvents[slotIndex]
            const nextPoint: [number, number] = [nextTimed.lat, nextTimed.lng]
            const directDistance = distanceKm(previousPoint, nextPoint)
            return distanceKm(previousPoint, [item.lat, item.lng]) + distanceKm([item.lat, item.lng], nextPoint) - directDistance
        })
        const bestSlotIndex = slotCosts.reduce((bestIndex, cost, index) => cost < slotCosts[bestIndex] ? index : bestIndex, 0)
        const placementReason = bestSlotIndex === 0
            ? 'placed before the first timed stop'
            : bestSlotIndex === timedEvents.length
                ? 'placed after timed stops'
                : 'placed between timed stops'
        slots[bestSlotIndex].push(withUniqueReason(item, placementReason))
    })

    const ordered: PlannerItem[] = []
    let anchor = mapCenter
    ordered.push(...nearestFirst(slots[0], anchor))
    if (ordered.length > 0) {
        const last = ordered[ordered.length - 1]
        anchor = [last.lat, last.lng]
    }

    timedEvents.forEach((event, index) => {
        ordered.push(event)
        anchor = [event.lat, event.lng]
        const slotItems = nearestFirst(slots[index + 1], anchor)
        ordered.push(...slotItems)
        if (slotItems.length > 0) {
            const last = slotItems[slotItems.length - 1]
            anchor = [last.lat, last.lng]
        }
    })

    return addStopNumbers(ordered, mapCenter)
}

function buildRoute(
    candidates: PlannerItem[],
    mapCenter: [number, number],
    targetStops: number,
    budgetMax: number | null,
): RouteStop[] {
    return orderRouteCandidates(
        selectRouteCandidates(candidates, mapCenter, targetStops, budgetMax),
        mapCenter,
    )
}

function chooseBestEventDate(candidates: PlannerItem[]) {
    const groups = new Map<string, PlannerItem[]>()
    candidates.forEach((item) => {
        const dateKey = eventDateKey(item)
        if (!dateKey) return
        groups.set(dateKey, [...(groups.get(dateKey) ?? []), item])
    })

    return [...groups.entries()]
        .map(([dateKey, items]) => ({
            dateKey,
            items,
            totalScore: items.reduce((sum, item) => sum + item.score, 0),
        }))
        .sort((a, b) => {
            if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore
            if (b.items.length !== a.items.length) return b.items.length - a.items.length
            return a.dateKey.localeCompare(b.dateKey)
        })[0] ?? null
}

export default function PlannerPanel({
    events,
    plans,
    mapCenter,
    tags,
    onClose,
    onOpenEventDetails,
    onCenterOnMap,
    isLoggedIn,
    onSaveRoute,
}: PlannerPanelProps) {
    const [radiusKm, setRadiusKm] = useState('10')
    const [budgetMax, setBudgetMax] = useState('')
    const [typeMix, setTypeMix] = useState<PlannerType>('both')
    const [planLength, setPlanLength] = useState<PlanLength>('quick')
    const [selectedTagIds, setSelectedTagIds] = useState<Set<number>>(new Set())
    const [saveMessage, setSaveMessage] = useState('')

    const parsedRadius = Number(radiusKm)
    const safeRadius = Number.isFinite(parsedRadius) && parsedRadius > 0 ? parsedRadius : 10
    const parsedBudget = budgetMax.trim() === '' ? null : Number(budgetMax)
    const safeBudgetMax = parsedBudget !== null && Number.isFinite(parsedBudget) && parsedBudget >= 0 ? parsedBudget : null

    const routeResult = useMemo(() => {
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

        const bestEventDate = typeMix === 'plans' ? null : chooseBestEventDate(candidates)
        const sameDayCandidates = bestEventDate
            ? candidates.filter((item) => item.type === 'plan' || eventDateKey(item) === bestEventDate.dateKey)
            : candidates

        return {
            route: buildRoute(sameDayCandidates, mapCenter, lengthToStops[planLength], safeBudgetMax),
            routeDateLabel: bestEventDate ? formatRouteDate(bestEventDate.dateKey) : '',
        }
    }, [events, mapCenter, planLength, plans, safeBudgetMax, safeRadius, selectedTagIds, typeMix])

    const { route, routeDateLabel } = routeResult
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

    const handleSaveRoute = () => {
        if (route.length === 0) return
        const result = onSaveRoute({
            title: routeDateLabel ? `Planner route for ${routeDateLabel}` : 'Planner route',
            mapCenter,
            summary: {
                stops: route.length,
                knownBudget,
                hasUnknownBudget,
                totalDistance,
            },
            stops: route.map((stop) => ({
                type: stop.type,
                id: stop.id,
                name: stop.name,
                description: stop.description,
                lat: stop.lat,
                lng: stop.lng,
                budget: stop.budget,
                tags: stop.tags,
                eventTime: stop.eventTime,
                reasons: stop.reasons,
                stopNumber: stop.stopNumber,
            })),
        })
        setSaveMessage(result.message)
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

                    <div className="planner-save-row">
                        {routeDateLabel && <span>Built around {routeDateLabel}</span>}
                        <button
                            type="button"
                            className="planner-action planner-action--save"
                            onClick={handleSaveRoute}
                            disabled={!isLoggedIn || route.length === 0}
                        >
                            {isLoggedIn ? 'Save route' : 'Log in to save'}
                        </button>
                        {saveMessage && <span className="planner-save-row__message">{saveMessage}</span>}
                    </div>

                    <div className="planner-route">
                        {route.length === 0 && (
                            <div className="planner-empty">
                                No route could be generated with these filters. Try widening the radius or clearing tags.
                            </div>
                        )}
                        {route.map((stop) => {
                            const { visibleTags, hiddenCount } = getVisibleTags(stop.tags)
                            return (
                                <article key={`${stop.type}-${stop.id}`} className="planner-stop">
                                    <div className="planner-stop__rail">
                                        <div className="planner-stop__number">{stop.stopNumber}</div>
                                    </div>
                                    <div className="planner-stop__content">
                                        <div className="planner-stop__topline">
                                            <span className={`explore-card__badge explore-card__badge--${stop.type}`}>
                                                <span className="explore-card__icon" aria-hidden="true">
                                                    {getCategoryIcon(stop.tags, stop.type)}
                                                </span>
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
                                        {visibleTags.length > 0 && (
                                            <div className="explore-card__tags">
                                                {visibleTags.map((tag) => (
                                                    <span key={tag.id}>#{tag.name}</span>
                                                ))}
                                                {hiddenCount > 0 && <span className="explore-card__tag-more">+{hiddenCount} more</span>}
                                            </div>
                                        )}
                                        <div className="planner-stop__reasons">
                                            {stop.reasons.map((reason, reasonIndex) => (
                                                <span key={`${stop.type}-${stop.id}-${reasonIndex}`}>{reason}</span>
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
                            )
                        })}
                    </div>
                </div>
            </section>
        </div>
    )
}
