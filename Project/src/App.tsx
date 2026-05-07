import L from 'leaflet'
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import './App.css'
import { FormEvent, useEffect, useState } from 'react'
import EventMarkers from './EventMarkers'
import SubscriptionPanel from './SubscriptionPanel'
import { fetchUsers, fetchEvents, createEvent, deleteEventAPI, subscribeToEvent, unsubscribeFromEvent } from './api'
import { MarkerData, User, NewMarkerData } from './types'

const barcelonaCenter: [number, number] = [41.3851, 2.1734]

const parseHour = (hour: string) => {
    const [h, m] = hour.split(':').map(Number)
    return Number.isFinite(h) ? h * 60 + (Number.isFinite(m) ? m : 0) : Infinity
}
//hola
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
    const [clickPosition, setClickPosition] = useState<[number, number] | null>(null)
    const [editing, setEditing] = useState(false)
    const [formData, setFormData] = useState({ name: '', hour: '', description: '' })
    const [showLoginForm, setShowLoginForm] = useState(false)
    const [loginForm, setLoginForm] = useState({ username: '', password: '' })
    const [loginError, setLoginError] = useState('')

    // Cargar datos desde la API
    useEffect(() => {
        const loadData = async () => {
            const [fetchedUsers, fetchedEvents] = await Promise.all([fetchUsers(), fetchEvents()])
            setUsers(fetchedUsers)
            setMarkers(fetchedEvents)
        }
        loadData()
    }, [])

    const handleSaveMarker = async (marker: NewMarkerData) => {
        if (!currentUserId) return
        try {
            const newEvent = await createEvent({
                ...marker,
                creatorId: currentUserId,
            })
            setMarkers((current) => [...current, newEvent])
            setClickPosition(null)
            setEditing(false)
            setFormData({ name: '', hour: '', description: '' })
        } catch (error) {
            console.error('Error saving marker:', error)
        }
    }

    const handleLogin = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        const user = users.find((candidate) => candidate.username === loginForm.username.trim())
        if (!user || user.password !== loginForm.password) {
            setLoginError('Invalid username or password.')
            return
        }

        setCurrentUserId(user.id)
        setShowLoginForm(false)
        setLoginError('')
        setLoginForm({ username: '', password: '' })
    }

    const handleLogout = () => {
        setCurrentUserId(null)
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
            await subscribeToEvent(currentUserId, markerId)
            setUsers((current) =>
                current.map((user) =>
                    user.id === currentUserId && !user.subscriptions.includes(markerId)
                        ? { ...user, subscriptions: [...user.subscriptions, markerId] }
                        : user,
                ),
            )
        } catch (error) {
            console.error('Error subscribing:', error)
        }
    }

    const handleDeleteMarker = async (markerId: string) => {
        if (!currentUserId) return
        const marker = markers.find(m => m.id === markerId)
        if (!marker || marker.creatorId !== currentUserId) return

        try {
            await deleteEventAPI(markerId)
            // Remove the marker
            setMarkers((current) => current.filter(m => m.id !== markerId))

            // Remove subscriptions to this marker from all users
            setUsers((current) =>
                current.map((user) => ({
                    ...user,
                    subscriptions: user.subscriptions.filter((id) => id !== markerId),
                }))
            )
        } catch (error) {
            console.error('Error deleting marker:', error)
        }
    }

    const handleUnsubscribe = async (markerId: string) => {
        if (!currentUserId) return

        try {
            await unsubscribeFromEvent(currentUserId, markerId)
            setUsers((current) =>
                current.map((user) =>
                    user.id === currentUserId
                        ? { ...user, subscriptions: user.subscriptions.filter((id) => id !== markerId) }
                        : user,
                ),
            )
        } catch (error) {
            console.error('Error unsubscribing:', error)
        }
    }
    const currentUser = users.find((user) => user.id === currentUserId) ?? null
    const subscribedMarkers = markers.filter((marker) => currentUser?.subscriptions.includes(marker.id))
    const orderedSubscribedMarkers = [...subscribedMarkers].sort(
        (a, b) => parseHour(a.hour) - parseHour(b.hour),
    )
    const subscriptionPath = orderedSubscribedMarkers.map((marker) => marker.position)
    const subscribersByEvent = markers.reduce<Record<string, string[]>>((map, marker) => {
        map[marker.id] = []
        return map
    }, {})

    users.forEach((user) => {
        user.subscriptions.forEach((markerId) => {
            if (!subscribersByEvent[markerId]) {
                subscribersByEvent[markerId] = []
            }
            if (!subscribersByEvent[markerId].includes(user.username)) {
                subscribersByEvent[markerId].push(user.username)
            }
        })
    })

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
                    subscribedIds={currentUser?.subscriptions ?? []}
                    subscribersByEvent={subscribersByEvent}
                    canSubscribe={!!currentUser}
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

            <div className="sidebar-overlay">
                <div className="login-panel">
                    <button type="button" className="login-button" onClick={handleToggleLogin}>
                        {currentUser ? 'Logout' : 'Login'}
                    </button>
                    {currentUser ? (
                        <div className="login-info">Logged in as <strong>{currentUser.username}</strong></div>
                    ) : null}
                    {!currentUser && showLoginForm ? (
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
                    currentUser={currentUser}
                />
            </div>
        </div>
    )
}

export default App