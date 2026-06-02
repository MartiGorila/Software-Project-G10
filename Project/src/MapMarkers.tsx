import L from 'leaflet'
import { Marker, Popup, useMap, useMapEvents } from 'react-leaflet'
import { useEffect } from 'react'
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

function ClickHandler({ onClick }: { onClick: (pos: [number, number]) => void }) {
    useMapEvents({ click(e) { onClick([e.latlng.lat, e.latlng.lng]) } })
    return null
}

function FocusMap({ position }: { position: [number, number] | null }) {
    const map = useMap()

    useEffect(() => {
        if (position) {
            map.panTo(position)
        }
    }, [map, position])

    return null
}

// function formatTime(iso: string) {
//     return new Date(iso).toLocaleString('en-GB', {
//         weekday: 'short', day: 'numeric', month: 'short',
//         hour: '2-digit', minute: '2-digit',
//     })
// }

function formatBudget(budget: number | null) {
    return budget != null ? `€${budget.toFixed(2)}` : null
}

function formatVisibility(visibility: ApiPlan['visibility']) {
    if (visibility === 'friends') return 'Friends only'
    if (visibility === 'private') return 'Private'
    return 'Public'
}

function userProfileButton(
    userId: string | undefined,
    username: string | undefined,
    onViewUserProfile: (userId: string) => void,
) {
    if (!userId || !username) return null

    return (
        <button
            type="button"
            className="subscriber-name-btn"
            onClick={() => onViewUserProfile(userId)}
        >
            {username}
        </button>
    )
}

type Props = {
    events: ApiEvent[]
    plans: ApiPlan[]
    currentUserId: string | null
    isLoggedIn: boolean
    savedPlanIds: Set<string>
    onDeletePlan: (planId: string) => void
    onSavePlan: (plan: ApiPlan) => { saved: boolean; message: string }
    onViewUserProfile: (userId: string) => void
    onMapClick: (pos: [number, number]) => void
    clickPosition: [number, number] | null
    onCloseClick: () => void
    onEventSelect?: (eventId: string) => void
    focusPosition?: [number, number] | null
}

export default function MapMarkers({
    events,
    plans,
    currentUserId,
    isLoggedIn,
    savedPlanIds,
    onDeletePlan,
    onSavePlan,
    onViewUserProfile,
    onMapClick,
    clickPosition,
    onCloseClick,
    onEventSelect,
    focusPosition,
}: Props) {
    return (
        <>
            <FocusMap position={focusPosition ?? null} />
            {events.map((event) => {
                const isOwn = event.creator_id === currentUserId




                return (
                    <Marker
                        key={`event-${event.id}`}
                        position={[event.lat, event.lng]}
                        icon={isOwn ? ownEventIcon : eventIcon}
                        eventHandlers={onEventSelect ? { click: () => onEventSelect(event.id) } : undefined}
                    />
                )
            })}

            {plans.map((plan) => {
                const isOwn = plan.creator_id === currentUserId
                const tags = plan.tags ?? []
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
                                        {userProfileButton(plan.creator_id, plan.creator?.username, onViewUserProfile) ?? 'Unknown'}
                                    </span>
                                    {plan.budget != null && <span>💰 {formatBudget(plan.budget)}</span>}
                                    <span>{formatVisibility(plan.visibility)}</span>
                                </div>
                                {tags.length > 0 && (
                                    <div className="marker-popup__tags">
                                        {tags.map((tag) => (
                                            <span key={tag.id} className="marker-popup__tag">#{tag.name}</span>
                                        ))}
                                    </div>
                                )}
                                {plan.description && (
                                    <div className="marker-popup__desc">{plan.description}</div>
                                )}
                                <div className="marker-popup__actions">
                                    <button
                                        className="marker-popup__btn marker-popup__btn--save"
                                        onClick={() => onSavePlan(plan)}
                                        disabled={!isLoggedIn || savedPlanIds.has(plan.id)}
                                    >
                                        {!isLoggedIn ? 'Log in to save' : savedPlanIds.has(plan.id) ? 'Saved' : 'Save plan'}
                                    </button>
                                    {isOwn && (
                                        <button
                                            className="marker-popup__btn marker-popup__btn--danger"
                                            onClick={() => onDeletePlan(plan.id)}
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

            {clickPosition && (
                <>
                    <Marker position={clickPosition} />
                    <Popup position={clickPosition} eventHandlers={{ remove: onCloseClick }}>
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
