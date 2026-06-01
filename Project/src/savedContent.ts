import type { ApiPlan, Tag } from './api'

const STORAGE_PREFIX = 'savedContent:v1:'

export type SavedPlan = {
    id: string
    savedAt: string
    name: string
    description: string | null
    lat: number
    lng: number
    budget: number | null
    tags: Tag[]
}

export type SavedRouteStop = {
    type: 'event' | 'plan'
    id: string
    name: string
    description: string | null
    lat: number
    lng: number
    budget: number | null
    tags: Tag[]
    eventTime?: string
    reasons: string[]
    stopNumber: number
}

export type SavedRoute = {
    id: string
    savedAt: string
    title: string
    mapCenter: [number, number]
    summary: {
        stops: number
        knownBudget: number
        hasUnknownBudget: boolean
        totalDistance: number
    }
    stops: SavedRouteStop[]
}

export type SavedRouteDraft = Omit<SavedRoute, 'id' | 'savedAt'>

export type SavedContentState = {
    plans: SavedPlan[]
    routes: SavedRoute[]
}

export const emptySavedContent: SavedContentState = {
    plans: [],
    routes: [],
}

function storageKey(userId: string) {
    return `${STORAGE_PREFIX}${userId}`
}

function parseSavedContent(value: string | null): SavedContentState {
    if (!value) return emptySavedContent

    try {
        const parsed = JSON.parse(value) as Partial<SavedContentState>
        return {
            plans: Array.isArray(parsed.plans) ? parsed.plans : [],
            routes: Array.isArray(parsed.routes) ? parsed.routes : [],
        }
    } catch {
        return emptySavedContent
    }
}

export function loadSavedContent(userId: string): SavedContentState {
    return parseSavedContent(localStorage.getItem(storageKey(userId)))
}

export function persistSavedContent(userId: string, state: SavedContentState): void {
    localStorage.setItem(storageKey(userId), JSON.stringify(state))
}

export function snapshotPlan(plan: ApiPlan): SavedPlan {
    return {
        id: plan.id,
        savedAt: new Date().toISOString(),
        name: plan.name,
        description: plan.description,
        lat: plan.lat,
        lng: plan.lng,
        budget: plan.budget,
        tags: plan.tags ?? [],
    }
}

export function addSavedPlan(state: SavedContentState, plan: ApiPlan) {
    if (state.plans.some((savedPlan) => savedPlan.id === plan.id)) {
        return { state, duplicate: true }
    }

    return {
        state: {
            ...state,
            plans: [snapshotPlan(plan), ...state.plans],
        },
        duplicate: false,
    }
}

export function addSavedRoute(state: SavedContentState, route: SavedRouteDraft) {
    return {
        ...state,
        routes: [{
            ...route,
            id: `route-${Date.now()}`,
            savedAt: new Date().toISOString(),
        }, ...state.routes],
    }
}

export function removeSavedPlan(state: SavedContentState, planId: string): SavedContentState {
    return {
        ...state,
        plans: state.plans.filter((plan) => plan.id !== planId),
    }
}

export function removeSavedRoute(state: SavedContentState, routeId: string): SavedContentState {
    return {
        ...state,
        routes: state.routes.filter((route) => route.id !== routeId),
    }
}
