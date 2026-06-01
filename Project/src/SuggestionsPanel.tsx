import { FormEvent, useState } from 'react'
import { ApiEvent, getSuggestions, SuggestionResult, Tag } from './api'
import { getCategoryIcon, getVisibleTags } from './categoryIcons'

type SuggestionType = 'all' | 'events' | 'plans'

type Props = {
    mapCenter: [number, number]
    selectedTagIds: Set<number>
    filterType: SuggestionType
    tags: Tag[]
    events: ApiEvent[]
    friendIds: Set<string>
    onSelectSuggestion: (suggestion: SuggestionResult) => void
}

function formatBudget(budget: number | null) {
    return budget === null ? 'Budget unknown' : `€${budget.toFixed(2)}`
}

function getFriendAttendance(suggestion: SuggestionResult, events: ApiEvent[], friendIds: Set<string>) {
    if (suggestion.type !== 'event' || friendIds.size === 0) return 0
    const event = events.find((candidate) => candidate.id === suggestion.id)
    return event?.event_participants?.filter((participant) => friendIds.has(participant.user_id)).length ?? 0
}

function countTagMatches(suggestion: SuggestionResult, selectedTags: Set<number>) {
    if (selectedTags.size === 0) return 0
    const suggestionTagIds = new Set(suggestion.tags.map((tag) => tag.id))
    return [...selectedTags].filter((tagId) => suggestionTagIds.has(tagId)).length
}

function buildFriendlyReasons(
    suggestion: SuggestionResult,
    selectedTags: Set<number>,
    budgetMax: number | undefined,
    friendCount: number,
) {
    const reasons: string[] = []

    if (suggestion.distance_km <= 1) {
        reasons.push('Very close to your map area')
    } else if (suggestion.distance_km <= 3) {
        reasons.push('Nearby and easy to reach')
    } else {
        reasons.push(`${suggestion.distance_km.toFixed(1)} km from your map center`)
    }

    const tagMatches = countTagMatches(suggestion, selectedTags)
    if (tagMatches > 0) {
        reasons.push(`Matches ${tagMatches} tag preference${tagMatches === 1 ? '' : 's'}`)
    }

    if (budgetMax !== undefined) {
        reasons.push(suggestion.budget === null ? 'Budget unknown' : 'Fits your budget')
    }

    if (friendCount > 0) {
        reasons.push(`${friendCount} friend${friendCount === 1 ? '' : 's'} attending`)
    }

    reasons.push(suggestion.type === 'event' ? 'Timed event recommendation' : 'Flexible plan recommendation')
    return reasons.slice(0, 4)
}

function rankSuggestions(
    suggestions: SuggestionResult[],
    selectedTags: Set<number>,
    budgetMax: number | undefined,
    events: ApiEvent[],
    friendIds: Set<string>,
) {
    return suggestions
        .map((suggestion, index) => {
            const friendCount = getFriendAttendance(suggestion, events, friendIds)
            const tagMatches = countTagMatches(suggestion, selectedTags)
            const budgetBoost = budgetMax !== undefined && suggestion.budget !== null && suggestion.budget <= budgetMax ? 8 : 0
            const personalizedScore = suggestion.score + (friendCount * 14) + (tagMatches * 8) + budgetBoost

            return {
                suggestion,
                index,
                friendCount,
                personalizedScore,
                reasons: buildFriendlyReasons(suggestion, selectedTags, budgetMax, friendCount),
            }
        })
        .sort((a, b) => {
            if (b.personalizedScore !== a.personalizedScore) return b.personalizedScore - a.personalizedScore
            if (a.suggestion.distance_km !== b.suggestion.distance_km) return a.suggestion.distance_km - b.suggestion.distance_km
            return a.index - b.index
        })
}

