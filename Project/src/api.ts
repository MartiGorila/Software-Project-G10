const API_BASE = 'http://localhost:3000'

let authToken: string | null = null

// Helper to log API calls with status
function logApiCall(method: string, endpoint: string, status: number, error?: string) {
  const statusColor = status >= 200 && status < 300 ? '✅' : '❌'
  console.log(
    `${statusColor} [${method}] ${endpoint} → ${status}${error ? ` | ${error}` : ''}`
  )
}

// Helper to handle fetch with detailed error messages
async function fetchWithErrorHandling(url: string, options?: RequestInit) {
  try {
    const response = await fetch(url, options)
    return response
  } catch (error) {
    // Network error - backend not running or unreachable
    const networkError = new Error('Backend not running (connection refused)')
      ; (networkError as any).isNetworkError = true
      ; (networkError as any).originalError = error
    console.error('❌ Network Error - Backend may not be running:', error)
    throw networkError
  }
}

export function setAuthToken(token: string | null) {
  authToken = token
  if (token) {
    localStorage.setItem('authToken', token)
  } else {
    localStorage.removeItem('authToken')
  }
}

export function getAuthToken() {
  if (!authToken) {
    authToken = localStorage.getItem('authToken')
  }
  return authToken
}

// ============ Auth API ============

export async function loginWithUsername(username: string, password: string) {
  try {
    const endpoint = '/auth/login-username'
    const response = await fetchWithErrorHandling(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })

    logApiCall('POST', endpoint, response.status)

    if (!response.ok) {
      let errorMessage = `${response.status} Login failed`
      try {
        const error = await response.json()
        errorMessage = `${response.status} ${error.error || error.message || 'Login failed'}`
      } catch {
        // Response is not JSON, use default message
      }
      logApiCall('POST', endpoint, response.status, errorMessage)
      throw new Error(errorMessage)
    }

    const data = await response.json()
    setAuthToken(data.token)
    console.log(`✅ Token stored: ${data.token.substring(0, 20)}...`)
    return data
  } catch (error) {
    const errorMsg = (error as any)?.isNetworkError
      ? `❌ Network Error: Backend not running on ${API_BASE}`
      : `❌ Login error: ${error}`
    console.error(errorMsg)
    throw error
  }
}

export function logout() {
  setAuthToken(null)
  console.log('✅ Logged out')
}

// ============ Users API ============

export async function fetchUsers() {
  try {
    const endpoint = '/users'
    const response = await fetchWithErrorHandling(`${API_BASE}${endpoint}`)

    logApiCall('GET', endpoint, response.status)

    if (!response.ok) {
      const errorMsg = `${response.status} Failed to fetch users`
      logApiCall('GET', endpoint, response.status, errorMsg)
      throw new Error(errorMsg)
    }

    const data = await response.json()
    console.log(`✅ Fetched ${data.length} users`)
    return data
  } catch (error) {
    const errorMsg = (error as any)?.isNetworkError
      ? `❌ Network Error: Backend not running on ${API_BASE}`
      : `❌ Fetch users error: ${error}`
    console.error(errorMsg)
    throw error
  }
}

