// ── Base ──────────────────────────────────────────────────────────────────────

export const API_BASE = 'http://localhost:3000'

const TOKEN_KEY = 'token'

export function getAuthToken(): string | null {
    return localStorage.getItem(TOKEN_KEY)
}

function setAuthToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token)
}

function clearAuthToken(): void {
    localStorage.removeItem(TOKEN_KEY)
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = getAuthToken()
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> ?? {}),
    }
    if (token) headers['Authorization'] = `Bearer ${token}`

    const r = await fetch(`${API_BASE}${path}`, { ...options, headers })
    if (r.status === 204) return undefined as T
    const data = await r.json()
    if (!r.ok) throw new Error(data.error ?? `Request failed: ${path}`)
    return data as T
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type Tag = {
    id: number
    name: string
}

export type Visibility = 'public' | 'friends' | 'private'

export type AuthUser = {
    id: string
    username: string
    email: string
    avatar_url: string | null
    created_at: string
}

export type ApiEvent = {
    id: string
    creator_id: string
    name: string
    description: string | null
    lat: number
    lng: number
    event_time: string
    budget: number | null
    capacity: number | null
    visibility: Visibility
    created_at: string
    creator: { id: string; username: string }
    event_participants?: {
        user_id: string
        joined_at: string
        user?: { id: string; username: string }
    }[]
    tags?: Tag[]
}

export type ApiPlan = {
    id: string
    creator_id: string
    name: string
    description: string | null
    lat: number
    lng: number
    budget: number | null
    visibility: Visibility
    created_at: string
    creator: { id: string; username: string }
    tags?: Tag[]
}

export type OwnProfile = AuthUser

export type PublicProfile = {
    id: string
    username: string
    avatar_url: string | null
    created_at: string
}

export type Friend = {
    id: string
    username: string
    avatar_url: string | null
}

export type FriendRequest = {
    id: string
    requester_id: string
    recipient_id: string
    status: 'pending' | 'accepted' | 'rejected' | 'cancelled'
    created_at: string
    updated_at: string | null
    requester?: Friend
    recipient?: Friend
}

export type FriendRequestsResponse = {
    incoming: FriendRequest[]
    outgoing: FriendRequest[]
}

export type SuggestionResult = {
    type: 'event' | 'plan'
    id: string
    name: string
    description: string | null
    lat: number
    lng: number
    budget: number | null
    tags: Tag[]
    score: number
    distance_km: number
    reasons: string[]
    event_time?: string
    visibility: Visibility
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function login(
    email: string,
    password: string,
): Promise<{ user: AuthUser; token: string }> {
    const data = await apiFetch<{ user: AuthUser; token: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
    })
    setAuthToken(data.token)
    return data
}

export async function register(
    username: string,
    email: string,
    password: string,
): Promise<{ user: AuthUser; token: string }> {
    const data = await apiFetch<{ user: AuthUser; token: string }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, email, password }),
    })
    setAuthToken(data.token)
    return data
}

export function logout(): void {
    clearAuthToken()
}

// ── Users ─────────────────────────────────────────────────────────────────────

export function getCurrentUser(): Promise<AuthUser> {
    return apiFetch<AuthUser>('/users/me')
}

export function updateCurrentUser(body: {
    username?: string
    avatar_url?: string
}): Promise<AuthUser> {
    return apiFetch<AuthUser>('/users/me', {
        method: 'PUT',
        body: JSON.stringify(body),
    })
}

export function getPublicUser(userId: string): Promise<PublicProfile> {
    return apiFetch<PublicProfile>(`/users/${userId}`)
}

export function getFriends(): Promise<Friend[]> {
    return apiFetch<Friend[]>('/users/me/friends')
}

export function addFriend(friendId: string): Promise<{ ok: true }> {
    return apiFetch<{ ok: true }>(`/users/me/friends/${friendId}`, { method: 'POST' })
}

export function removeFriend(friendId: string): Promise<void> {
    return apiFetch<void>(`/users/me/friends/${friendId}`, { method: 'DELETE' })
}

export function getFriendRequests(): Promise<FriendRequestsResponse> {
    return apiFetch<FriendRequestsResponse>('/users/me/friend-requests')
}

export function sendFriendRequest(userId: string): Promise<FriendRequest> {
    return apiFetch<FriendRequest>(`/users/me/friend-requests/${userId}`, { method: 'POST' })
}

export function acceptFriendRequest(requestId: string): Promise<{ ok: true }> {
    return apiFetch<{ ok: true }>(`/users/me/friend-requests/${requestId}/accept`, { method: 'POST' })
}

export function rejectFriendRequest(requestId: string): Promise<{ ok: true }> {
    return apiFetch<{ ok: true }>(`/users/me/friend-requests/${requestId}/reject`, { method: 'POST' })
}

export function cancelFriendRequest(requestId: string): Promise<void> {
    return apiFetch<void>(`/users/me/friend-requests/${requestId}`, { method: 'DELETE' })
}

