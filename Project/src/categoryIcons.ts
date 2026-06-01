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

export function getCategoryIcon(tags: Tag[] | undefined, type: 'event' | 'plan') {
    const matchingTag = (tags ?? []).find((tag) => tagIconMap[tag.name.toLowerCase()])
    return matchingTag ? tagIconMap[matchingTag.name.toLowerCase()] : type === 'event' ? '📍' : '✨'
}

export function getVisibleTags(tags: Tag[] | undefined, limit = 3) {
    const allTags = tags ?? []
    return {
        visibleTags: allTags.slice(0, limit),
        hiddenCount: Math.max(0, allTags.length - limit),
    }
}
