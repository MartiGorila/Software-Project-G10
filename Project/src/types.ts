export type MarkerData = {
    id: string
    position: [number, number]
    name: string
    hour: string
    description: string
    creatorId: string
}

export type NewMarkerData = Omit<MarkerData, 'creatorId'>

export type User = {
    id: string
    username: string
    email?: string
    avatar_url?: string | null
    created_at?: string
}

export type EventParticipant = {
    user_id: string
    joined_at?: string
    user?: {
        id: string
        username: string
    }
}

export type ApiEvent = {
    id: string
    name: string
    description?: string | null
    lat: number
    lng: number
    event_time: string
    budget?: number | null
    capacity?: number | null
    creator_id: string
    creator?: {
        id: string
        username: string
    }
    event_participants?: EventParticipant[]
}

export type AuthUser = {
    id: string
    username: string
    email: string
    avatar_url?: string | null
    created_at?: string
}

export type OwnProfile = {
    id: string
    username: string
    email: string
    avatar_url: string | null
    created_at: string
}

export type PublicProfile = {
    id: string
    username: string
    avatar_url: string | null
    created_at: string
}