export default function SuggestionsPanel({
    mapCenter,
    selectedTagIds,
    filterType,
    tags,
    events,
    friendIds,
    onSelectSuggestion,
}: Props) {
    const [radius, setRadius] = useState('10')
    const [budgetMax, setBudgetMax] = useState('')
    const [suggestionType, setSuggestionType] = useState<SuggestionType>(filterType)
    const [suggestionTagIds, setSuggestionTagIds] = useState<Set<number>>(() => new Set(selectedTagIds))
    const [results, setResults] = useState<SuggestionResult[]>([])
    const [resultContext, setResultContext] = useState<{
        selectedTags: Set<number>
        type: SuggestionType
        budgetMax: number | undefined
    }>({
        selectedTags: new Set(selectedTagIds),
        type: filterType,
        budgetMax: undefined,
    })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [hasSearched, setHasSearched] = useState(false)
    const [excludedByBudget, setExcludedByBudget] = useState(0)
    const selectedTagNames = [...suggestionTagIds]
        .map((id) => tags.find((tag) => tag.id === id)?.name)
        .filter(Boolean)
        .join(', ')
    const rankedResults = rankSuggestions(results, resultContext.selectedTags, resultContext.budgetMax, events, friendIds)
    const topPick = rankedResults[0]
    const morePicks = rankedResults.slice(1)

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault()
        setLoading(true)
        setError('')
        setHasSearched(true)
        setExcludedByBudget(0)

        const parsedRadius = Number(radius)
        const parsedBudget = budgetMax.trim() ? Number(budgetMax) : undefined

        if (!Number.isFinite(parsedRadius) || parsedRadius <= 0) {
            setLoading(false)
            setError('Radius must be a positive number.')
            return
        }
        if (parsedBudget !== undefined && (!Number.isFinite(parsedBudget) || parsedBudget < 0)) {
            setLoading(false)
            setError('Budget must be a non-negative number.')
            return
        }

        try {
            const data = await getSuggestions({
                lat: mapCenter[0],
                lng: mapCenter[1],
                radius: parsedRadius,
                budget_max: parsedBudget,
                tag_ids: [...suggestionTagIds],
                type: suggestionType,
            })
            const filteredResults = parsedBudget === undefined
                ? data.results
                : data.results.filter((suggestion) => suggestion.budget === null || suggestion.budget <= parsedBudget)
            setExcludedByBudget(data.results.length - filteredResults.length)
            setResultContext({
                selectedTags: new Set(suggestionTagIds),
                type: suggestionType,
                budgetMax: parsedBudget,
            })
            setResults(filteredResults)
        } catch (suggestionError) {
            setError(suggestionError instanceof Error ? suggestionError.message : 'Failed to load suggestions.')
            setResults([])
            setExcludedByBudget(0)
        } finally {
            setLoading(false)
        }
    }

    const toggleSuggestionTag = (tagId: number) => {
        setSuggestionTagIds((previous) => {
            const next = new Set(previous)
            next.has(tagId) ? next.delete(tagId) : next.add(tagId)
            return next
        })
    }

    const emptyMessage = excludedByBudget > 0
        ? 'No suggestions match your max budget. Unknown-budget options would still appear here if available.'
        : `No matching ${resultContext.type === 'all' ? 'recommendations' : resultContext.type} found. Try widening the radius${resultContext.selectedTags.size > 0 ? ', clearing tag preferences' : ''}${resultContext.budgetMax !== undefined ? ', or raising the max budget' : ''}.`

    const renderSuggestionCard = (
        suggestion: SuggestionResult,
        reasons: string[],
        friendCount: number,
        variant: 'top' | 'list',
    ) => {
        const { visibleTags, hiddenCount } = getVisibleTags(suggestion.tags, variant === 'top' ? 3 : 2)

        return (
            <button
                type="button"
                className={variant === 'top' ? 'suggestions-panel__top-pick' : 'suggestions-panel__item-button'}
                onClick={() => onSelectSuggestion(suggestion)}
            >
                <span className="suggestions-panel__topline">
                    <span className={`suggestions-panel__badge suggestions-panel__badge--${suggestion.type}`}>
                        <span aria-hidden="true">{getCategoryIcon(suggestion.tags, suggestion.type)}</span>
                        {suggestion.type}
                    </span>
                    <span className="suggestions-panel__score">{suggestion.score.toFixed(0)} match</span>
                </span>
                <span className="suggestions-panel__name">{suggestion.name}</span>
                <span className="suggestions-panel__meta">
                    {suggestion.distance_km.toFixed(1)} km · {formatBudget(suggestion.budget)}
                    {friendCount > 0 && ` · ${friendCount} friend${friendCount === 1 ? '' : 's'} attending`}
                </span>
                {visibleTags.length > 0 && (
                    <span className="suggestions-panel__tags">
                        {visibleTags.map((tag) => (
                            <span key={tag.id}>#{tag.name}</span>
                        ))}
                        {hiddenCount > 0 && <span>+{hiddenCount} more</span>}
                    </span>
                )}
                {reasons.length > 0 && (
                    <span className="suggestions-panel__why">
                        <strong>Why suggested</strong>
                        <span>
                            {reasons.map((reason) => (
                                <em key={reason}>{reason}</em>
                            ))}
                        </span>
                    </span>
                )}
            </button>
        )
    }

    return (
        <section className="suggestions-panel">
            <div className="suggestions-panel__header">
                <span className="suggestions-panel__eyebrow">For you</span>
                <span className="suggestions-panel__title">Recommended picks</span>
                <span className="suggestions-panel__subtitle">Tune your mood, then get a ranked daily pick.</span>
            </div>
            <form className="suggestions-panel__form" onSubmit={handleSubmit}>
                <div className="suggestions-panel__segmented" aria-label="Suggestion type">
                    {([
                        ['all', 'Both'],
                        ['events', 'Events'],
                        ['plans', 'Plans'],
                    ] as const).map(([value, label]) => (
                        <button
                            key={value}
                            type="button"
                            className={suggestionType === value ? 'suggestions-panel__segment suggestions-panel__segment--active' : 'suggestions-panel__segment'}
                            onClick={() => setSuggestionType(value)}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                <div className="suggestions-panel__row">
                    <label className="suggestions-panel__field">
                        <span>Radius km</span>
                        <input
                            type="number"
                            min="0.1"
                            step="0.1"
                            value={radius}
                            onChange={(event) => setRadius(event.target.value)}
                        />
                    </label>
                    <label className="suggestions-panel__field">
                        <span>Max budget</span>
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={budgetMax}
                            onChange={(event) => setBudgetMax(event.target.value)}
                            placeholder="Any"
                        />
                    </label>
                </div>
                <div className="suggestions-panel__tag-preferences" aria-label="Suggestion tag preferences">
                    <span>Preference tags</span>
                    <div>
                        {tags.length === 0 && <em>No tags available.</em>}
                        {tags.map((tag) => (
                            <button
                                key={tag.id}
                                type="button"
                                className={suggestionTagIds.has(tag.id) ? 'suggestions-panel__tag suggestions-panel__tag--active' : 'suggestions-panel__tag'}
                                onClick={() => toggleSuggestionTag(tag.id)}
                            >
                                #{tag.name}
                            </button>
                        ))}
                    </div>
                </div>
                {selectedTagNames && (
                    <div className="suggestions-panel__hint">Prioritizing: {selectedTagNames}</div>
                )}
                <button type="submit" className="suggestions-panel__submit" disabled={loading}>
                    {loading ? 'Finding...' : 'Find suggestions'}
                </button>
            </form>
            {error && <div className="suggestions-panel__error">{error}</div>}
            {!loading && !error && results.length === 0 && (
                <div className="suggestions-panel__empty">
                    {hasSearched ? emptyMessage : 'No suggestions loaded yet. Pick a type or mood, then find suggestions.'}
                </div>
            )}
            {!loading && !error && excludedByBudget > 0 && results.length > 0 && (
                <div className="suggestions-panel__hint">
                    Hidden {excludedByBudget} over-budget result{excludedByBudget === 1 ? '' : 's'}.
                </div>
            )}
            {topPick && (
                <div className="suggestions-panel__daily">
                    <span className="suggestions-panel__daily-label">Top pick for you</span>
                    {renderSuggestionCard(topPick.suggestion, topPick.reasons, topPick.friendCount, 'top')}
                </div>
            )}
            {morePicks.length > 0 && (
                <ul className="suggestions-panel__list">
                    {morePicks.map(({ suggestion, reasons, friendCount }) => (
                        <li key={`${suggestion.type}-${suggestion.id}`} className="suggestions-panel__item">
                            {renderSuggestionCard(suggestion, reasons, friendCount, 'list')}
                        </li>
                    ))}
                </ul>
            )}
        </section>
    )
}
