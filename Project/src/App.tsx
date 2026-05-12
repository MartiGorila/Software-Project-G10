import L from 'leaflet'
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import './App.css'

// Fix for default markers in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})
import { FormEvent, useEffect, useState } from 'react'
import EventMarkers from './EventMarkers'
import SubscriptionPanel from './SubscriptionPanel'
import {
    loginWithUsername,
    logout,
    fetchUsers,
    fetchEvents,
    createEvent,
    deleteEvent,
    joinEvent,
    leaveEvent,
    setAuthToken,
    getAuthToken,
} from './api'
import { MarkerData, User, NewMarkerData } from './types'

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

function App() {
    const [markers, setMarkers] = useState<MarkerData[]>([])
    const [users, setUsers] = useState<User[]>([])
    const [currentUserId, setCurrentUserId] = useState<string | null>(null)
    const [currentUser, setCurrentUser] = useState<User | null>(null)
    const [clickPosition, setClickPosition] = useState<[number, number] | null>(null)
    const [editing, setEditing] = useState(false)
    const [formData, setFormData] = useState({ name: '', hour: '', description: '' })
    const [showLoginForm, setShowLoginForm] = useState(false)
    const [loginForm, setLoginForm] = useState({ username: '', password: '' })
    const [loginError, setLoginError] = useState('')
    const [isLoading, setIsLoading] = useState(true)

    // Load data from API on mount
    useEffect(() => {
        const loadData = async () => {
            try {
                setIsLoading(true)
                console.log('Loading data from API...')
                const [fetchedUsers, fetchedEvents] = await Promise.all([
                    fetchUsers(),
                    fetchEvents(),
                ])
                console.log('Fetched users:', fetchedUsers)
                console.log('Fetched events:', fetchedEvents)
                setUsers(fetchedUsers)
                setMarkers(fetchedEvents)
                console.log('Data loaded successfully')
            } catch (error) {
                console.error('Error loading data:', error)
            } finally {
                setIsLoading(false)
            }
        }

        loadData()
    }, [])

    const handleSaveMarker = async (marker: NewMarkerData) => {
        if (!currentUserId) return
        try {
            const eventData = {
                name: marker.name,
                description: marker.description,
                lat: marker.position[0],
                lng: marker.position[1],
                event_time: new Date().toISOString(),
            }
            const newEvent = await createEvent(eventData)
            setMarkers((current) => [...current, newEvent])
            setClickPosition(null)
            setEditing(false)
            setFormData({ name: '', hour: '', description: '' })
        } catch (error) {
            console.error('Error creating event:', error)
            setLoginError('Failed to create event')
        }
    }

    const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        try {
            setLoginError('')
            const response = await loginWithUsername(loginForm.username.trim(), loginForm.password)
            setCurrentUserId(response.user.id)
            setCurrentUser({
                ...response.user,
                subscriptions: [] // Initialize with empty subscriptions
            })
            setShowLoginForm(false)
            setLoginForm({ username: '', password: '' })
        } catch (error) {
            console.error('Login error:', error)
            setLoginError('Invalid username or password.')
        }
    }

    const handleLogout = () => {
        logout()
        setCurrentUserId(null)
        setCurrentUser(null)
        setShowLoginForm(false)
        setLoginError('')
    }

    const handleToggleLogin = () => {
        if (currentUserId) {
            handleLogout()
            return
        }
        setShowLoginForm((visible) => !visible)
        setLoginError('')
    }

    const handleSubscribe = async (markerId: string) => {
        if (!currentUserId) return
        try {
            await joinEvent(markerId)
            if (currentUser) {
                setCurrentUser({
                    ...currentUser,
                    subscriptions: [...(currentUser.subscriptions || []), markerId],
                })
            }
        } catch (error) {
            console.error('Error subscribing:', error)
        }
    }

    const handleDeleteMarker = async (markerId: string) => {
        if (!currentUserId) return
        const marker = markers.find(m => m.id === markerId)
        if (!marker || marker.creatorId !== currentUserId) return

        try {
            await deleteEvent(markerId)
            setMarkers((current) => current.filter(m => m.id !== markerId))
        } catch (error) {
            console.error('Error deleting event:', error)
            setLoginError('Failed to delete event')
        }
    }

    const handleUnsubscribe = async (markerId: string) => {
        if (!currentUserId) return
        try {
            await leaveEvent(markerId)
            if (currentUser) {
                setCurrentUser({
                    ...currentUser,
                    subscriptions: (currentUser.subscriptions || []).filter((id) => id !== markerId),
                })
            }
        } catch (error) {
            console.error('Error unsubscribing:', error)
        }
    }
    const currentUserData = currentUser ?? null
    const subscribedMarkers = markers.filter((marker) => currentUserData?.subscriptions?.includes(marker.id))
    const orderedSubscribedMarkers = [...subscribedMarkers].sort(
        (a, b) => parseHour(a.hour) - parseHour(b.hour),
    )
    const subscriptionPath = orderedSubscribedMarkers.map((marker) => marker.position)
    const subscribersByEvent = markers.reduce<Record<string, string[]>>((map, marker) => {
        map[marker.id] = []
        return map
    }, {})

    users.forEach((user) => {
        // Only process users that have subscriptions
        if (user.subscriptions) {
            user.subscriptions.forEach((markerId) => {
                if (!subscribersByEvent[markerId]) {
                    subscribersByEvent[markerId] = []
                }
                if (!subscribersByEvent[markerId].includes(user.username)) {
                    subscribersByEvent[markerId].push(user.username)
                }
            })
        }
    })

    return (
        <div className="map-shell">
            {isLoading ? (
                <div style={{
                    position: 'fixed',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    fontSize: '24px',
                    color: 'white',
                    background: 'rgba(0,0,0,0.8)',
                    padding: '20px',
                    borderRadius: '10px',
                    zIndex: 1000
                }}>
                    Loading data from API...
                </div>
            ) : markers.length === 0 ? (
                <div style={{
                    position: 'fixed',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    fontSize: '24px',
                    color: 'white',
                    background: 'rgba(0,0,0,0.8)',
                    padding: '20px',
                    borderRadius: '10px',
                    zIndex: 1000,
                    textAlign: 'center'
                }}>
                    <div>No events found in database.</div>
                    <div style={{ fontSize: '16px', marginTop: '10px' }}>
                        Check that your backend is running and has events in the database.
                    </div>
                    <div style={{ fontSize: '14px', marginTop: '10px', color: '#ccc' }}>
                        Markers loaded: {markers.length} | Users loaded: {users.length}
                    </div>
                </div>
            ) : (
                <MapContainer className="leaflet-container" center={barcelonaCenter} zoom={14} style={{ height: '100%', width: '100%' }}>
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
                        subscribedIds={currentUserData?.subscriptions ?? []}
                        subscribersByEvent={subscribersByEvent}
                        canSubscribe={!!currentUserData}
                        currentUserId={currentUserId}
                        onSubscribe={handleSubscribe}
                        onDeleteMarker={handleDeleteMarker}
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
            )}

            <div className="sidebar-overlay">
                <div className="login-panel">
                    <button type="button" className="login-button" onClick={handleToggleLogin}>
                        {currentUserData ? 'Logout' : 'Login'}
                    </button>
                    {currentUserData ? (
                        <div className="login-info">Logged in as <strong>{currentUserData.username}</strong></div>
                    ) : null}
                    {!currentUserData && showLoginForm ? (
                        <form className="login-form" onSubmit={handleLogin}>
                            <div className="login-field">
                                <label htmlFor="login-username">Username</label>
                                <input
                                    id="login-username"
                                    className="popup-input"
                                    value={loginForm.username}
                                    onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
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
                    ) : null}
                    {loginError ? <div className="login-error">{loginError}</div> : null}
                </div>

                <SubscriptionPanel
                    subscribedMarkers={orderedSubscribedMarkers}
                    onRemoveSubscription={handleUnsubscribe}
                    currentUser={currentUserData}
                />
            </div>
        </div>
    )
}

export default App