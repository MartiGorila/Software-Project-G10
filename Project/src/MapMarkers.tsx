import L from 'leaflet'
import { Marker, Popup, useMapEvents } from 'react-leaflet'
import { ApiEvent, ApiPlan } from './api'

// ── Custom icons ──────────────────────────────────────────────────────────────

export const eventIcon = new L.DivIcon({
    className: '',
    html: `<div class="map-marker map-marker--event">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="3" y="4" width="18" height="18" rx="2" stroke="white" stroke-width="2"/>
            <path d="M3 9h18" stroke="white" stroke-width="2"/>
            <path d="M8 2v4M16 2v4" stroke="white" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <div class="map-marker__dot"></div>
    </div>`,
    iconSize: [36, 44],
    iconAnchor: [18, 44],
    popupAnchor: [0, -46],
})

export const planIcon = new L.DivIcon({
    className: '',
    html: `<div class="map-marker map-marker--plan">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 11l3 3L22 4" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke="white" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <div class="map-marker__dot"></div>
    </div>`,
    iconSize: [36, 44],
    iconAnchor: [18, 44],
    popupAnchor: [0, -46],
})

export const ownEventIcon = new L.DivIcon({
    className: '',
    html: `<div class="map-marker map-marker--own">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="3" y="4" width="18" height="18" rx="2" stroke="white" stroke-width="2"/>
            <path d="M3 9h18" stroke="white" stroke-width="2"/>
            <path d="M8 2v4M16 2v4" stroke="white" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <div class="map-marker__dot"></div>
    </div>`,
    iconSize: [36, 44],
    iconAnchor: [18, 44],
    popupAnchor: [0, -46],
})

export const ownPlanIcon = new L.DivIcon({
    className: '',
    html: `<div class="map-marker map-marker--own">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 11l3 3L22 4" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke="white" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <div class="map-marker__dot"></div>
    </div>`,
    iconSize: [36, 44],
    iconAnchor: [18, 44],
    popupAnchor: [0, -46],
})

// ── Click handler ─────────────────────────────────────────────────────────────

function ClickHandler({ onClick }: { onClick: (pos: [number, number]) => void }) {
    useMapEvents({
        click(e) { onClick([e.latlng.lat, e.latlng.lng]) },
    })
    return null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
    return new Date(iso).toLocaleString('en-GB', {
        weekday: 'short', day: 'numeric', month: 'short',
        hour: '2-digit', minute: '2-digit',
    })
}

function formatBudget(budget: number | null) {
    return budget != null ? `€${budget.toFixed(2)}` : null
}

// ── Props ─────────────────────────────────────────────────────────────────────