export async function uploadAvatar(file: File): Promise<AuthUser> {
    const token = getAuthToken()
    const formData = new FormData()
    formData.append('avatar', file)

    const headers: Record<string, string> = {}
    if (token) headers.Authorization = `Bearer ${token}`

    const response = await fetch(`${API_BASE}/upload/avatar`, {
        method: 'POST',
        headers,
        body: formData,
    })
    const data = await response.json()
    if (!response.ok) {
        throw new Error(data.error ?? 'Failed to upload avatar.')
    }

    return data as AuthUser
}

// ── Tags ──────────────────────────────────────────────────────────────────────

export function getTags(): Promise<Tag[]> {
    return apiFetch<Tag[]>('/tags')
}

export function createTag(name: string): Promise<Tag> {
    return apiFetch<Tag>('/tags', {
        method: 'POST',
        body: JSON.stringify({ name }),
    })
}

export function addTagToEvent(eventId: string, tagId: number): Promise<void> {
    return apiFetch<void>(`/tags/events/${eventId}/tags`, {
        method: 'POST',
        body: JSON.stringify({ tag_id: tagId }),
    })
}

export function removeTagFromEvent(eventId: string, tagId: number): Promise<void> {
    return apiFetch<void>(`/tags/events/${eventId}/tags/${tagId}`, { method: 'DELETE' })
}

export function addTagToPlan(planId: string, tagId: number): Promise<void> {
    return apiFetch<void>(`/tags/plans/${planId}/tags`, {
        method: 'POST',
        body: JSON.stringify({ tag_id: tagId }),
    })
}

export function removeTagFromPlan(planId: string, tagId: number): Promise<void> {
    return apiFetch<void>(`/tags/plans/${planId}/tags/${tagId}`, { method: 'DELETE' })
}

// ── Suggestions ──────────────────────────────────────────────────────────────

export function getSuggestions(params: {
    lat: number
    lng: number
    radius?: number
    tag_ids?: number[]
    budget_max?: number
    type?: 'all' | 'events' | 'plans'
}): Promise<{ results: SuggestionResult[] }> {
    const query = new URLSearchParams({
        lat: String(params.lat),
        lng: String(params.lng),
    })

    if (params.radius !== undefined) query.set('radius', String(params.radius))
    if (params.budget_max !== undefined) query.set('budget_max', String(params.budget_max))
    if (params.type !== undefined) query.set('type', params.type)
    if (params.tag_ids && params.tag_ids.length > 0) {
        query.set('tag_ids', params.tag_ids.join(','))
    }

    return apiFetch<{ results: SuggestionResult[] }>(`/suggestions?${query.toString()}`)
}

// ── Events ────────────────────────────────────────────────────────────────────

export function getEvents(): Promise<ApiEvent[]> {
    return apiFetch<ApiEvent[]>('/events')
}

export function getEvent(id: string): Promise<ApiEvent> {
    return apiFetch<ApiEvent>(`/events/${id}`)
}

export function createEvent(body: {
    name: string
    description?: string
    lat: number
    lng: number
    event_time: string
    budget?: number
    capacity?: number
    visibility?: Visibility
    tag_ids?: number[]
}): Promise<ApiEvent> {
    return apiFetch<ApiEvent>('/events', {
        method: 'POST',
        body: JSON.stringify(body),
    })
}

export function updateEvent(
    id: string,
    body: Partial<{
        name: string
        description: string
        lat: number
        lng: number
        event_time: string
        budget: number
        capacity: number
        visibility: Visibility
    }>,
): Promise<ApiEvent> {
    return apiFetch<ApiEvent>(`/events/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
    })
}

export function deleteEvent(id: string): Promise<void> {
    return apiFetch<void>(`/events/${id}`, { method: 'DELETE' })
}

export function joinEvent(id: string): Promise<void> {
    return apiFetch<void>(`/events/${id}/join`, { method: 'POST' })
}

export function leaveEvent(id: string): Promise<void> {
    return apiFetch<void>(`/events/${id}/join`, { method: 'DELETE' })
}

// ── Plans ─────────────────────────────────────────────────────────────────────

export function getPlans(): Promise<ApiPlan[]> {
    return apiFetch<ApiPlan[]>('/plans')
}

export function getPlan(id: string): Promise<ApiPlan> {
    return apiFetch<ApiPlan>(`/plans/${id}`)
}

export function createPlan(body: {
    name: string
    description?: string
    lat: number
    lng: number
    budget?: number
    visibility?: Visibility
    tag_ids?: number[]
}): Promise<ApiPlan> {
    return apiFetch<ApiPlan>('/plans', {
        method: 'POST',
        body: JSON.stringify(body),
    })
}

export function updatePlan(
    id: string,
    body: Partial<{
        name: string
        description: string
        lat: number
        lng: number
        budget: number
        visibility: Visibility
    }>,
): Promise<ApiPlan> {
    return apiFetch<ApiPlan>(`/plans/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
    })
}

export function deletePlan(id: string): Promise<void> {
    return apiFetch<void>(`/plans/${id}`, { method: 'DELETE' })
}
