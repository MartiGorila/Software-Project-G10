import { FormEvent, useState } from 'react'
import { getSuggestions, SuggestionResult, Tag } from './api'

type Props = {
    mapCenter: [number, number]
    selectedTagIds: Set<number>
    filterType: 'all' | 'events' | 'plans'
    tags: Tag[]
    onSelectSuggestion: (suggestion: SuggestionResult) => void
}

function formatBudget(budget: number | null) {
    return budget === null ? 'Budget unknown' : `€${budget.toFixed(2)}`
}

export default function SuggestionsPanel({
    mapCenter,
    selectedTagIds,
    filterType,
    tags,
    onSelectSuggestion,
}: Props) {
    const [radius, setRadius] = useState('10')
    const [budgetMax, setBudgetMax] = useState('')
    const [results, setResults] = useState<SuggestionResult[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const selectedTagNames = [...selectedTagIds]
        .map((id) => tags.find((tag) => tag.id === id)?.name)
        .filter(Boolean)
        .join(', ')

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault()
        setLoading(true)
        setError('')

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
                tag_ids: [...selectedTagIds],
                type: filterType,
            })
            setResults(data.results)
        } catch (suggestionError) {
            setError(suggestionError instanceof Error ? suggestionError.message : 'Failed to load suggestions.')
            setResults([])
        } finally {
            setLoading(false)
        }
    }

    return (
        <section className="suggestions-panel">
            <div className="suggestions-panel__header">
                <span className="suggestions-panel__title">Suggestions</span>
            </div>
            <form className="suggestions-panel__form" onSubmit={handleSubmit}>
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
                {selectedTagNames && (
                    <div className="suggestions-panel__hint">Using selected tags: {selectedTagNames}</div>
                )}
                <button type="submit" className="suggestions-panel__submit" disabled={loading}>
                    {loading ? 'Finding...' : 'Find suggestions'}
                </button>
            </form>
            {error && <div className="suggestions-panel__error">{error}</div>}
            {!loading && !error && results.length === 0 && (
                <div className="suggestions-panel__empty">No suggestions loaded yet.</div>
            )}
            {results.length > 0 && (
                <ul className="suggestions-panel__list">
                    {results.map((suggestion) => (
                        <li key={`${suggestion.type}-${suggestion.id}`} className="suggestions-panel__item">
                            <button
                                type="button"
                                className="suggestions-panel__item-button"
                                onClick={() => onSelectSuggestion(suggestion)}
                            >
                                <span className={`suggestions-panel__badge suggestions-panel__badge--${suggestion.type}`}>
                                    {suggestion.type}
                                </span>
                                <span className="suggestions-panel__name">{suggestion.name}</span>
                                <span className="suggestions-panel__meta">
                                    {suggestion.distance_km.toFixed(1)} km · score {suggestion.score.toFixed(0)}
                                </span>
                                <span className="suggestions-panel__meta">{formatBudget(suggestion.budget)}</span>
                                {suggestion.tags.length > 0 && (
                                    <span className="suggestions-panel__tags">
                                        {suggestion.tags.map((tag) => (
                                            <span key={tag.id}>#{tag.name}</span>
                                        ))}
                                    </span>
                                )}
                                <span className="suggestions-panel__reasons">
                                    {suggestion.reasons.join(' · ')}
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    )
}