type Props = {
    events: ApiEvent[]
    plans: ApiPlan[]
    currentUserId: string | null
    isLoggedIn: boolean
    joinedEventIds: Set<string>
    onJoin: (eventId: string) => void
    onLeave: (eventId: string) => void
    onDeleteEvent: (eventId: string) => void
    onDeletePlan: (planId: string) => void
    onViewUserProfile: (userId: string) => void
    onMapClick: (pos: [number, number]) => void
    clickPosition: [number, number] | null
    onCloseClick: () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MapMarkers({
    events,
    plans,
    currentUserId,
    isLoggedIn,
    joinedEventIds,
    onJoin,
    onLeave,
    onDeleteEvent,
    onDeletePlan,
    onViewUserProfile,
    onMapClick,
    clickPosition,
    onCloseClick,
}: Props) {
    return (
        <>
            {/* Event markers */}
            {events.map((event) => {
                const isOwn = event.creator_id === currentUserId
                const joined = joinedEventIds.has(event.id)
                const participantCount = event.event_participants?.length ?? 0
                const isFull = event.capacity != null && participantCount >= event.capacity
                const subscribers = event.event_participants ?? []

                return (
                    <Marker
                        key={`event-${event.id}`}
                        position={[event.lat, event.lng]}
                        icon={isOwn ? ownEventIcon : eventIcon}
                    >
                        <Popup>
                            <div className="marker-popup">
                                <div className="marker-popup__badge marker-popup__badge--event">Event</div>
                                <div className="marker-popup__title">{event.name}</div>
                                <div className="marker-popup__meta">
                                    <span>🕐 {formatTime(event.event_time)}</span>
                                    <span>
                                        👤 by{' '}
                                        <button
                                            className="subscriber-name-btn"
                                            onClick={() => onViewUserProfile(event.creator_id)}
                                        >
                                            {event.creator.username}
                                        </button>
                                    </span>
                                    {event.capacity != null && (
                                        <span>👥 {participantCount}/{event.capacity} joined</span>
                                    )}
                                    {event.budget != null && (
                                        <span>💰 {formatBudget(event.budget)}</span>
                                    )}
                                </div>
                                {subscribers.length > 0 && (
                                    <div className="marker-popup__desc" style={{ fontSize: '0.8rem' }}>
                                        Joined:{' '}
                                        {subscribers.map((p, i) => (
                                            <span key={p.user_id}>
                                                <button
                                                    className="subscriber-name-btn"
                                                    onClick={() => onViewUserProfile(p.user_id)}
                                                >
                                                    {p.user?.username ?? 'Unknown'}
                                                </button>
                                                {i < subscribers.length - 1 ? ', ' : ''}
                                            </span>
                                        ))}
                                    </div>
                                )}
                                {event.description && (
                                    <div className="marker-popup__desc">{event.description}</div>
                                )}
                                <div className="marker-popup__actions">
                                    {isLoggedIn && !isOwn && (
                                        <button
                                            className={`marker-popup__btn ${joined ? 'marker-popup__btn--secondary' : ''}`}
                                            disabled={!joined && isFull}
                                            onClick={() => joined ? onLeave(event.id) : onJoin(event.id)}
                                        >
                                            {joined ? 'Leave event' : isFull ? 'Event full' : 'Join event'}
                                        </button>
                                    )}
                                    {!isLoggedIn && (
                                        <div className="marker-popup__hint">Log in to join this event</div>
                                    )}
                                    {isOwn && (
                                        <button
                                            className="marker-popup__btn marker-popup__btn--danger"
                                            onClick={() => onDeleteEvent(event.id)}
                                        >
                                            Delete
                                        </button>
                                    )}
                                </div>
                            </div>
                        </Popup>
                    </Marker>
                )
            })}

            {/* Plan markers */}
            {plans.map((plan) => {
                const isOwn = plan.creator_id === currentUserId
                return (
                    <Marker
                        key={`plan-${plan.id}`}
                        position={[plan.lat, plan.lng]}
                        icon={isOwn ? ownPlanIcon : planIcon}
                    >
                        <Popup>
                            <div className="marker-popup">
                                <div className="marker-popup__badge marker-popup__badge--plan">Plan</div>
                                <div className="marker-popup__title">{plan.name}</div>
                                <div className="marker-popup__meta">
                                    <span>
                                        👤 by{' '}
                                        <button
                                            className="subscriber-name-btn"
                                            onClick={() => onViewUserProfile(plan.creator_id)}
                                        >
                                            {plan.creator.username}
                                        </button>
                                    </span>
                                    {plan.budget != null && (
                                        <span>💰 {formatBudget(plan.budget)}</span>
                                    )}
                                </div>
                                {plan.description && (
                                    <div className="marker-popup__desc">{plan.description}</div>
                                )}
                                {isOwn && (
                                    <div className="marker-popup__actions">
                                        <button
                                            className="marker-popup__btn marker-popup__btn--danger"
                                            onClick={() => onDeletePlan(plan.id)}
                                        >
                                            Delete
                                        </button>
                                    </div>
                                )}
                            </div>
                        </Popup>
                    </Marker>
                )
            })}

            {/* Click position marker */}
            {clickPosition && (
                <>
                    <Marker position={clickPosition} />
                    <Popup position={clickPosition} onClose={onCloseClick}>
                        <div className="marker-popup">
                            <div className="marker-popup__title">New location</div>
                            <div className="marker-popup__hint">
                                {isLoggedIn
                                    ? 'Use the sidebar form to create an event or plan here.'
                                    : 'Log in to create events or plans.'}
                            </div>
                        </div>
                    </Popup>
                </>
            )}

            <ClickHandler onClick={onMapClick} />
        </>
    )
}