export async function fetchCurrentUser() {
  try {
    const token = getAuthToken()
    if (!token) {
      throw new Error('401 Not authenticated - no token found')
    }

    const endpoint = '/users/me'
    const response = await fetchWithErrorHandling(`${API_BASE}${endpoint}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })

    logApiCall('GET', endpoint, response.status)

    if (!response.ok) {
      const errorMsg = `${response.status} Failed to fetch current user`
      logApiCall('GET', endpoint, response.status, errorMsg)
      throw new Error(errorMsg)
    }

    const data = await response.json()
    console.log(`✅ Fetched current user: ${data.username}`)
    return data
  } catch (error) {
    const errorMsg = (error as any)?.isNetworkError
      ? `❌ Network Error: Backend not running on ${API_BASE}`
      : `❌ Fetch current user error: ${error}`
    console.error(errorMsg)
    throw error
  }
}

// ============ Events API ============

interface CreateEventPayload {
  name: string
  description?: string
  lat: number
  lng: number
  event_time: string
  budget?: number
  capacity?: number
}

export async function fetchEvents() {
  try {
    const endpoint = '/events'
    const response = await fetchWithErrorHandling(`${API_BASE}${endpoint}`)

    logApiCall('GET', endpoint, response.status)

    if (!response.ok) {
      const errorMsg = `${response.status} Failed to fetch events`
      logApiCall('GET', endpoint, response.status, errorMsg)
      throw new Error(errorMsg)
    }

    const events = await response.json()
    console.log(`✅ Fetched ${events.length} events`)
    // Transform the response to match frontend expectations
    return events.map((event: any) => ({
      id: event.id,
      position: [event.lat, event.lng] as [number, number],
      name: event.name,
      hour: new Date(event.event_time).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }),
      description: event.description || '',
      creatorId: event.creator_id || event.creator?.id,
    }))
  } catch (error) {
    const errorMsg = (error as any)?.isNetworkError
      ? `❌ Network Error: Backend not running on ${API_BASE}`
      : `❌ Fetch events error: ${error}`
    console.error(errorMsg)
    throw error
  }
}

export async function fetchEventById(eventId: string) {
  try {
    const endpoint = `/events/${eventId}`
    const response = await fetchWithErrorHandling(`${API_BASE}${endpoint}`)

    logApiCall('GET', endpoint, response.status)

    if (!response.ok) {
      const errorMsg = `${response.status} Failed to fetch event`
      logApiCall('GET', endpoint, response.status, errorMsg)
      throw new Error(errorMsg)
    }

    return await response.json()
  } catch (error) {
    const errorMsg = (error as any)?.isNetworkError
      ? `❌ Network Error: Backend not running on ${API_BASE}`
      : `❌ Fetch event error: ${error}`
    console.error(errorMsg)
    throw error
  }
}

export async function createEvent(event: CreateEventPayload) {
  try {
    const token = getAuthToken()
    if (!token) {
      throw new Error('401 Not authenticated - no token found')
    }

    const endpoint = '/events'
    const response = await fetchWithErrorHandling(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(event),
    })

    logApiCall('POST', endpoint, response.status)

    if (!response.ok) {
      let errorMessage = `${response.status} Failed to create event`
      try {
        const error = await response.json()
        errorMessage = `${response.status} ${error.error || error.message || 'Failed to create event'}`
      } catch {
        // Response is not JSON
      }
      logApiCall('POST', endpoint, response.status, errorMessage)
      throw new Error(errorMessage)
    }

    const newEvent = await response.json()
    console.log(`✅ Event created: ${newEvent.name}`)
    // Transform response
    return {
      id: newEvent.id,
      position: [newEvent.lat, newEvent.lng] as [number, number],
      name: newEvent.name,
      hour: new Date(newEvent.event_time).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }),
      description: newEvent.description || '',
      creatorId: newEvent.creator_id,
    }
  } catch (error) {
    const errorMsg = (error as any)?.isNetworkError
      ? `❌ Network Error: Backend not running on ${API_BASE}`
      : `❌ Create event error: ${error}`
    console.error(errorMsg)
    throw error
  }
}

export async function updateEvent(eventId: string, updates: Partial<CreateEventPayload>) {
  try {
    const token = getAuthToken()
    if (!token) {
      throw new Error('401 Not authenticated - no token found')
    }

    const endpoint = `/events/${eventId}`
    const response = await fetchWithErrorHandling(`${API_BASE}${endpoint}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(updates),
    })

    logApiCall('PUT', endpoint, response.status)

    if (!response.ok) {
      const errorMsg = `${response.status} Failed to update event`
      logApiCall('PUT', endpoint, response.status, errorMsg)
      throw new Error(errorMsg)
    }

    console.log(`✅ Event updated: ${eventId}`)
    return await response.json()
  } catch (error) {
    const errorMsg = (error as any)?.isNetworkError
      ? `❌ Network Error: Backend not running on ${API_BASE}`
      : `❌ Update event error: ${error}`
    console.error(errorMsg)
    throw error
  }
}

export async function deleteEvent(eventId: string) {
  try {
    const token = getAuthToken()
    if (!token) {
      throw new Error('401 Not authenticated - no token found')
    }

    const endpoint = `/events/${eventId}`
    const response = await fetchWithErrorHandling(`${API_BASE}${endpoint}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    })

    logApiCall('DELETE', endpoint, response.status)

    if (!response.ok) {
      const errorMsg = `${response.status} Failed to delete event`
      logApiCall('DELETE', endpoint, response.status, errorMsg)
      throw new Error(errorMsg)
    }

    console.log(`✅ Event deleted: ${eventId}`)
    return { success: true }
  } catch (error) {
    const errorMsg = (error as any)?.isNetworkError
      ? `❌ Network Error: Backend not running on ${API_BASE}`
      : `❌ Delete event error: ${error}`
    console.error(errorMsg)
    throw error
  }
}

export async function joinEvent(eventId: string) {
  try {
    const token = getAuthToken()
    if (!token) {
      throw new Error('401 Not authenticated - no token found')
    }

    const endpoint = `/events/${eventId}/join`
    const response = await fetchWithErrorHandling(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    })

    logApiCall('POST', endpoint, response.status)

    if (!response.ok) {
      const errorMsg = `${response.status} Failed to join event`
      logApiCall('POST', endpoint, response.status, errorMsg)
      throw new Error(errorMsg)
    }

    console.log(`✅ Joined event: ${eventId}`)
    return await response.json()
  } catch (error) {
    const errorMsg = (error as any)?.isNetworkError
      ? `❌ Network Error: Backend not running on ${API_BASE}`
      : `❌ Join event error: ${error}`
    console.error(errorMsg)
    throw error
  }
}

export async function leaveEvent(eventId: string) {
  try {
    const token = getAuthToken()
    if (!token) {
      throw new Error('401 Not authenticated - no token found')
    }

    const endpoint = `/events/${eventId}/leave`
    const response = await fetchWithErrorHandling(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    })

    logApiCall('POST', endpoint, response.status)

    if (!response.ok) {
      const errorMsg = `${response.status} Failed to leave event`
      logApiCall('POST', endpoint, response.status, errorMsg)
      throw new Error(errorMsg)
    }

    console.log(`✅ Left event: ${eventId}`)
    return await response.json()
  } catch (error) {
    const errorMsg = (error as any)?.isNetworkError
      ? `❌ Network Error: Backend not running on ${API_BASE}`
      : `❌ Leave event error: ${error}`
    console.error(errorMsg)
    throw error
  }
}
