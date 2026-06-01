import type { Tag } from './api'

const tagIconMap: Record<string, string> = {
    food: '🍽️',
    music: '🎵',
    outdoors: '🌿',
    culture: '🎭',
    sports: '⚽',
    study: '📚',
    wellness: '🧘',
    nightlife: '🌙',
    'budget-friendly': '€',
}

const commonTagOrder = [
    'food',
    'culture',
    'outdoors',
    'music',
    'sports',
    'study',
    'budget-friendly',
    'nightlife',
    'wellness',
]

export function getCategoryIcon(tags: Tag[] | undefined, type: 'event' | 'plan') {
    const matchingTag = (tags ?? []).find((tag) => tagIconMap[tag.name.toLowerCase()])
    return matchingTag ? tagIconMap[matchingTag.name.toLowerCase()] : type === 'event' ? '📍' : '✨'
}

export function sortTagsForDisplay(tags: Tag[]) {
    return [...tags].sort((a, b) => {
        const aIndex = commonTagOrder.indexOf(a.name.toLowerCase())
        const bIndex = commonTagOrder.indexOf(b.name.toLowerCase())
        const normalizedA = aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex
        const normalizedB = bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex
        if (normalizedA !== normalizedB) return normalizedA - normalizedB
        return a.name.localeCompare(b.name)
    })
}

export function getVisibleTags(tags: Tag[] | undefined, limit = 3) {
    const allTags = tags ?? []
    return {
        visibleTags: allTags.slice(0, limit),
        hiddenCount: Math.max(0, allTags.length - limit),
    }
}
