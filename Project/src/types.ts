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
    password?: string
    subscriptions?: string[]
    avatar_url?: string
    created_at?: string
}
