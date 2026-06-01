import { useMemo, useState } from 'react'
import type { ApiEvent, ApiPlan, Tag } from './api'
import { getCategoryIcon, getVisibleTags } from './categoryIcons'

type ExploreItem =
    | { type: 'event'; item: ApiEvent; distanceKm: number }
    | { type: 'plan'; item: ApiPlan; distanceKm: number }

type ExplorePanelProps = {
    events: ApiEvent[]
    plans: ApiPlan[]
    mapCenter: [number, number]
    selectedTagIds: Set<number>
    tags: Tag[]
    onClose: () => void
    onSelectEvent: (eventId: string) => void
    onSelectPlan: (position: [number, number]) => void
    isLoggedIn: boolean
    savedPlanIds: Set<string>
    onSavePlan: (plan: ApiPlan) => { saved: boolean; message: string }
}

const EARTH_RADIUS_KM = 6371

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
    return budget == null ? 'Budget not set' : `€${budget.toFixed(2)}`
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

function matchesSelectedTags(itemTags: Tag[] | undefined, selectedTagIds: Set<number>) {
    if (selectedTagIds.size === 0) return true
    const itemTagIds = new Set((itemTags ?? []).map((tag) => tag.id))
    return [...selectedTagIds].every((tagId) => itemTagIds.has(tagId))
}

