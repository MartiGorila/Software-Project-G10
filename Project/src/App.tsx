import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import './App.css'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import MapMarkers from './MapMarkers'
import EventDetailsSidebar from './EventDetailsSidebar'
import CreatePanel from './CreatePanel'
import FilterPanel, { RelevanceFilter } from './FilterPanel'
import SuggestionsPanel from './SuggestionsPanel'
import ExplorePanel from './ExplorePanel'
import PlannerPanel from './PlannerPanel'
import TopBar from './TopBar'
import ProfileModal from './ProfileModal'
import PublicProfileModal from './PublicProfileModal'
import SubscriptionPanel from './SubscriptionPanel'
import SavedContentPanel from './SavedContentPanel'
import {
    addSavedPlan,
    addSavedRoute,
    emptySavedContent,
    loadSavedContent,
    persistSavedContent,
    removeSavedPlan,
    removeSavedRoute,
    SavedContentState,
    SavedRouteDraft,
} from './savedContent'
import {
    getAuthToken,
    getCurrentUser,
    getEvents,
    getFriends,
    getPlans,
    getTags,
    addFriend,
    joinEvent,
    leaveEvent,
    deleteEvent,
    deletePlan,
    removeFriend,
    login,
    logout as apiLogout,
    register,
    ApiEvent,
    ApiPlan,
    AuthUser,
    Friend,
    SuggestionResult,
    Tag,
} from './api'
import { sortTagsForDisplay } from './categoryIcons'

const barcelonaCenter: [number, number] = [41.3851, 2.1734]

// ── Filtering helpers ─────────────────────────────────────────────────────────

function matchesTags(itemTags: Tag[] | undefined, selectedIds: Set<number>): boolean {
    if (selectedIds.size === 0) return true
    const ids = (itemTags ?? []).map((t) => t.id)
    return [...selectedIds].every((id) => ids.includes(id))
}

function MapCenterTracker({ onCenterChange }: { onCenterChange: (center: [number, number]) => void }) {
    useMapEvents({
        moveend(event) {
            const center = event.target.getCenter()
            onCenterChange([center.lat, center.lng])
        },
    })
    return null
}

