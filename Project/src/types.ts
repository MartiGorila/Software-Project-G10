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
    password: string
    subscriptions: string[]
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