export default function ExplorePanel({
    events,
    plans,
    mapCenter,
    selectedTagIds,
    tags,
    onClose,
    onSelectEvent,
    onSelectPlan,
    isLoggedIn,
    savedPlanIds,
    onSavePlan,
}: ExplorePanelProps) {
    const [query, setQuery] = useState('')
    const [typeFilter, setTypeFilter] = useState<'all' | 'events' | 'plans'>('all')
    const [radiusKm, setRadiusKm] = useState(10)
    const [selectedItem, setSelectedItem] = useState<ExploreItem | null>(null)
    const [saveMessage, setSaveMessage] = useState('')

    const activeTags = useMemo(
        () => tags.filter((tag) => selectedTagIds.has(tag.id)),
        [selectedTagIds, tags],
    )

    const results = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase()
        const mixed: ExploreItem[] = [
            ...(typeFilter === 'plans' ? [] : events.map((event) => ({
                type: 'event' as const,
                item: event,
                distanceKm: distanceKm(mapCenter, [event.lat, event.lng]),
            }))),
            ...(typeFilter === 'events' ? [] : plans.map((plan) => ({
                type: 'plan' as const,
                item: plan,
                distanceKm: distanceKm(mapCenter, [plan.lat, plan.lng]),
            }))),
        ]

        return mixed
            .filter(({ item }) => matchesSelectedTags(item.tags, selectedTagIds))
            .filter(({ item }) => {
                if (!normalizedQuery) return true
                return [
                    item.name,
                    item.description ?? '',
                    ...(item.tags ?? []).map((tag) => tag.name),
                ].some((value) => value.toLowerCase().includes(normalizedQuery))
            })
            .filter(({ distanceKm }) => distanceKm <= radiusKm)
            .sort((a, b) => a.distanceKm - b.distanceKm || a.item.name.localeCompare(b.item.name))
    }, [events, mapCenter, plans, query, radiusKm, selectedTagIds, typeFilter])

    return (
        <div className="explore-backdrop" onClick={onClose}>
            <section className="explore-panel" aria-label="Explore events and plans" onClick={(event) => event.stopPropagation()}>
                <div className="explore-panel__header">
                    <div>
                        <span className="explore-panel__eyebrow">Browse nearby</span>
                        <h2>Explore events and plans</h2>
                        <p>Search the current map area using your active tag filters.</p>
                    </div>
                    <button type="button" className="explore-panel__close" onClick={onClose} aria-label="Close explore panel">
                        x
                    </button>
                </div>

                {selectedItem ? (
                    <div className="explore-detail">
                        <button type="button" className="explore-detail__back" onClick={() => {
                            setSaveMessage('')
                            setSelectedItem(null)
                        }}>
                            ← Back to results
                        </button>
                        <div className="explore-detail__card">
                            <div className="explore-card__topline">
                                <span className={`explore-card__badge explore-card__badge--${selectedItem.type}`}>
                                    <span className="explore-card__icon" aria-hidden="true">
                                        {getCategoryIcon(selectedItem.item.tags, selectedItem.type)}
                                    </span>
                                    {selectedItem.type === 'event' ? 'Event' : 'Plan'}
                                </span>
                                <span className="explore-card__distance">{selectedItem.distanceKm.toFixed(1)}km away</span>
                            </div>
                            <h3>{selectedItem.item.name}</h3>
                            <p>{selectedItem.item.description ?? 'No description yet.'}</p>
                            <div className="explore-card__meta">
                                <span>{formatBudget(selectedItem.item.budget)}</span>
                                {selectedItem.type === 'event' && <span>{formatEventTime(selectedItem.item.event_time)}</span>}
                            </div>
                            {(selectedItem.item.tags?.length ?? 0) > 0 && (
                                <div className="explore-card__tags">
                                    {selectedItem.item.tags?.map((tag) => (
                                        <span key={tag.id}>#{tag.name}</span>
                                    ))}
                                </div>
                            )}
                            <div className="explore-detail__actions">
                                {selectedItem.type === 'event' ? (
                                    <button
                                        type="button"
                                        className="explore-detail__primary"
                                        onClick={() => {
                                            onSelectEvent(selectedItem.item.id)
                                            onClose()
                                        }}
                                    >
                                        Open full event details
                                    </button>
                                ) : (
                                    <>
                                        <button
                                            type="button"
                                            className="explore-detail__primary"
                                            onClick={() => {
                                                onSelectPlan([selectedItem.item.lat, selectedItem.item.lng])
                                                onClose()
                                            }}
                                        >
                                            Center on map
                                        </button>
                                        <button
                                            type="button"
                                            className="explore-detail__secondary"
                                            onClick={() => {
                                                const result = onSavePlan(selectedItem.item)
                                                setSaveMessage(result.message)
                                            }}
                                            disabled={!isLoggedIn || savedPlanIds.has(selectedItem.item.id)}
                                        >
                                            {!isLoggedIn
                                                ? 'Log in to save'
                                                : savedPlanIds.has(selectedItem.item.id)
                                                    ? 'Plan saved'
                                                    : 'Save plan'}
                                        </button>
                                    </>
                                )}
                            </div>
                            {saveMessage && <div className="explore-detail__message">{saveMessage}</div>}
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="explore-panel__controls">
                            <label className="explore-panel__search">
                                <span>Search</span>
                                <input
                                    type="search"
                                    value={query}
                                    onChange={(event) => setQuery(event.target.value)}
                                    placeholder="Search by name, tag, or description"
                                />
                            </label>
                            <div className="explore-panel__segmented" aria-label="Type filter">
                                {(['all', 'events', 'plans'] as const).map((value) => (
                                    <button
                                        key={value}
                                        type="button"
                                        className={typeFilter === value ? 'explore-panel__segment explore-panel__segment--active' : 'explore-panel__segment'}
                                        onClick={() => setTypeFilter(value)}
                                    >
                                        {value === 'all' ? 'All' : value === 'events' ? 'Events' : 'Plans'}
                                    </button>
                                ))}
                            </div>
                            <label className="explore-panel__radius">
                                <span>Radius</span>
                                <input
                                    type="number"
                                    min={1}
                                    max={100}
                                    value={radiusKm}
                                    onChange={(event) => setRadiusKm(Number(event.target.value) || 10)}
                                />
                                <span>km</span>
                            </label>
                        </div>

                        {activeTags.length > 0 && (
                            <div className="explore-panel__active-tags">
                                <span>Using filters:</span>
                                {activeTags.map((tag) => (
                                    <strong key={tag.id}>#{tag.name}</strong>
                                ))}
                            </div>
                        )}

                        <div className="explore-panel__summary">
                            {results.length} result{results.length === 1 ? '' : 's'} within {radiusKm}km
                        </div>

                        <div className="explore-panel__list">
                            {results.length === 0 && (
                                <div className="explore-panel__empty">
                                    No matching events or plans found in this radius.
                                </div>
                            )}
                            {results.map((result) => {
                                const { visibleTags, hiddenCount } = getVisibleTags(result.item.tags)
                                return (
                                    <button
                                        key={`${result.type}-${result.item.id}`}
                                    type="button"
                                    className="explore-card"
                                    onClick={() => {
                                        setSaveMessage('')
                                        setSelectedItem(result)
                                    }}
                                >
                                        <div className="explore-card__topline">
                                            <span className={`explore-card__badge explore-card__badge--${result.type}`}>
                                                <span className="explore-card__icon" aria-hidden="true">
                                                    {getCategoryIcon(result.item.tags, result.type)}
                                                </span>
                                                {result.type === 'event' ? 'Event' : 'Plan'}
                                            </span>
                                            <span className="explore-card__distance">{result.distanceKm.toFixed(1)}km away</span>
                                        </div>
                                        <h3>{result.item.name}</h3>
                                        <div className="explore-card__meta">
                                            <span>{formatBudget(result.item.budget)}</span>
                                            {result.type === 'event' && <span>{formatEventTime(result.item.event_time)}</span>}
                                        </div>
                                        {visibleTags.length > 0 && (
                                            <div className="explore-card__tags">
                                                {visibleTags.map((tag) => (
                                                    <span key={tag.id}>#{tag.name}</span>
                                                ))}
                                                {hiddenCount > 0 && <span className="explore-card__tag-more">+{hiddenCount} more</span>}
                                            </div>
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                    </>
                )}
            </section>
        </div>
    )
}
