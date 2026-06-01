import type { ApiEvent, Tag } from './api'
import { getCategoryIcon, getVisibleTags } from './categoryIcons'
import type { SavedContentState, SavedPlan, SavedRoute, SavedRouteStop } from './savedContent'

type SavedContentPanelProps = {
    savedContent: SavedContentState
    events: ApiEvent[]
    onClose: () => void
    onOpenEventDetails: (eventId: string) => void
    onCenterOnMap: (position: [number, number]) => void
    onRemovePlan: (planId: string) => void
    onRemoveRoute: (routeId: string) => void
}

function formatBudget(budget: number | null) {
    return budget === null ? 'Budget unknown' : `€${budget.toFixed(2)}`
}

function formatSavedDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    })
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

function Tags({ tags }: { tags: Tag[] }) {
    const { visibleTags, hiddenCount } = getVisibleTags(tags, 3)
    if (visibleTags.length === 0) return null

    return (
        <div className="saved-card__tags">
            {visibleTags.map((tag) => (
                <span key={tag.id}>#{tag.name}</span>
            ))}
            {hiddenCount > 0 && <span>+{hiddenCount} more</span>}
        </div>
    )
}

function RouteStopRow({
    stop,
    eventExists,
    onOpenEventDetails,
    onCenterOnMap,
}: {
    stop: SavedRouteStop
    eventExists: boolean
    onOpenEventDetails: (eventId: string) => void
    onCenterOnMap: (position: [number, number]) => void
}) {
    return (
        <li className="saved-route-stop">
            <div className="saved-route-stop__number">{stop.stopNumber}</div>
            <div className="saved-route-stop__body">
                <div className="saved-route-stop__topline">
                    <span className={`explore-card__badge explore-card__badge--${stop.type}`}>
                        <span className="explore-card__icon" aria-hidden="true">{getCategoryIcon(stop.tags, stop.type)}</span>
                        {stop.type}
                    </span>
                    {stop.eventTime && <span className="saved-card__meta">{formatEventTime(stop.eventTime)}</span>}
                </div>
                <strong>{stop.name}</strong>
                <div className="saved-card__meta">{formatBudget(stop.budget)}</div>
                <Tags tags={stop.tags} />
                <div className="saved-card__actions">
                    {stop.type === 'event' && (
                        <button
                            type="button"
                            className="saved-card__button"
                            onClick={() => onOpenEventDetails(stop.id)}
                            disabled={!eventExists}
                        >
                            {eventExists ? 'Open full event details' : 'Event unavailable'}
                        </button>
                    )}
                    <button
                        type="button"
                        className="saved-card__button saved-card__button--secondary"
                        onClick={() => onCenterOnMap([stop.lat, stop.lng])}
                    >
                        Center on map
                    </button>
                </div>
            </div>
        </li>
    )
}

function SavedRouteCard({
    route,
    events,
    onOpenEventDetails,
    onCenterOnMap,
    onRemoveRoute,
}: {
    route: SavedRoute
    events: ApiEvent[]
    onOpenEventDetails: (eventId: string) => void
    onCenterOnMap: (position: [number, number]) => void
    onRemoveRoute: (routeId: string) => void
}) {
    const eventIds = new Set(events.map((event) => event.id))

    return (
        <article className="saved-card">
            <div className="saved-card__header">
                <div>
                    <h3>{route.title}</h3>
                    <span className="saved-card__meta">Saved {formatSavedDate(route.savedAt)}</span>
                </div>
                <button type="button" className="saved-card__remove" onClick={() => onRemoveRoute(route.id)}>
                    Remove
                </button>
            </div>
            <div className="saved-card__metrics">
                <span>{route.summary.stops} stops</span>
                <span>€{route.summary.knownBudget.toFixed(2)}{route.summary.hasUnknownBudget ? ' known' : ''}</span>
                <span>{route.summary.totalDistance.toFixed(1)}km</span>
            </div>
            <ol className="saved-route-stops">
                {route.stops.map((stop) => (
                    <RouteStopRow
                        key={`${route.id}-${stop.type}-${stop.id}`}
                        stop={stop}
                        eventExists={stop.type !== 'event' || eventIds.has(stop.id)}
                        onOpenEventDetails={onOpenEventDetails}
                        onCenterOnMap={onCenterOnMap}
                    />
                ))}
            </ol>
        </article>
    )
}

function SavedPlanCard({
    plan,
    onCenterOnMap,
    onRemovePlan,
}: {
    plan: SavedPlan
    onCenterOnMap: (position: [number, number]) => void
    onRemovePlan: (planId: string) => void
}) {
    return (
        <article className="saved-card saved-card--plan">
            <div className="saved-card__header">
                <div>
                    <h3>{plan.name}</h3>
                    <span className="saved-card__meta">Saved {formatSavedDate(plan.savedAt)}</span>
                </div>
                <button type="button" className="saved-card__remove" onClick={() => onRemovePlan(plan.id)}>
                    Remove
                </button>
            </div>
            {plan.description && <p>{plan.description}</p>}
            <div className="saved-card__metrics">
                <span>{formatBudget(plan.budget)}</span>
            </div>
            <Tags tags={plan.tags} />
            <div className="saved-card__actions">
                <button
                    type="button"
                    className="saved-card__button saved-card__button--secondary"
                    onClick={() => onCenterOnMap([plan.lat, plan.lng])}
                >
                    Center on map
                </button>
            </div>
        </article>
    )
}

export default function SavedContentPanel({
    savedContent,
    events,
    onClose,
    onOpenEventDetails,
    onCenterOnMap,
    onRemovePlan,
    onRemoveRoute,
}: SavedContentPanelProps) {
    const empty = savedContent.routes.length === 0 && savedContent.plans.length === 0

    return (
        <div className="saved-backdrop" onClick={onClose}>
            <section className="saved-panel" aria-label="Saved content" onClick={(event) => event.stopPropagation()}>
                <div className="saved-panel__header">
                    <div>
                        <span className="saved-panel__eyebrow">Your library</span>
                        <h2>Saved content</h2>
                        <p>Routes and plans saved on this browser for your account.</p>
                    </div>
                    <button type="button" className="explore-panel__close" onClick={onClose} aria-label="Close saved content">
                        x
                    </button>
                </div>

                <div className="saved-panel__body">
                    {empty && (
                        <div className="saved-panel__empty">
                            Nothing saved yet. Save a route from Planner or a plan from Explore.
                        </div>
                    )}

                    {savedContent.routes.length > 0 && (
                        <section className="saved-section">
                            <h3>Saved Routes</h3>
                            <div className="saved-section__list">
                                {savedContent.routes.map((route) => (
                                    <SavedRouteCard
                                        key={route.id}
                                        route={route}
                                        events={events}
                                        onOpenEventDetails={onOpenEventDetails}
                                        onCenterOnMap={onCenterOnMap}
                                        onRemoveRoute={onRemoveRoute}
                                    />
                                ))}
                            </div>
                        </section>
                    )}

                    {savedContent.plans.length > 0 && (
                        <section className="saved-section">
                            <h3>Saved Plans</h3>
                            <div className="saved-section__list">
                                {savedContent.plans.map((plan) => (
                                    <SavedPlanCard
                                        key={plan.id}
                                        plan={plan}
                                        onCenterOnMap={onCenterOnMap}
                                        onRemovePlan={onRemovePlan}
                                    />
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            </section>
        </div>
    )
}
