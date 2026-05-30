import L from 'leaflet'
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import './App.css'
import { FormEvent, useEffect, useState } from 'react'
import EventMarkers from './EventMarkers'
import ProfileModal from './ProfileModal'
import PublicProfileModal from './PublicProfileModal'
import SubscriptionPanel from './SubscriptionPanel'
import {
    createEvent,
    deleteEvent,
    getAuthToken,
    getCurrentUser,
    getEvents,
    joinEvent,
    leaveEvent,
    login,
    logout as apiLogout,
    register,
} from './api'
import { ApiEvent, AuthUser, MarkerData, NewMarkerData, OwnProfile } from './types'

const barcelonaCenter: [number, number] = [41.3851, 2.1734]

const parseHour = (hour: string) => {
    const [h, m] = hour.split(':').map(Number)
    return Number.isFinite(h) ? h * 60 + (Number.isFinite(m) ? m : 0) : Infinity
}

const getBearing = (start: [number, number], end: [number, number]) => {
    const [lat1, lon1] = start.map((value) => (value * Math.PI) / 180)
    const [lat2, lon2] = end.map((value) => (value * Math.PI) / 180)
    const dLon = lon2 - lon1
    const y = Math.sin(dLon) * Math.cos(lat2)
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
    return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

const createArrowIcon = (rotation: number) =>
    new L.DivIcon({
        className: 'subscription-arrow-icon',
        html: `<div style="transform: rotate(${rotation - 90}deg); transform-origin: center center; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 16px; line-height: 1;">➤</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
    })

const formatEventHour = (eventTime: string) =>
    new Date(eventTime).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    })

const toMarkerData = (event: ApiEvent): MarkerData => ({
    id: event.id,
    position: [event.lat, event.lng],
    name: event.name,
    hour: formatEventHour(event.event_time),
    description: event.description ?? '',
    creatorId: event.creator_id,
})

const buildEventTime = (hour: string) => {
    const date = new Date()
    const [hours, minutes] = hour.split(':').map(Number)

    if (Number.isFinite(hours) && Number.isFinite(minutes)) {
        date.setHours(hours, minutes, 0, 0)
    }

    return date.toISOString()
}

function App() {
    const [apiEvents, setApiEvents] = useState<ApiEvent[]>([])
    const [markers, setMarkers] = useState<MarkerData[]>([])
    const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)
    const [clickPosition, setClickPosition] = useState<[number, number] | null>(null)
    const [editing, setEditing] = useState(false)
    const [formData, setFormData] = useState({ name: '', hour: '', description: '' })
    const [showLoginForm, setShowLoginForm] = useState(false)
    const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
    const [loginForm, setLoginForm] = useState({ email: '', password: '' })
    const [registerForm, setRegisterForm] = useState({ username: '', email: '', password: '' })
    const [loginError, setLoginError] = useState('')
    const [isLoading, setIsLoading] = useState(true)
    const [showOwnProfile, setShowOwnProfile] = useState(false)
    const [viewingUserId, setViewingUserId] = useState<string | null>(null)

    const refreshEvents = async () => {
        const events = await getEvents()
        setApiEvents(events)
        setMarkers(events.map(toMarkerData))
    }

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                setIsLoading(true)
                await refreshEvents()

                if (getAuthToken()) {
                    try {
                        const user = await getCurrentUser()
                        setCurrentUser(user)
                    } catch {
                        apiLogout()
                        setCurrentUser(null)
                    }
                }
            } catch (error) {
                setLoginError(error instanceof Error ? error.message : 'Failed to load events.')
            } finally {
                setIsLoading(false)
            }
        }

        loadInitialData()
    }, [])

    const handleSaveMarker = async (marker: NewMarkerData) => {
        if (!currentUser) return

        try {
            await createEvent({
                name: marker.name,
                description: marker.description,
                lat: marker.position[0],
                lng: marker.position[1],
                event_time: buildEventTime(marker.hour),
            })
            await refreshEvents()
            setClickPosition(null)
            setEditing(false)
            setFormData({ name: '', hour: '', description: '' })
            setLoginError('')
        } catch (error) {
            setLoginError(error instanceof Error ? error.message : 'Failed to create event.')
        }
    }

    const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        try {
            const data = await login(loginForm.email.trim(), loginForm.password)
            setCurrentUser(data.user)
            setShowLoginForm(false)
            setLoginError('')
            setLoginForm({ email: '', password: '' })
        } catch (error) {
            setLoginError(error instanceof Error ? error.message : 'Login failed.')
        }
    }

    const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        try {
            const data = await register(
                registerForm.username.trim(),
                registerForm.email.trim(),
                registerForm.password,
            )
            setCurrentUser(data.user)
            setShowLoginForm(false)
            setLoginError('')
            setRegisterForm({ username: '', email: '', password: '' })
            setAuthMode('login')
        } catch (error) {
            setLoginError(error instanceof Error ? error.message : 'Registration failed.')
        }
    }

    const handleLogout = () => {
        apiLogout()
        setCurrentUser(null)
        setShowLoginForm(false)
        setLoginError('')
        setShowOwnProfile(false)
        setViewingUserId(null)
    }

    const handleToggleLogin = () => {
        if (currentUser) {
            handleLogout()
            return
        }
        setShowLoginForm((visible) => !visible)
        setLoginError('')
    }

    const handleSubscribe = async (markerId: string) => {
        if (!currentUser) return

        try {
            await joinEvent(markerId)
            await refreshEvents()
            setLoginError('')
        } catch (error) {
            setLoginError(error instanceof Error ? error.message : 'Failed to subscribe.')
        }
    }

    const handleDeleteMarker = async (markerId: string) => {
        if (!currentUser) return
        const marker = markers.find(m => m.id === markerId)
        if (!marker || marker.creatorId !== currentUser.id) return

        try {
            await deleteEvent(markerId)
            await refreshEvents()
            setLoginError('')
        } catch (error) {
            setLoginError(error instanceof Error ? error.message : 'Failed to delete event.')
        }
    }

    const handleUnsubscribe = async (markerId: string) => {
        if (!currentUser) return

        try {
            await leaveEvent(markerId)
            await refreshEvents()
            setLoginError('')
        } catch (error) {
            setLoginError(error instanceof Error ? error.message : 'Failed to unsubscribe.')
        }
    }

    const handleProfileUpdated = async (profile: OwnProfile) => {
        setCurrentUser(profile)
        try {
            await refreshEvents()
        } catch (error) {
            setLoginError(error instanceof Error ? error.message : 'Failed to refresh events.')
        }
    }

    const subscribedIds = currentUser
        ? apiEvents
            .filter((event) =>
                event.event_participants?.some((participant) => participant.user_id === currentUser.id),
            )
            .map((event) => event.id)
        : []
    const subscribedMarkers = markers.filter((marker) => subscribedIds.includes(marker.id))
    const orderedSubscribedMarkers = [...subscribedMarkers].sort(
        (a, b) => parseHour(a.hour) - parseHour(b.hour),
    )
    const subscriptionPath = orderedSubscribedMarkers.map((marker) => marker.position)
    const subscribersByEvent = apiEvents.reduce<Record<string, { username: string; userId: string }[]>>((map, event) => {
        map[event.id] = event.event_participants
            ?.filter((participant) => Boolean(participant.user_id))
            .map((participant) => ({
                userId: participant.user_id,
                username: participant.user?.username ?? 'Unknown user',
            })) ?? []
        return map
    }, {})

    return (
        <div className="map-shell">
            <MapContainer className="leaflet-container" center={barcelonaCenter} zoom={14} style={{ height: '100vh', width: '100vw' }}>
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />

                <Marker position={barcelonaCenter}>
                    <Popup>
                        Barcelona center: Plaça de Catalunya.
                    </Popup>
                </Marker>

                <EventMarkers
                    markers={markers}
                    subscribedIds={subscribedIds}
                    subscribersByEvent={subscribersByEvent}
                    canSubscribe={!!currentUser}
                    currentUserId={currentUser?.id ?? null}
                    onSubscribe={handleSubscribe}
                    onDeleteMarker={handleDeleteMarker}
                    onViewUserProfile={setViewingUserId}
                    clickPosition={clickPosition}
                    editing={editing}
                    setEditing={setEditing}
                    formData={formData}
                    setFormData={setFormData}
                    onClickLocation={setClickPosition}
                    onSaveMarker={handleSaveMarker}
                />

                {orderedSubscribedMarkers.length > 1 && (
                    <>
                        <Polyline
                            positions={subscriptionPath}
                            pathOptions={{ color: '#1d4ed8', weight: 4, opacity: 0.8, dashArray: '10,8' }}
                        />
                        {orderedSubscribedMarkers.slice(0, -1).map((marker, index) => {
                            const next = orderedSubscribedMarkers[index + 1]
                            const midpoint: [number, number] = [
                                (marker.position[0] + next.position[0]) / 2,
                                (marker.position[1] + next.position[1]) / 2,
                            ]
                            return (
                                <Marker
                                    key={`${marker.id}-arrow`}
                                    position={midpoint}
                                    icon={createArrowIcon(getBearing(marker.position, next.position))}
                                    interactive={false}
                                />
                            )
                        })}
                    </>
                )}
            </MapContainer>

            <div className="sidebar-overlay">
                <div className="login-panel">
                    <button type="button" className="login-button" onClick={handleToggleLogin}>
                        {currentUser ? 'Logout' : 'Login'}
                    </button>
                    {currentUser ? (
                        <div className="login-info">Logged in as <strong>{currentUser.username}</strong></div>
                    ) : null}
                    {!currentUser && showLoginForm ? (
                        <div>
                            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                <button
                                    type="button"
                                    className="popup-button"
                                    onClick={() => {
                                        setAuthMode('login')
                                        setLoginError('')
                                    }}
                                    disabled={authMode === 'login'}
                                >
                                    Login
                                </button>
                                <button
                                    type="button"
                                    className="popup-button"
                                    onClick={() => {
                                        setAuthMode('register')
                                        setLoginError('')
                                    }}
                                    disabled={authMode === 'register'}
                                >
                                    Register
                                </button>
                            </div>
                            {authMode === 'login' ? (
                                <form className="login-form" onSubmit={handleLogin}>
                                    <div className="login-field">
                                        <label htmlFor="login-email">Email</label>
                                        <input
                                            id="login-email"
                                            className="popup-input"
                                            type="email"
                                            value={loginForm.email}
                                            onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                                        />
                                    </div>
                                    <div className="login-field">
                                        <label htmlFor="login-password">Password</label>
                                        <input
                                            id="login-password"
                                            className="popup-input"
                                            type="password"
                                            value={loginForm.password}
                                            onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                                        />
                                    </div>
                                    <button type="submit" className="popup-submit">Sign in</button>
                                </form>
                            ) : (
                                <form className="login-form" onSubmit={handleRegister}>
                                    <div className="login-field">
                                        <label htmlFor="register-username">Username</label>
                                        <input
                                            id="register-username"
                                            className="popup-input"
                                            value={registerForm.username}
                                            onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })}
                                        />
                                    </div>
                                    <div className="login-field">
                                        <label htmlFor="register-email">Email</label>
                                        <input
                                            id="register-email"
                                            className="popup-input"
                                            type="email"
                                            value={registerForm.email}
                                            onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                                        />
                                    </div>
                                    <div className="login-field">
                                        <label htmlFor="register-password">Password</label>
                                        <input
                                            id="register-password"
                                            className="popup-input"
                                            type="password"
                                            value={registerForm.password}
                                            onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                                        />
                                    </div>
                                    <button type="submit" className="popup-submit">Register</button>
                                </form>
                            )}
                        </div>
                    ) : null}
                    {isLoading ? <div className="login-info">Loading events...</div> : null}
                    {loginError ? <div className="login-error">{loginError}</div> : null}
                </div>

                <SubscriptionPanel
                    subscribedMarkers={orderedSubscribedMarkers}
                    onRemoveSubscription={handleUnsubscribe}
                    currentUser={currentUser}
                    onOpenProfile={() => setShowOwnProfile(true)}
                />
            </div>
            {showOwnProfile && currentUser && (
                <ProfileModal
                    onClose={() => setShowOwnProfile(false)}
                    onProfileUpdated={handleProfileUpdated}
                />
            )}
            {viewingUserId && (
                <PublicProfileModal
                    userId={viewingUserId}
                    onClose={() => setViewingUserId(null)}
                />
            )}
        </div>
    )
}

export default App
