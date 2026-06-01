import { AuthUser, ApiEvent, Friend } from './api'
import { getCategoryIcon, getVisibleTags } from './categoryIcons'
import { useState } from 'react'

type SubscriptionPanelProps = {
    subscribedEvents: ApiEvent[]
    friends: Friend[]
    friendsLoading: boolean
    friendsError: string
    currentUser: AuthUser | null
    onRemoveSubscription: (markerId: string) => void
    onRemoveFriend: (friendId: string) => Promise<void>
    onViewUserProfile: (userId: string) => void
}

export default function SubscriptionPanel({
    subscribedEvents,
    friends,
    friendsLoading,
    friendsError,
    currentUser,
    onRemoveSubscription,
    onRemoveFriend,
    onViewUserProfile,
}: SubscriptionPanelProps) {
    const [removingFriendId, setRemovingFriendId] = useState<string | null>(null)
    const [friendActionError, setFriendActionError] = useState('')

    const handleRemoveFriend = async (friendId: string) => {
        try {
            setRemovingFriendId(friendId)
            setFriendActionError('')
            await onRemoveFriend(friendId)
        } catch (error) {
            setFriendActionError(error instanceof Error ? error.message : 'Failed to remove friend.')
        } finally {
            setRemovingFriendId(null)
        }
    }

    const formatEventTime = (iso: string) => new Date(iso).toLocaleString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    })

    const getDescriptionPreview = (description: string | null) => {
        if (!description) return ''
        return description.length > 92 ? `${description.slice(0, 89)}...` : description
    }

    return (
        <aside className="sidebar">
            {currentUser && (
                <section className="friends-section friends-section--top">
                    <div className="friends-section__header">
                        <h3>Friends</h3>
                    </div>
                    {friendsLoading && <div className="sidebar-empty">Loading friends...</div>}
                    {friendsError && <div className="sidebar-error">{friendsError}</div>}
                    {friendActionError && <div className="sidebar-error">{friendActionError}</div>}
                    {!friendsLoading && !friendsError && friends.length === 0 && (
                        <div className="sidebar-empty">No friends yet.</div>
                    )}
                    {!friendsLoading && friends.length > 0 && (
                        <ul className="friends-list">
                            {friends.map((friend) => (
                                <li key={friend.id} className="friend-row">
                                    <button
                                        type="button"
                                        className="friend-row__profile"
                                        onClick={() => onViewUserProfile(friend.id)}
                                    >
                                        <span className="friend-row__avatar">
                                            {friend.avatar_url ? (
                                                <img src={friend.avatar_url} alt={friend.username} />
                                            ) : (
                                                friend.username.slice(0, 2).toUpperCase()
                                            )}
                                        </span>
                                        <span className="friend-row__name">{friend.username}</span>
                                    </button>
                                    <button
                                        type="button"
                                        className="friend-row__remove"
                                        disabled={removingFriendId === friend.id}
                                        onClick={() => handleRemoveFriend(friend.id)}
                                    >
                                        {removingFriendId === friend.id ? '...' : 'Remove'}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            )}

            <section className="subscriptions-section">
                <div className="sidebar-header">
                    <h2>Subscribed events</h2>
                    <p className="sidebar-note">Saved markers you subscribed to appear here.</p>
                </div>
                {!currentUser && <div className="sidebar-empty">Log in to see your subscriptions.</div>}
                {currentUser && subscribedEvents.length === 0 && (
                    <div className="sidebar-empty">You have no subscriptions yet.</div>
                )}
                {currentUser && subscribedEvents.length > 0 && (
                    <ul className="subscribed-event-list">
                        {subscribedEvents.map((event) => {
                            const { visibleTags, hiddenCount } = getVisibleTags(event.tags, 3)
                            const preview = getDescriptionPreview(event.description)

                            return (
                            <li key={event.id} className="subscribed-event-card">
                                <div className="subscribed-event-card__topline">
                                    <span className="explore-card__badge explore-card__badge--event">
                                        <span className="explore-card__icon" aria-hidden="true">
                                            {getCategoryIcon(event.tags, 'event')}
                                        </span>
                                        Event
                                    </span>
                                    <span className="subscribed-event-card__time">{formatEventTime(event.event_time)}</span>
                                </div>
                                <strong>{event.name}</strong>
                                {preview && <p>{preview}</p>}
                                {visibleTags.length > 0 && (
                                    <div className="explore-card__tags">
                                        {visibleTags.map((tag) => (
                                            <span key={tag.id}>#{tag.name}</span>
                                        ))}
                                        {hiddenCount > 0 && <span className="explore-card__tag-more">+{hiddenCount} more</span>}
                                    </div>
                                )}
                                <button
                                    type="button"
                                    className="subscribed-event-card__unsubscribe"
                                    onClick={() => onRemoveSubscription(event.id)}
                                >
                                    Unsubscribe
                                </button>
                            </li>
                            )
                        })}
                    </ul>
                )}
            </section>
        </aside>
    )
}
