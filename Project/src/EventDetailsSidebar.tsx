import './EventDetailsSidebar.css'
import { ApiEvent } from './api'

export default function EventDetailsSidebar({
  event,
  onClose,
}: {
  event: ApiEvent
  onClose: () => void
}) {
  if (!event) return null

  return (
    <div className="event-details-sidebar" onClick={(e) => e.stopPropagation()}>
      <button className="event-details-close" type="button" onClick={onClose}>
        ×
      </button>
      <div className="event-details-header">
        <span className="event-details-label">Event details</span>
        <h2>{event.name}</h2>
      </div>
      <div className="event-details-row">
        <span className="event-details-title">Description</span>
        <span>{event.description || 'Unknown'}</span>
      </div>
      <div className="event-details-row">
        <span className="event-details-title">Time</span>
        <span>{new Date(event.event_time).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
      </div>
      <div className="event-details-row">
        <span className="event-details-title">Budget</span>
        <span>{event.budget != null ? `€${event.budget}` : 'Unknown'}</span>
      </div>
      <div className="event-details-row">
        <span className="event-details-title">Capacity</span>
        <span>{event.capacity != null ? event.capacity : 'Unknown'}</span>
      </div>
      <div className="event-details-row">
        <span className="event-details-title">Creator</span>
        <span>{event.creator?.username || 'Unknown'}</span>
      </div>
      <div className="event-details-row event-details-row--participants">
        <span className="event-details-title">Subscribed users</span>
        <div className="event-details-participants">
          {event.event_participants && event.event_participants.length > 0 ? (
            event.event_participants.map((participant) => (
              <div key={participant.user_id} className="event-details-participant">
                {participant.user?.username || participant.user_id}
              </div>
            ))
          ) : (
            <span>None</span>
          )}
        </div>
      </div>
    </div>
  )
}
