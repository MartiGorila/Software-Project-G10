import L from 'leaflet'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import './App.css'
import { FormEvent, useEffect, useState } from 'react'
import MapMarkers from './MapMarkers'
import CreatePanel from './CreatePanel'
import FilterPanel from './FilterPanel'
import ProfileModal from './ProfileModal'
import PublicProfileModal from './PublicProfileModal'
import SubscriptionPanel from './SubscriptionPanel'
import {
    getAuthToken,
    getCurrentUser,
    getEvents,
    getPlans,
    getTags,
    joinEvent,
    leaveEvent,
    deleteEvent,
    deletePlan,
    login,
    logout as apiLogout,
    register,
    ApiEvent,
    ApiPlan,
    AuthUser,
    Tag,
} from './api'

const barcelonaCenter: [number, number] = [41.3851, 2.1734]

// ── Filtering helpers ─────────────────────────────────────────────────────────

function matchesTags(itemTags: Tag[] | undefined, selectedIds: Set<number>): boolean {
    if (selectedIds.size === 0) return true
    const ids = (itemTags ?? []).map((t) => t.id)
    return [...selectedIds].every((id) => ids.includes(id))
}

function App() {
    const [events, setEvents] = useState<ApiEvent[]>([])
    const [plans, setPlans] = useState<ApiPlan[]>([])
    const [allTags, setAllTags] = useState<Tag[]>([])
    const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    const [joinedEventIds, setJoinedEventIds] = useState<Set<string>>(new Set())

    // ── Filter state ──────────────────────────────────────────────────────────
    const [selectedTagIds, setSelectedTagIds] = useState<Set<number>>(new Set())
    const [filterType, setFilterType] = useState<'all' | 'events' | 'plans'>('all')

    const [clickPosition, setClickPosition] = useState<[number, number] | null>(null)

    const [showLoginForm, setShowLoginForm] = useState(false)
    const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
    const [loginForm, setLoginForm] = useState({ email: '', password: '' })
    const [registerForm, setRegisterForm] = useState({ username: '', email: '', password: '' })
    const [loginError, setLoginError] = useState('')

    const [showOwnProfile, setShowOwnProfile] = useState(false)
    const [viewingUserId, setViewingUserId] = useState<string | null>(null)

    // ── Load data ─────────────────────────────────────────────────────────────

    const refreshData = async (user?: AuthUser | null) => {
        const resolvedUser = user !== undefined ? user : currentUser
        const [eventsData, plansData] = await Promise.all([getEvents(), getPlans()])
        setEvents(eventsData)
        setPlans(plansData)

        if (resolvedUser) {
            const joined = new Set(
                eventsData
                    .filter((e) => e.event_participants?.some((p) => p.user_id === resolvedUser.id))
                    .map((e) => e.id),
            )
            setJoinedEventIds(joined)
        }
    }

    useEffect(() => {
        const init = async () => {
            setIsLoading(true)
            try {
                const [eventsData, plansData, tagsData] = await Promise.all([
                    getEvents(),
                    getPlans(),
                    getTags(),
                ])
                setEvents(eventsData)
                setPlans(plansData)
                setAllTags(tagsData)

                if (getAuthToken()) {
                    try {
                        const user = await getCurrentUser()
                        setCurrentUser(user)
                        const joined = new Set(
                            eventsData
                                .filter((e) => e.event_participants?.some((p) => p.user_id === user.id))
                                .map((e) => e.id),
                        )
                        setJoinedEventIds(joined)
                    } catch {
                        apiLogout()
                        setCurrentUser(null)
                    }
                }
            } catch (err) {
                setLoginError(err instanceof Error ? err.message : 'Failed to load data')
            } finally {
                setIsLoading(false)
            }
        }
        init()
    }, [])

    // ── Filtered markers ──────────────────────────────────────────────────────

    const filteredEvents = (filterType === 'plans' ? [] : events).filter((e) =>
        matchesTags(e.tags, selectedTagIds),
    )
    const filteredPlans = (filterType === 'events' ? [] : plans).filter((p) =>
        matchesTags(p.tags, selectedTagIds),
    )

    // ── Auth ──────────────────────────────────────────────────────────────────

    const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setLoginError('')
        try {
            const data = await login(loginForm.email.trim(), loginForm.password)
            setCurrentUser(data.user)
            setShowLoginForm(false)
            setLoginForm({ email: '', password: '' })
            await refreshData(data.user)
        } catch (err) {
            setLoginError(err instanceof Error ? err.message : 'Login failed.')
        }
    }

    const handleRegister = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setLoginError('')
        try {
            const data = await register(
                registerForm.username.trim(),
                registerForm.email.trim(),
                registerForm.password,
            )
            setCurrentUser(data.user)
            setShowLoginForm(false)
            setRegisterForm({ username: '', email: '', password: '' })
            setAuthMode('login')
        } catch (err) {
            setLoginError(err instanceof Error ? err.message : 'Registration failed.')
        }
    }

    const handleLogout = () => {
        apiLogout()
        setCurrentUser(null)
        setJoinedEventIds(new Set())
        setShowLoginForm(false)
        setLoginError('')
        setShowOwnProfile(false)
        setViewingUserId(null)
    }

    // ── Join / Leave ──────────────────────────────────────────────────────────

    const handleJoin = async (eventId: string) => {
        try {
            await joinEvent(eventId)
            setJoinedEventIds((prev) => new Set([...prev, eventId]))
            const updated = await getEvents()
            setEvents(updated)
        } catch (err) {
            console.error('Join failed:', err)
        }
    }

    const handleLeave = async (eventId: string) => {
        try {
            await leaveEvent(eventId)
            setJoinedEventIds((prev) => { const s = new Set(prev); s.delete(eventId); return s })
            const updated = await getEvents()
            setEvents(updated)
        } catch (err) {
            console.error('Leave failed:', err)
        }
    }

    // ── Delete ────────────────────────────────────────────────────────────────

    const handleDeleteEvent = async (eventId: string) => {
        try {
            await deleteEvent(eventId)
            setEvents((prev) => prev.filter((e) => e.id !== eventId))
        } catch (err) {
            console.error('Delete event failed:', err)
        }
    }

    const handleDeletePlan = async (planId: string) => {
        try {
            await deletePlan(planId)
            setPlans((prev) => prev.filter((p) => p.id !== planId))
        } catch (err) {
            console.error('Delete plan failed:', err)
        }
    }

    // ── Create ────────────────────────────────────────────────────────────────

    const handleEventCreated = async (event: ApiEvent) => {
        setEvents((prev) => [...prev, event])
        setClickPosition(null)
        // Refresh tags in case new ones were created
        const tags = await getTags()
        setAllTags(tags)
    }

    const handlePlanCreated = async (plan: ApiPlan) => {
        setPlans((prev) => [...prev, plan])
        setClickPosition(null)
        const tags = await getTags()
        setAllTags(tags)
    }

    // ── Filter actions ────────────────────────────────────────────────────────

    const handleToggleTag = (tagId: number) => {
        setSelectedTagIds((prev) => {
            const next = new Set(prev)
            next.has(tagId) ? next.delete(tagId) : next.add(tagId)
            return next
        })
    }

    const handleClearFilters = () => {
        setSelectedTagIds(new Set())
        setFilterType('all')
    }

    // ── Profile ───────────────────────────────────────────────────────────────

    const handleProfileUpdated = () => {
        getCurrentUser().then(setCurrentUser).catch(console.error)
    }

    return (
        <div className="map-shell">
            <MapContainer
                className="leaflet-container"
                center={barcelonaCenter}
                zoom={14}
                style={{ height: '100vh', width: '100vw' }}
            >
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />

                <Marker position={barcelonaCenter}>
                    <Popup>Barcelona center: Plaça de Catalunya.</Popup>
                </Marker>

                <MapMarkers
                    events={filteredEvents}
                    plans={filteredPlans}
                    currentUserId={currentUser?.id ?? null}
                    isLoggedIn={!!currentUser}
                    joinedEventIds={joinedEventIds}
                    onJoin={handleJoin}
                    onLeave={handleLeave}
                    onDeleteEvent={handleDeleteEvent}
                    onDeletePlan={handleDeletePlan}
                    onViewUserProfile={setViewingUserId}
                    onMapClick={setClickPosition}
                    clickPosition={clickPosition}
                    onCloseClick={() => setClickPosition(null)}
                />
            </MapContainer>

            {/* Sidebar */}
            <div className="sidebar-overlay">
                {/* Login panel */}
                <div className="login-panel">
                    <button
                        type="button"
                        className="login-button"
                        onClick={() => {
                            if (currentUser) { handleLogout(); return }
                            setShowLoginForm((v) => !v)
                            setLoginError('')
                        }}
                    >
                        {currentUser ? 'Logout' : 'Login / Register'}
                    </button>
                    {currentUser && (
                        <div className="login-info">Logged in as <strong>{currentUser.username}</strong></div>
                    )}
                    {!currentUser && showLoginForm && (
                        <div>
                            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                <button type="button" className="popup-button"
                                    onClick={() => { setAuthMode('login'); setLoginError('') }}
                                    disabled={authMode === 'login'}>Login</button>
                                <button type="button" className="popup-button"
                                    onClick={() => { setAuthMode('register'); setLoginError('') }}
                                    disabled={authMode === 'register'}>Register</button>
                            </div>
                            {authMode === 'login' ? (
                                <form className="login-form" onSubmit={handleLogin}>
                                    <div className="login-field">
                                        <label htmlFor="login-email">Email</label>
                                        <input id="login-email" className="popup-input" type="email"
                                            value={loginForm.email}
                                            onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })} />
                                    </div>
                                    <div className="login-field">
                                        <label htmlFor="login-password">Password</label>
                                        <input id="login-password" className="popup-input" type="password"
                                            value={loginForm.password}
                                            onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} />
                                    </div>
                                    <button type="submit" className="popup-submit">Sign in</button>
                                </form>
                            ) : (
                                <form className="login-form" onSubmit={handleRegister}>
                                    <div className="login-field">
                                        <label htmlFor="register-username">Username</label>
                                        <input id="register-username" className="popup-input"
                                            value={registerForm.username}
                                            onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })} />
                                    </div>
                                    <div className="login-field">
                                        <label htmlFor="register-email">Email</label>
                                        <input id="register-email" className="popup-input" type="email"
                                            value={registerForm.email}
                                            onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })} />
                                    </div>
                                    <div className="login-field">
                                        <label htmlFor="register-password">Password</label>
                                        <input id="register-password" className="popup-input" type="password"
                                            value={registerForm.password}
                                            onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })} />
                                    </div>
                                    <button type="submit" className="popup-submit">Register</button>
                                </form>
                            )}
                        </div>
                    )}
                    {isLoading && <div className="login-info">Loading map data…</div>}
                    {loginError && <div className="login-error">{loginError}</div>}
                </div>

                {/* Legend */}
                <div className="map-legend">
                    <div className="map-legend__item">
                        <span className="map-legend__dot map-legend__dot--event" />
                        <span>Event</span>
                    </div>
                    <div className="map-legend__item">
                        <span className="map-legend__dot map-legend__dot--plan" />
                        <span>Plan</span>
                    </div>
                    <div className="map-legend__item">
                        <span className="map-legend__dot map-legend__dot--own" />
                        <span>Yours</span>
                    </div>
                </div>

                {/* Filter panel */}
                <FilterPanel
                    tags={allTags}
                    selectedTagIds={selectedTagIds}
                    onToggleTag={handleToggleTag}
                    onClear={handleClearFilters}
                    filterType={filterType}
                    onFilterType={setFilterType}
                />

                {/* Profile button */}
                {currentUser && (
                    <button type="button" className="sidebar-profile-btn" onClick={() => setShowOwnProfile(true)}>
                        <span className="sidebar-profile-avatar">
                            {currentUser.avatar_url
                                ? <img src={currentUser.avatar_url} alt={currentUser.username} />
                                : currentUser.username.slice(0, 2).toUpperCase()}
                        </span>
                        <span className="sidebar-profile-label">
                            <strong>{currentUser.username}</strong>
                            <small>View &amp; edit profile</small>
                        </span>
                        <span className="sidebar-profile-arrow">→</span>
                    </button>
                )}

                {/* Subscription panel */}
                <SubscriptionPanel
                    subscribedMarkers={[]}
                    onRemoveSubscription={() => {}}
                    currentUser={currentUser}
                    onOpenProfile={() => setShowOwnProfile(true)}
                />

                {/* Create panel */}
                {clickPosition && currentUser && (
                    <CreatePanel
                        position={clickPosition}
                        availableTags={allTags}
                        onEventCreated={handleEventCreated}
                        onPlanCreated={handlePlanCreated}
                        onCancel={() => setClickPosition(null)}
                    />
                )}
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