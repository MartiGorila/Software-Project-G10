import { MarkerData } from './types'

type SubscriptionPanelProps = {
    subscribedMarkers: MarkerData[]
    onRemoveSubscription: (markerId: string) => void
}

export default function SubscriptionPanel({ subscribedMarkers, onRemoveSubscription }: SubscriptionPanelProps) {
    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <h2>Subscribed events</h2>
                <p className="sidebar-note">Saved markers you subscribed to appear here.</p>
            </div>
            {subscribedMarkers.length === 0 ? (
                <div className="sidebar-empty">No subscriptions yet.</div>
            ) : (
                <ul className="sidebar-list">
                    {subscribedMarkers.map((marker) => (
                        <li key={marker.id} className="sidebar-item">
                            <strong>{marker.name}</strong>
                            <div>Hour: {marker.hour}</div>
                            <div>{marker.description}</div>
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
        </aside>
    )
}
