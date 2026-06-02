import { FormEvent, useState } from 'react'
import { createEvent, createPlan, ApiEvent, ApiPlan, Tag, Visibility } from './api'

type Props = {
    position: [number, number] | null
    availableTags: Tag[]
    onEventCreated: (event: ApiEvent) => void
    onPlanCreated: (plan: ApiPlan) => void
    onCancel: () => void
}

export default function CreatePanel({
    position,
    availableTags,
    onEventCreated,
    onPlanCreated,
    onCancel,
}: Props) {
    const [type, setType] = useState<'event' | 'plan'>('event')
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [eventTime, setEventTime] = useState('')
    const [capacity, setCapacity] = useState('')
    const [budget, setBudget] = useState('')
    const [visibility, setVisibility] = useState<Visibility>('public')
    const [selectedTagIds, setSelectedTagIds] = useState<Set<number>>(new Set())
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    if (!position) return null

    const toggleTag = (tagId: number) => {
        setSelectedTagIds((prev) => {
            const next = new Set(prev)
            next.has(tagId) ? next.delete(tagId) : next.add(tagId)
            return next
        })
    }

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        if (!name.trim()) return
        setSaving(true)
        setError('')
        try {
            const tag_ids = [...selectedTagIds]
            const normalizedBudget = budget.trim() === '' ? 0 : parseFloat(budget)
            if (!Number.isFinite(normalizedBudget) || normalizedBudget < 0) {
                throw new Error('Budget must be a non-negative number')
            }

            if (type === 'event') {
                if (!eventTime) throw new Error('Event time is required')
                const event = await createEvent({
                    name: name.trim(),
                    description: description.trim() || undefined,
                    lat: position[0],
                    lng: position[1],
                    event_time: new Date(eventTime).toISOString(),
                    capacity: capacity ? parseInt(capacity) : undefined,
                    budget: normalizedBudget,
                    visibility,
                    tag_ids,
                })
                onEventCreated(event)
            } else {
                const plan = await createPlan({
                    name: name.trim(),
                    description: description.trim() || undefined,
                    lat: position[0],
                    lng: position[1],
                    budget: normalizedBudget,
                    visibility,
                    tag_ids,
                })
                onPlanCreated(plan)
            }
            setName('')
            setDescription('')
            setEventTime('')
            setCapacity('')
            setBudget('')
            setVisibility('public')
            setSelectedTagIds(new Set())
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Something went wrong')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="create-panel">
            <div className="create-panel__header">
                <span className="create-panel__title">New marker</span>
                <button className="create-panel__close" onClick={onCancel}>✕</button>
            </div>

            <div className="create-panel__type-toggle">
                <button
                    type="button"
                    className={`create-panel__type-btn ${type === 'event' ? 'create-panel__type-btn--active-event' : ''}`}
                    onClick={() => setType('event')}
                >
                    🗓 Event
                </button>
                <button
                    type="button"
                    className={`create-panel__type-btn ${type === 'plan' ? 'create-panel__type-btn--active-plan' : ''}`}
                    onClick={() => setType('plan')}
                >
                    📋 Plan
                </button>
            </div>

            <form className="create-panel__form" onSubmit={handleSubmit}>
                <div className="create-panel__field">
                    <label className="create-panel__label">Name *</label>
                    <input
                        className="create-panel__input"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={type === 'event' ? 'Morning run' : 'Weekend trip'}
                        required
                    />
                </div>

                <div className="create-panel__field">
                    <label className="create-panel__label">Description</label>
                    <textarea
                        className="create-panel__input create-panel__textarea"
                        rows={2}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                    />
                </div>

                {type === 'event' && (
                    <div className="create-panel__field">
                        <label className="create-panel__label">Date & Time *</label>
                        <input
                            className="create-panel__input"
                            type="datetime-local"
                            value={eventTime}
                            onChange={(e) => setEventTime(e.target.value)}
                            required
                        />
                    </div>
                )}

                {type === 'event' && (
                    <div className="create-panel__field">
                        <label className="create-panel__label">Capacity</label>
                        <input
                            className="create-panel__input"
                            type="number"
                            min="1"
                            value={capacity}
                            onChange={(e) => setCapacity(e.target.value)}
                            placeholder="Unlimited"
                        />
                    </div>
                )}

                <div className="create-panel__field">
                    <label className="create-panel__label">Budget (€) *</label>
                    <input
                        className="create-panel__input"
                        type="number"
                        min="0"
                        step="0.01"
                        value={budget}
                        onChange={(e) => setBudget(e.target.value)}
                        placeholder="0 for free"
                    />
                    <span className="create-panel__hint">Leave blank to mark it as free.</span>
                </div>

                <div className="create-panel__field">
                    <label className="create-panel__label">Visibility</label>
                    <div className="create-panel__visibility">
                        {([
                            ['public', 'Public', 'Everyone can discover it'],
                            ['friends', 'Friends', 'Only accepted friends can discover it'],
                            ['private', 'Private', 'Only you can see it'],
                        ] as const).map(([value, label, hint]) => (
                            <button
                                key={value}
                                type="button"
                                className={`create-panel__visibility-btn ${visibility === value ? 'create-panel__visibility-btn--active' : ''}`}
                                onClick={() => setVisibility(value)}
                            >
                                <strong>{label}</strong>
                                <span>{hint}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {availableTags.length > 0 && (
                    <div className="create-panel__field">
                        <label className="create-panel__label">Tags</label>
                        <div className="create-panel__tags">
                            {availableTags.map((tag) => (
                                <button
                                    key={tag.id}
                                    type="button"
                                    className={`create-panel__tag-btn ${selectedTagIds.has(tag.id) ? 'create-panel__tag-btn--active' : ''}`}
                                    onClick={() => toggleTag(tag.id)}
                                >
                                    #{tag.name}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {error && <div className="create-panel__error">{error}</div>}

                <button
                    type="submit"
                    className={`create-panel__submit create-panel__submit--${type}`}
                    disabled={saving}
                >
                    {saving ? 'Creating…' : `Create ${type}`}
                </button>
            </form>
        </div>
    )
}