function App() {
    const [events, setEvents] = useState<ApiEvent[]>([])
    const [plans, setPlans] = useState<ApiPlan[]>([])
    const [allTags, setAllTags] = useState<Tag[]>([])
    const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)
    const [friends, setFriends] = useState<Friend[]>([])
    const [friendsLoading, setFriendsLoading] = useState(false)
    const [friendsError, setFriendsError] = useState('')
    const [isLoading, setIsLoading] = useState(true)
    const [showSplash, setShowSplash] = useState(true)
    const [splashExiting, setSplashExiting] = useState(false)

    const [joinedEventIds, setJoinedEventIds] = useState<Set<string>>(new Set())
    const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
    const [mapCenter, setMapCenter] = useState<[number, number]>(barcelonaCenter)
    const [suggestionFocus, setSuggestionFocus] = useState<[number, number] | null>(null)

    // ── Filter state ──────────────────────────────────────────────────────────
    const [selectedTagIds, setSelectedTagIds] = useState<Set<number>>(new Set())
    const [filterType, setFilterType] = useState<'all' | 'events' | 'plans'>('all')
    const [relevanceFilter, setRelevanceFilter] = useState<RelevanceFilter>('all')

    const [clickPosition, setClickPosition] = useState<[number, number] | null>(null)

    const [showLoginForm, setShowLoginForm] = useState(false)
    const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
    const [loginForm, setLoginForm] = useState({ email: '', password: '' })
    const [registerForm, setRegisterForm] = useState({ username: '', email: '', password: '' })
    const [loginError, setLoginError] = useState('')

    const [showOwnProfile, setShowOwnProfile] = useState(false)
    const [viewingUserId, setViewingUserId] = useState<string | null>(null)
    const [showExplore, setShowExplore] = useState(false)
    const [showPlanner, setShowPlanner] = useState(false)
    const [showSavedContent, setShowSavedContent] = useState(false)
    const [savedContent, setSavedContent] = useState<SavedContentState>(emptySavedContent)
    const friendIds = useMemo(() => new Set(friends.map((friend) => friend.id)), [friends])
    const savedPlanIds = useMemo(
        () => new Set(savedContent.plans.map((plan) => plan.id)),
        [savedContent.plans],
    )

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

    const refreshFriends = async () => {
        if (!getAuthToken()) {
            setFriends([])
            setFriendsError('')
            return
        }

        try {
            setFriendsLoading(true)
            setFriendsError('')
            const data = await getFriends()
            setFriends(data)
        } catch (err) {
            setFriends([])
            setFriendsError(err instanceof Error ? err.message : 'Failed to load friends.')
        } finally {
            setFriendsLoading(false)
        }
    }

    useEffect(() => {
        const fadeTimer = window.setTimeout(() => setSplashExiting(true), 2850)
        const removeTimer = window.setTimeout(() => setShowSplash(false), 3200)

        return () => {
            window.clearTimeout(fadeTimer)
            window.clearTimeout(removeTimer)
        }
    }, [])

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
                        setSavedContent(loadSavedContent(user.id))
                        await refreshFriends()
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

    const matchesRelevance = (item: ApiEvent | ApiPlan, type: 'event' | 'plan') => {
        if (relevanceFilter === 'all') return true
        if (!currentUser) return false

        if (relevanceFilter === 'mine') {
            return item.creator_id === currentUser.id || (type === 'event' && joinedEventIds.has(item.id))
        }

        if (friendIds.has(item.creator_id)) return true
        return type === 'event'
            ? ((item as ApiEvent).event_participants ?? []).some((participant) => friendIds.has(participant.user_id))
            : false
    }

    const filteredEvents = (filterType === 'plans' ? [] : events).filter((e) =>
        matchesTags(e.tags, selectedTagIds) && matchesRelevance(e, 'event'),
    )
    const filteredPlans = (filterType === 'events' ? [] : plans).filter((p) =>
        matchesTags(p.tags, selectedTagIds) && matchesRelevance(p, 'plan'),
    )
    const visibleTags = useMemo(
        () => sortTagsForDisplay(allTags.filter((tag) => !tag.name.toLowerCase().startsWith('ci-'))),
        [allTags],
    )
    const subscribedEvents = events
        .filter((event) => joinedEventIds.has(event.id))

    // ── Auth ──────────────────────────────────────────────────────────────────

    const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setLoginError('')
        try {
            const data = await login(loginForm.email.trim(), loginForm.password)
            setCurrentUser(data.user)
            setSavedContent(loadSavedContent(data.user.id))
            setShowLoginForm(false)
            setLoginForm({ email: '', password: '' })
            await refreshData(data.user)
            await refreshFriends()
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
            setSavedContent(loadSavedContent(data.user.id))
            setShowLoginForm(false)
            setRegisterForm({ username: '', email: '', password: '' })
            setAuthMode('login')
            await refreshData(data.user)
            await refreshFriends()
        } catch (err) {
            setLoginError(err instanceof Error ? err.message : 'Registration failed.')
        }
    }

    const handleLogout = () => {
        apiLogout()
        setCurrentUser(null)
        setFriends([])
        setFriendsError('')
        setJoinedEventIds(new Set())
        setShowLoginForm(false)
        setLoginError('')
        setShowOwnProfile(false)
        setShowSavedContent(false)
        setViewingUserId(null)
        setSavedContent(emptySavedContent)
        setRelevanceFilter('all')
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

    const handleEventCreated = async (_event: ApiEvent) => {
        setClickPosition(null)
        const [updatedEvents, tags] = await Promise.all([getEvents(), getTags()])
        setEvents(updatedEvents)
        setAllTags(tags)
    }

    const handlePlanCreated = async (_plan: ApiPlan) => {
        setClickPosition(null)
        const [updatedPlans, tags] = await Promise.all([getPlans(), getTags()])
        setPlans(updatedPlans)
        setAllTags(tags)
    }
    const selectedEvent = selectedEventId ? events.find((event) => event.id === selectedEventId) ?? null : null
    const handleSelectEvent = (eventId: string) => {
        setSelectedEventId(eventId)
    }
    const handleCloseEventDetails = () => {
        setSelectedEventId(null)
    }

    const handleSelectSuggestion = (suggestion: SuggestionResult) => {
        setSuggestionFocus([suggestion.lat, suggestion.lng])
        if (suggestion.type === 'event') {
            setSelectedEventId(suggestion.id)
        }
    }

    const handleSelectExplorePlan = (position: [number, number]) => {
        setSuggestionFocus(position)
    }

    const handleCenterOnMap = (position: [number, number]) => {
        setSuggestionFocus(position)
    }

    // ── Saved content ────────────────────────────────────────────────────────

    const setAndPersistSavedContent = (next: SavedContentState) => {
        if (!currentUser) return
        setSavedContent(next)
        persistSavedContent(currentUser.id, next)
    }

    const handleSavePlan = (plan: ApiPlan) => {
        if (!currentUser) return { saved: false, message: 'Log in to save plans.' }

        const result = addSavedPlan(savedContent, plan)
        setAndPersistSavedContent(result.state)

        return {
            saved: !result.duplicate,
            message: result.duplicate ? 'Plan already saved.' : 'Plan saved.',
        }
    }

    const handleSaveRoute = (route: SavedRouteDraft) => {
        if (!currentUser) return { saved: false, message: 'Log in to save routes.' }
        setAndPersistSavedContent(addSavedRoute(savedContent, route))
        return { saved: true, message: 'Route saved.' }
    }

    const handleRemoveSavedPlan = (planId: string) => {
        setAndPersistSavedContent(removeSavedPlan(savedContent, planId))
    }

    const handleRemoveSavedRoute = (routeId: string) => {
        setAndPersistSavedContent(removeSavedRoute(savedContent, routeId))
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
        setRelevanceFilter('all')
    }

    // ── Profile ───────────────────────────────────────────────────────────────

    const handleProfileUpdated = () => {
        getCurrentUser().then(setCurrentUser).catch(console.error)
    }

    const handleAddFriend = async (userId: string) => {
        await addFriend(userId)
        await refreshFriends()
    }

    const handleRemoveFriend = async (userId: string) => {
        await removeFriend(userId)
        await refreshFriends()
    }

    return (
        <div className="map-shell">
            {showSplash && (
                <div className={`rove-splash ${splashExiting ? 'rove-splash--exit' : ''}`} aria-label="Loading Rove">
                    <div className="rove-splash__content">
                        <img src="/rove-mark-white.png" alt="Rove" className="rove-splash__logo" />
                        <div className="rove-splash__progress" aria-hidden="true">
                            <span />
                        </div>
                    </div>
                </div>
            )}
            <TopBar
                currentUser={currentUser}
                onOpenExplore={() => setShowExplore(true)}
                onOpenPlanner={() => setShowPlanner(true)}
                onOpenProfile={() => setShowOwnProfile(true)}
                onOpenSavedContent={() => setShowSavedContent(true)}
                onLoginClick={() => {
                    setShowLoginForm((v) => !v)
                    setLoginError('')
                }}
                onLogout={handleLogout}
            />

            {showExplore && (
                <ExplorePanel
                    events={events}
                    plans={plans}
                    mapCenter={mapCenter}
                    selectedTagIds={selectedTagIds}
                    tags={visibleTags}
                    onClose={() => setShowExplore(false)}
                    onSelectEvent={handleSelectEvent}
                    onSelectPlan={handleSelectExplorePlan}
                    isLoggedIn={!!currentUser}
                    savedPlanIds={savedPlanIds}
                    joinedEventIds={joinedEventIds}
                    onSavePlan={handleSavePlan}
                    onSubscribeEvent={handleJoin}
                    onUnsubscribeEvent={handleLeave}
                />
            )}

            {showPlanner && (
                <PlannerPanel
                    events={events}
                    plans={plans}
                    mapCenter={mapCenter}
                    tags={visibleTags}
                    onClose={() => setShowPlanner(false)}
                    onOpenEventDetails={handleSelectEvent}
                    onCenterOnMap={handleCenterOnMap}
                    isLoggedIn={!!currentUser}
                    onSaveRoute={handleSaveRoute}
                />
            )}

            {!currentUser && showLoginForm && (
                <div className="top-auth-popover">
                    <div className="top-auth-card">
                        <div className="auth-mode-row">
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
                        {isLoading && <div className="login-info">Loading map data...</div>}
                        {loginError && <div className="login-error">{loginError}</div>}
                    </div>
                </div>
            )}

            <main className="app-main">
                <section className="map-card" aria-label="Explore map">
                    <div className="map-card__header">
                        <div>
                            <span className="map-card__eyebrow">Barcelona live map</span>
                            <h1>Explore events and plans nearby</h1>
                        </div>
                        <p>Click the map to create something new, or select an event marker to see details.</p>
                    </div>

                    <div className="map-card__body">
                        <MapContainer
                            className="leaflet-container"
                            center={barcelonaCenter}
                            zoom={14}
                            style={{ height: '100%' }}
                        >
                            <TileLayer
                                url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                            />

                            <Marker position={barcelonaCenter}>
                                <Popup>Barcelona center: Plaça de Catalunya.</Popup>
                            </Marker>

                            <MapCenterTracker onCenterChange={setMapCenter} />

                            <MapMarkers
                                events={filteredEvents}
                                plans={filteredPlans}
                                currentUserId={currentUser?.id ?? null}
                                isLoggedIn={!!currentUser}
                                savedPlanIds={savedPlanIds}
                                onDeletePlan={handleDeletePlan}
                                onSavePlan={handleSavePlan}
                                onViewUserProfile={setViewingUserId}
                                onMapClick={setClickPosition}
                                clickPosition={clickPosition}
                                onCloseClick={() => setClickPosition(null)}
                                onEventSelect={handleSelectEvent}
                                focusPosition={suggestionFocus}
                            />
                        </MapContainer>
                        <div className="map-scrim" aria-hidden="true" />
                    </div>

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
                </section>

                <aside className="sidebar-overlay">
                <section className="control-section">
                    <div className="control-section__label" id="explore-panel">Explore filters</div>
                    <FilterPanel
                        tags={visibleTags}
                        selectedTagIds={selectedTagIds}
                        onToggleTag={handleToggleTag}
                        onClear={handleClearFilters}
                        filterType={filterType}
                        onFilterType={setFilterType}
                        relevanceFilter={relevanceFilter}
                        onRelevanceFilter={setRelevanceFilter}
                        isLoggedIn={!!currentUser}
                    />
                </section>

                <section className="control-section">
                    <div className="control-section__label" id="suggestions-panel">Suggestions</div>
                    <SuggestionsPanel
                        mapCenter={mapCenter}
                        selectedTagIds={selectedTagIds}
                        filterType={filterType}
                        tags={visibleTags}
                        events={events}
                        friendIds={friendIds}
                        onSelectSuggestion={handleSelectSuggestion}
                    />
                </section>

                <section className="control-section">
                    <div className="control-section__label" id="friends-panel">Friends &amp; subscribed events</div>
                    <SubscriptionPanel
                        subscribedEvents={subscribedEvents}
                        friends={friends}
                        friendsLoading={friendsLoading}
                        friendsError={friendsError}
                        onRemoveSubscription={handleLeave}
                        onRemoveFriend={handleRemoveFriend}
                        onViewUserProfile={setViewingUserId}
                        currentUser={currentUser}
                    />
                </section>
                </aside>
            </main>

            {selectedEvent && (
                <div className="event-details-overlay" onClick={handleCloseEventDetails}>
                    <EventDetailsSidebar event={selectedEvent} onClose={handleCloseEventDetails}
                        isLoggedIn={!!currentUser}
                        currentUserId={currentUser?.id ?? null}
                        joined={joinedEventIds.has(selectedEvent.id)}
                        isFull={selectedEvent.capacity !== null && selectedEvent.capacity <= (selectedEvent.event_participants?.length ?? 0)}
                        onJoin={handleJoin}
                        onLeave={handleLeave}
                        onDeleteEvent={handleDeleteEvent}
                        onViewUserProfile={setViewingUserId}
                        friendIds={friendIds}
                    />
                </div>
            )}

            {/* Create panel (left side) */}
            {clickPosition && currentUser && (
                <div className="create-panel-overlay">
                    <div style={{ padding: '1.25rem' }}>
                        <CreatePanel
                            position={clickPosition}
                            availableTags={visibleTags}
                            onEventCreated={handleEventCreated}
                            onPlanCreated={handlePlanCreated}
                            onCancel={() => setClickPosition(null)}
                        />
                    </div>
                </div>
            )}

            {showOwnProfile && currentUser && (
                <ProfileModal
                    onClose={() => setShowOwnProfile(false)}
                    onProfileUpdated={handleProfileUpdated}
                />
            )}
            {showSavedContent && currentUser && (
                <SavedContentPanel
                    savedContent={savedContent}
                    events={events}
                    onClose={() => setShowSavedContent(false)}
                    onOpenEventDetails={(eventId) => {
                        setSelectedEventId(eventId)
                        setShowSavedContent(false)
                    }}
                    onCenterOnMap={(position) => {
                        handleCenterOnMap(position)
                        setShowSavedContent(false)
                    }}
                    onRemovePlan={handleRemoveSavedPlan}
                    onRemoveRoute={handleRemoveSavedRoute}
                />
            )}
            {viewingUserId && (
                <PublicProfileModal
                    userId={viewingUserId}
                    currentUserId={currentUser?.id ?? null}
                    friendIds={friendIds}
                    onAddFriend={handleAddFriend}
                    onRemoveFriend={handleRemoveFriend}
                    onClose={() => setViewingUserId(null)}
                />
            )}
        </div>
    )
}

export default App
