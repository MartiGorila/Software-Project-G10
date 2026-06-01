import { Tag } from './api'

export type RelevanceFilter = 'all' | 'mine' | 'friends'

type Props = {
    tags: Tag[]
    selectedTagIds: Set<number>
    onToggleTag: (tagId: number) => void
    onClear: () => void
    filterType: 'all' | 'events' | 'plans'
    onFilterType: (type: 'all' | 'events' | 'plans') => void
    relevanceFilter: RelevanceFilter
    onRelevanceFilter: (filter: RelevanceFilter) => void
    isLoggedIn: boolean
}

export default function FilterPanel({
    tags,
    selectedTagIds,
    onToggleTag,
    onClear,
    filterType,
    onFilterType,
    relevanceFilter,
    onRelevanceFilter,
    isLoggedIn,
}: Props) {
    const hasActiveFilters = selectedTagIds.size > 0 || filterType !== 'all' || relevanceFilter !== 'all'

    return (
        <div className="filter-panel">
            <div className="filter-panel__header">
                <span className="filter-panel__title">🔍 Filter</span>
                {hasActiveFilters && (
                    <button className="filter-panel__clear" onClick={onClear}>
                        Clear all
                    </button>
                )}
            </div>

            {/* Type filter */}
            <div className="filter-panel__type-row">
                {(['all', 'events', 'plans'] as const).map((t) => (
                    <button
                        key={t}
                        className={`filter-panel__type-btn ${filterType === t ? 'filter-panel__type-btn--active' : ''}`}
                        onClick={() => onFilterType(t)}
                    >
                        {t === 'all' ? 'All' : t === 'events' ? '🗓 Events' : '📋 Plans'}
                    </button>
                ))}
            </div>

            <div className="filter-panel__section-label">Relevance</div>
            <div className="filter-panel__type-row filter-panel__type-row--relevance">
                {([
                    ['all', 'All'],
                    ['mine', 'Mine'],
                    ['friends', 'Friends'],
                ] as const).map(([value, label]) => {
                    const disabled = !isLoggedIn && value !== 'all'
                    return (
                        <button
                            key={value}
                            className={`filter-panel__type-btn ${relevanceFilter === value ? 'filter-panel__type-btn--active' : ''}`}
                            onClick={() => onRelevanceFilter(value)}
                            disabled={disabled}
                            title={disabled ? 'Log in to use this discovery filter.' : undefined}
                        >
                            {label}
                        </button>
                    )
                })}
            </div>
            {!isLoggedIn && (
                <div className="filter-panel__hint">
                    Log in to use Mine and Friends discovery filters.
                </div>
            )}

            {/* Tag filter */}
            {tags.length > 0 && (
                <div className="filter-panel__tags">
                    {tags.map((tag) => (
                        <button
                            key={tag.id}
                            className={`filter-panel__tag ${selectedTagIds.has(tag.id) ? 'filter-panel__tag--active' : ''}`}
                            onClick={() => onToggleTag(tag.id)}
                        >
                            #{tag.name}
                        </button>
                    ))}
                </div>
            )}

            {selectedTagIds.size > 0 && (
                <div className="filter-panel__hint">
                    Showing markers with{' '}
                    <strong>
                        {[...selectedTagIds]
                            .map((id) => tags.find((t) => t.id === id)?.name)
                            .filter(Boolean)
                            .join(', ')}
                    </strong>
                </div>
            )}
        </div>
    )
}
