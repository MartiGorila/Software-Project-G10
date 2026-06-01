import { MarkerData } from './types'
import { AuthUser, Friend } from './api'
import { useState } from 'react'

type SubscriptionPanelProps = {
    subscribedMarkers: MarkerData[]
    friends: Friend[]
    friendsLoading: boolean
    friendsError: string
    currentUser: AuthUser | null
    onRemoveSubscription: (markerId: string) => void
    onRemoveFriend: (friendId: string) => Promise<void>
    onViewUserProfile: (userId: string) => void
}

export default function SubscriptionPanel({
    subscribedMarkers,
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
                {currentUser && subscribedMarkers.length === 0 && (
                    <div className="sidebar-empty">You have no subscriptions yet.</div>
                )}
                {currentUser && subscribedMarkers.length > 0 && (
                    <ul className="sidebar-list">
                        {subscribedMarkers.map((marker) => (
                            <li key={marker.id} className="sidebar-item">
                                <strong>{marker.name}</strong>
                                <div>Time: {marker.hour}</div>
                                {marker.description && <div>{marker.description}</div>}
                                <button
                                    type="button"
                                    className="popup-button popup-unsubscribe"
                                    onClick={() => onRemoveSubscription(marker.id)}
                                >
                                    Unsubscribe
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </aside>
    )
}
