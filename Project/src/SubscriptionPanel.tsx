import { MarkerData } from './types'
import { AuthUser } from './api'

type SubscriptionPanelProps = {
    subscribedMarkers: MarkerData[]
    currentUser: AuthUser | null
    onRemoveSubscription: (markerId: string) => void
    onOpenProfile: () => void
}

export default function SubscriptionPanel({
    subscribedMarkers,
    currentUser,
    onRemoveSubscription,
    onOpenProfile,
}: SubscriptionPanelProps) {
    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <h2>Subscribed events</h2>
                <p className="sidebar-note">Saved markers you subscribed to appear here.</p>
            </div>
            {currentUser && (
                <button type="button" className="popup-button" onClick={onOpenProfile}>
                    View &amp; edit profile
                </button>
            )}
            {!currentUser && <div className="sidebar-empty">Log in to see your subscriptions.</div>}
            {currentUser && subscribedMarkers.length === 0 && (
                <div className="sidebar-empty">You have no subscriptions yet.</div>
            )}
            {currentUser && subscribedMarkers.length > 0 && (
                <>
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
                </>
            )}
        </aside>
    )
}
