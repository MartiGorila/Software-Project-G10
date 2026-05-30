import { AuthUser, OwnProfile, PublicProfile } from './types'

const API_BASE = 'http://localhost:3000'

export function getAuthToken(): string | null {
  return localStorage.getItem('token')
}

export function setAuthToken(token: string | null) {
  if (token) {
    localStorage.setItem('token', token)
  } else {
    localStorage.removeItem('token')
  }
}

export function getAuthHeader(): HeadersInit {
  const token = getAuthToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
      ...options.headers,
    },
  })

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`

    try {
      const errorData = await response.json()
      message = errorData.error || errorData.message || message
    } catch {
      // ignore non-JSON errors
    }

    throw new Error(message)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json()
}

// Auth

export async function register(username: string, email: string, password: string) {
  const data = await apiRequest<{ user: AuthUser; token: string }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, email, password }),
  })

  setAuthToken(data.token)
  return data
}

export async function login(email: string, password: string) {
  const data = await apiRequest<{ user: AuthUser; token: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })

  setAuthToken(data.token)
  return data
}

export function logout() {
  setAuthToken(null)
}

// Users

export async function getCurrentUser() {
  return apiRequest<OwnProfile>('/users/me')
}

export async function updateCurrentUser(data: { username?: string; avatar_url?: string | null }) {
  return apiRequest<OwnProfile>('/users/me', {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function getPublicUser(userId: string) {
  return apiRequest<PublicProfile>(`/users/${userId}`)
}

export async function getFriends() {
  return apiRequest<any[]>('/users/me/friends')
}

export async function addFriend(friendId: string) {
  return apiRequest<{ ok: true }>(`/users/me/friends/${friendId}`, {
    method: 'POST',
  })
}

export async function removeFriend(friendId: string) {
  return apiRequest<void>(`/users/me/friends/${friendId}`, {
    method: 'DELETE',
  })
}

// Events

export type CreateEventPayload = {
  name: string
  description?: string
  lat: number
  lng: number
  event_time: string
  budget?: number
  capacity?: number
}

export async function getEvents() {
  return apiRequest<any[]>('/events')
}

export async function getEvent(eventId: string) {
  return apiRequest<any>(`/events/${eventId}`)
}

export async function createEvent(data: CreateEventPayload) {
  return apiRequest<any>('/events', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateEvent(eventId: string, data: Partial<CreateEventPayload>) {
  return apiRequest<any>(`/events/${eventId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function deleteEvent(eventId: string) {
  return apiRequest<void>(`/events/${eventId}`, {
    method: 'DELETE',
  })
}

export async function joinEvent(eventId: string) {
  return apiRequest<{ ok: true }>(`/events/${eventId}/join`, {
    method: 'POST',
  })
}

export async function leaveEvent(eventId: string) {
  return apiRequest<void>(`/events/${eventId}/join`, {
    method: 'DELETE',
  })
}

// Plans

export type CreatePlanPayload = {
  name: string
  description?: string
  lat: number
  lng: number
  budget?: number
}

export async function getPlans() {
  return apiRequest<any[]>('/plans')
}

export async function getPlan(planId: string) {
  return apiRequest<any>(`/plans/${planId}`)
}

export async function createPlan(data: CreatePlanPayload) {
  return apiRequest<any>('/plans', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updatePlan(planId: string, data: Partial<CreatePlanPayload>) {
  return apiRequest<any>(`/plans/${planId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function deletePlan(planId: string) {
  return apiRequest<void>(`/plans/${planId}`, {
    method: 'DELETE',
  })
}
