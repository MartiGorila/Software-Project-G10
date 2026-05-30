// ── Base ──────────────────────────────────────────────────────────────────────

export const API_BASE = 'http://localhost:3000'

const TOKEN_KEY = 'authToken'

export function getAuthToken(): string | null {
    return sessionStorage.getItem(TOKEN_KEY)
}

function setAuthToken(token: string): void {
    sessionStorage.setItem(TOKEN_KEY, token)
}

function clearAuthToken(): void {
    sessionStorage.removeItem(TOKEN_KEY)
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
    created_at: string
    creator: { id: string; username: string }
    event_participants?: {
        user_id: string
        joined_at: string
        user?: { id: string; username: string }
    }[]
}

export type ApiPlan = {
    id: string
    creator_id: string
    name: string
    description: string | null
    lat: number
    lng: number
    budget: number | null
    created_at: string
    creator: { id: string; username: string }
}

export type OwnProfile = AuthUser

export type PublicProfile = {
    id: string
    username: string
    avatar_url: string | null
    created_at: string
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

// ── Avatar upload (direct to Supabase Storage) ────────────────────────────────

export async function uploadAvatar(
    file: File,
    userId: string,
    supabaseUrl: string,
    supabaseAnonKey: string,
): Promise<string> {
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `avatars/${userId}.${ext}`

    const { error } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type })

    if (error) throw new Error(error.message)

    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    return data.publicUrl
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
