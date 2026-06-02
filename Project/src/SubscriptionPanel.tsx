import { AuthUser, ApiEvent, Friend, FriendRequestsResponse } from './api'
import { getCategoryIcon, getVisibleTags } from './categoryIcons'
import { useState } from 'react'

type SubscriptionPanelProps = {
    subscribedEvents: ApiEvent[]
    friends: Friend[]
    friendRequests: FriendRequestsResponse
    friendsLoading: boolean
    friendsError: string
    currentUser: AuthUser | null
    onRemoveSubscription: (markerId: string) => void
    onRemoveFriend: (friendId: string) => Promise<void>
    onAcceptFriendRequest: (requestId: string) => Promise<void>
    onRejectFriendRequest: (requestId: string) => Promise<void>
    onCancelFriendRequest: (requestId: string) => Promise<void>
    onViewUserProfile: (userId: string) => void
}

export default function SubscriptionPanel({
    subscribedEvents,
    friends,
    friendRequests,
    friendsLoading,
    friendsError,
    currentUser,
    onRemoveSubscription,
    onRemoveFriend,
    onAcceptFriendRequest,
    onRejectFriendRequest,
    onCancelFriendRequest,
    onViewUserProfile,
}: SubscriptionPanelProps) {
    const [removingFriendId, setRemovingFriendId] = useState<string | null>(null)
    const [requestActionId, setRequestActionId] = useState<string | null>(null)
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

    const handleRequestAction = async (requestId: string, action: 'accept' | 'reject' | 'cancel') => {
        try {
            setRequestActionId(requestId)
            setFriendActionError('')
            if (action === 'accept') {
                await onAcceptFriendRequest(requestId)
            } else if (action === 'reject') {
                await onRejectFriendRequest(requestId)
            } else {
                await onCancelFriendRequest(requestId)
            }
        } catch (error) {
            setFriendActionError(error instanceof Error ? error.message : 'Failed to update request.')
        } finally {
            setRequestActionId(null)
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
                    {!friendsLoading && friendRequests.incoming.length > 0 && (
                        <div className="friend-requests">
                            <span className="friend-requests__label">Incoming requests</span>
                            {friendRequests.incoming.map((request) => (
                                <div key={request.id} className="friend-request-row">
                                    <button
                                        type="button"
                                        className="friend-row__profile"
                                        onClick={() => onViewUserProfile(request.requester_id)}
                                    >
                                        <span className="friend-row__avatar">
                                            {request.requester?.avatar_url ? (
                                                <img src={request.requester.avatar_url} alt={request.requester.username} />
                                            ) : (
                                                request.requester?.username.slice(0, 2).toUpperCase() ?? '??'
                                            )}
                                        </span>
                                        <span className="friend-row__name">{request.requester?.username ?? 'Unknown user'}</span>
                                    </button>
                                    <div className="friend-request-row__actions">
                                        <button
                                            type="button"
                                            className="friend-request-row__accept"
                                            disabled={requestActionId === request.id}
                                            onClick={() => handleRequestAction(request.id, 'accept')}
                                        >
                                            Accept
                                        </button>
                                        <button
                                            type="button"
                                            className="friend-row__remove"
                                            disabled={requestActionId === request.id}
                                            onClick={() => handleRequestAction(request.id, 'reject')}
                                        >
                                            Reject
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    {!friendsLoading && friendRequests.outgoing.length > 0 && (
                        <div className="friend-requests">
                            <span className="friend-requests__label">Sent requests</span>
                            {friendRequests.outgoing.map((request) => (
                                <div key={request.id} className="friend-request-row">
                                    <button
                                        type="button"
                                        className="friend-row__profile"
                                        onClick={() => onViewUserProfile(request.recipient_id)}
                                    >
                                        <span className="friend-row__avatar">
                                            {request.recipient?.avatar_url ? (
                                                <img src={request.recipient.avatar_url} alt={request.recipient.username} />
                                            ) : (
                                                request.recipient?.username.slice(0, 2).toUpperCase() ?? '??'
                                            )}
                                        </span>
                                        <span className="friend-row__name">{request.recipient?.username ?? 'Unknown user'}</span>
                                    </button>
                                    <button
                                        type="button"
                                        className="friend-row__remove"
                                        disabled={requestActionId === request.id}
                                        onClick={() => handleRequestAction(request.id, 'cancel')}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            ))}
                        </div>
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
