const API_URL = 'https://localhost:3001/api'

// Fetch options para ignorar certificados autofirmados
const fetchOptions = {
    method: 'GET',
    headers: {
        'Content-Type': 'application/json',
    },
}

export async function fetchUsers(): Promise<any[]> {
    try {
        const response = await fetch(`${API_URL}/users`, fetchOptions)
        if (!response.ok) throw new Error('Failed to fetch users')
        return await response.json()
    } catch (error) {
        console.error('Error fetching users:', error)
        return []
    }
}

export async function fetchEvents(): Promise<any[]> {
    try {
        const response = await fetch(`${API_URL}/events`, fetchOptions)
        if (!response.ok) throw new Error('Failed to fetch events')
        return await response.json()
    } catch (error) {
        console.error('Error fetching events:', error)
        return []
    }
}

export async function createEvent(event: any): Promise<any> {
    try {
        const response = await fetch(`${API_URL}/events`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(event),
        })
        if (!response.ok) throw new Error('Failed to create event')
        return await response.json()
    } catch (error) {
        console.error('Error creating event:', error)
        throw error
    }
}

export async function deleteEventAPI(eventId: string): Promise<void> {
    try {
        const response = await fetch(`${API_URL}/events/${eventId}`, {
            method: 'DELETE',
        })
        if (!response.ok) throw new Error('Failed to delete event')
    } catch (error) {
        console.error('Error deleting event:', error)
        throw error
    }
}

export async function subscribeToEvent(userId: string, eventId: string): Promise<void> {
    try {
        const response = await fetch(`${API_URL}/subscribe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, eventId }),
        })
        if (!response.ok) throw new Error('Failed to subscribe')
    } catch (error) {
        console.error('Error subscribing:', error)
        throw error
    }
}

export async function unsubscribeFromEvent(userId: string, eventId: string): Promise<void> {
    try {
        const response = await fetch(`${API_URL}/unsubscribe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, eventId }),
        })
        if (!response.ok) throw new Error('Failed to unsubscribe')
    } catch (error) {
        console.error('Error unsubscribing:', error)
        throw error
    }
}
