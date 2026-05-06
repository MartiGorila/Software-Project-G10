import { Marker, Popup, useMapEvents } from 'react-leaflet'
import { Dispatch, FormEvent, SetStateAction } from 'react'
import { MarkerData, NewMarkerData } from './types'

type EventMarkersProps = {
    markers: MarkerData[]
    subscribedIds: string[]
    subscribersByEvent: Record<string, string[]>
    canSubscribe: boolean
    currentUserId: string | null
    onSubscribe: (markerId: string) => void
    onDeleteMarker: (markerId: string) => void
    clickPosition: [number, number] | null
    editing: boolean
    setEditing: Dispatch<SetStateAction<boolean>>
    formData: { name: string; hour: string; description: string }
    setFormData: Dispatch<SetStateAction<{ name: string; hour: string; description: string }>>
    onClickLocation: (position: [number, number]) => void
    onSaveMarker: (marker: NewMarkerData) => void
}

function ClickMenu({ onClickLocation }: { onClickLocation: (position: [number, number]) => void }) {
    useMapEvents({
        click(e) {
            const latlng: [number, number] = [e.latlng.lat, e.latlng.lng]
            onClickLocation(latlng)
        },
    })
    return null
}

export default function EventMarkers({
    markers,
    subscribedIds,
    subscribersByEvent,
    canSubscribe,
    currentUserId,
    onSubscribe,
    onDeleteMarker,
    clickPosition,
    editing,
    setEditing,
    formData,
    setFormData,
    onClickLocation,
    onSaveMarker,
}: EventMarkersProps) {
    return (
        <>
            {markers.map((marker) => {
                const subscribed = subscribedIds.includes(marker.id)
                const subscriberNames = subscribersByEvent[marker.id] ?? []
                const isCreator = marker.creatorId === currentUserId
                return (
                    <Marker key={marker.id} position={marker.position}>
                        <Popup>
                            <strong>{marker.name}</strong>
                            <br />
                            Hour: {marker.hour}
                            <br />
                            {marker.description}
                            <br />
                            <small className="event-subscribers">
                                {subscriberNames.length > 0
                                    ? `Subscribed users: ${subscriberNames.join(', ')}`
                                    : 'No users subscribed yet.'}
                            </small>
                            <div style={{ marginTop: '8px', display: 'flex', gap: '4px' }}>
                                <button
                                    type="button"
                                    className="popup-button popup-subscribe"
                                    onClick={() => onSubscribe(marker.id)}
                                    disabled={subscribed || !canSubscribe}
                                    style={{ flex: 1 }}
                                >
                                    {subscribed
                                        ? 'Subscribed'
                                        : canSubscribe
                                            ? 'Subscribe'
                                            : 'Login to subscribe'}
                                </button>
                                {isCreator && (
                                    <button
                                        type="button"
                                        className="popup-button popup-delete"
                                        onClick={() => onDeleteMarker(marker.id)}
                                        style={{ background: '#dc2626' }}
                                    >
                                        Delete
                                    </button>
                                )}
                            </div>
                        </Popup>
                    </Marker>
                )
            })}

            {clickPosition && (
                <>
                    <Marker position={clickPosition} />
                    <Popup position={clickPosition}>
                        {!editing ? (
                            <div className="popup-menu">
                                <div className="popup-title">Click menu</div>
                                {canSubscribe ? (
                                    <button type="button" className="popup-button" onClick={() => setEditing(true)}>
                                        + Add permanent marker
                                    </button>
                                ) : (
                                    <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>
                                        Login to create events
                                    </div>
                                )}
                            </div>
                        ) : (
                            <form className="popup-form" onSubmit={(event: FormEvent<HTMLFormElement>) => {
                                event.preventDefault()
                                if (!clickPosition) return
                                onSaveMarker({
                                    id: Date.now().toString(),
                                    position: clickPosition,
                                    name: formData.name.trim() || 'Untitled',
                                    hour: formData.hour.trim() || 'Unknown',
                                    description: formData.description.trim() || '',
                                })
                            }}>
                                <div className="popup-field">
                                    <label className="popup-label">Name</label>
                                    <input
                                        className="popup-input"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>
                                <div className="popup-field">
                                    <label className="popup-label">Hour</label>
                                    <input
                                        className="popup-input"
                                        type="time"
                                        step="3600"
                                        value={formData.hour}
                                        onChange={(e) => setFormData({ ...formData, hour: e.target.value })}
                                    />
                                </div>
                                <div className="popup-field">
                                    <label className="popup-label">Description</label>
                                    <textarea
                                        className="popup-textarea"
                                        rows={3}
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    />
                                </div>
                                <button type="submit" className="popup-submit">
                                    Save marker
                                </button>
                            </form>
                        )}
                    </Popup>
                </>
            )}

            <ClickMenu onClickLocation={onClickLocation} />
        </>
    )
}
