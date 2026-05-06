import { MarkerData, User } from './types'

const EVENT_STORAGE_KEY = 'createdEvents'
const USER_STORAGE_KEY = 'appUsers'
const CURRENT_USER_KEY = 'currentUserId'
const LEGACY_EVENT_STORAGE_KEY = 'savedMarkers'

const DEFAULT_EVENTS: MarkerData[] = [
    {
        id: 'event-1',
        position: [41.381, 2.168],
        name: 'Morning Plaza Meetup',
        hour: '08:30',
        description: 'Start the day with a group meetup at the plaza.',
        creatorId: 'user-1',
    },
    {
        id: 'event-2',
        position: [41.383, 2.170],
        name: 'Cafe Networking',
        hour: '10:00',
        description: 'Coffee and networking session near the route.',
        creatorId: 'user-2',
    },
    {
        id: 'event-3',
        position: [41.386, 2.173],
        name: 'Lunch Break',
        hour: '12:30',
        description: 'Lunch break with friends and partners.',
        creatorId: 'user-3',
    },
    {
        id: 'event-4',
        position: [41.389, 2.175],
        name: 'Afternoon Workshop',
        hour: '15:00',
        description: 'A short workshop on route planning and transit.',
        creatorId: 'user-4',
    },
    {
        id: 'event-5',
        position: [41.391, 2.178],
        name: 'Evening Wrap-up',
        hour: '17:30',
        description: 'Finish the day with a summary and next steps.',
        creatorId: 'user-5',
    },
]

const DEFAULT_USERS: User[] = [
    { id: 'user-1', username: 'alice', password: 'alice123', subscriptions: ['event-1', 'event-3'] },
    { id: 'user-2', username: 'bob', password: 'bob123', subscriptions: ['event-2'] },
    { id: 'user-3', username: 'carol', password: 'carol123', subscriptions: ['event-3', 'event-4'] },
    { id: 'user-4', username: 'dave', password: 'dave123', subscriptions: ['event-1', 'event-5'] },
    { id: 'user-5', username: 'eve', password: 'eve123', subscriptions: ['event-2', 'event-4', 'event-5'] },
]

export function loadEvents(): MarkerData[] {
    if (typeof window === 'undefined') return []
    const stored = localStorage.getItem(EVENT_STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
}

export function saveEvents(events: MarkerData[]): void {
    if (typeof window === 'undefined') return
    localStorage.setItem(EVENT_STORAGE_KEY, JSON.stringify(events))
}

export function loadUsers(): User[] {
    if (typeof window === 'undefined') return DEFAULT_USERS
    const stored = localStorage.getItem(USER_STORAGE_KEY)
    return stored ? JSON.parse(stored) : DEFAULT_USERS
}

export function saveUsers(users: User[]): void {
    if (typeof window === 'undefined') return
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(users))
}

export function loadCurrentUserId(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem(CURRENT_USER_KEY)
}

export function saveCurrentUserId(userId: string | null): void {
    if (typeof window === 'undefined') return
    if (userId) {
        localStorage.setItem(CURRENT_USER_KEY, userId)
    } else {
        localStorage.removeItem(CURRENT_USER_KEY)
    }
}

export function clearLegacyEvents(): void {
    if (typeof window === 'undefined') return
    localStorage.removeItem(LEGACY_EVENT_STORAGE_KEY)
}

export function initializeEvents(): MarkerData[] {
    clearLegacyEvents()
    const events = loadEvents()
    if (events.length > 0) return events
    saveEvents(DEFAULT_EVENTS)
    return DEFAULT_EVENTS
}

export function initializeUsers(): User[] {
    const users = loadUsers()
    if (users.length > 0) {
        return users
    }

    saveUsers(DEFAULT_USERS)
    return DEFAULT_USERS
}
