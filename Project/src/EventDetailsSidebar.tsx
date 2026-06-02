import './EventDetailsSidebar.css'
import { ApiEvent } from './api'
import { getCategoryIcon, getVisibleTags } from './categoryIcons'

export default function EventDetailsSidebar({
  event,
  onClose,
  isLoggedIn,
  currentUserId,
  joined,
  isFull,
  friendIds,
  onJoin,
  onLeave,
  onDeleteEvent,
  onViewUserProfile,
}: {
  event: ApiEvent
  onClose: () => void
  isLoggedIn: boolean
  currentUserId: string | null
  joined: boolean
  isFull: boolean
  friendIds: Set<string>
  onJoin: (eventId: string) => void
  onLeave: (eventId: string) => void
  onDeleteEvent: (eventId: string) => void
  onViewUserProfile: (userId: string) => void
}) {
  if (!event) return null
  const isOwn = event.creator_id === currentUserId
  const tags = event.tags ?? []
  const { visibleTags, hiddenCount } = getVisibleTags(tags, 6)
  const participants = event.event_participants ?? []
  const friendParticipants = participants.filter((participant) => friendIds.has(participant.user_id))
  const eventDate = new Date(event.event_time).toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
  const budgetLabel = event.budget != null ? `€${event.budget.toFixed(2)}` : 'Budget unknown'
  const capacityLabel = event.capacity != null
    ? `${participants.length}/${event.capacity} going`
    : `${participants.length} going`
  const visibilityLabel = event.visibility === 'friends'
    ? 'Friends'
    : event.visibility === 'private'
      ? 'Private'
      : 'Public'

  return (
    <div className="event-details-sidebar" onClick={(e) => e.stopPropagation()}>
      <div className="event-details-header">
        <div className="event-details-header__topline">
          <span className="event-details-badge">
            <span aria-hidden="true">{getCategoryIcon(tags, 'event')}</span>
            Event
          </span>
          <button className="event-details-close" type="button" onClick={onClose} aria-label="Close event details">
            ×
          </button>
        </div>
        <h2>{event.name}</h2>
        {visibleTags.length > 0 && (
          <div className="event-details-tags">
            {visibleTags.map((tag) => (
              <span key={tag.id} className="event-details-tag">#{tag.name}</span>
            ))}
            {hiddenCount > 0 && <span className="event-details-tag event-details-tag--more">+{hiddenCount} more</span>}
          </div>
        )}
      </div>

      <div className="event-details-metrics" aria-label="Event summary">
        <div className="event-details-metric">
          <span>Date</span>
          <strong>{eventDate}</strong>
        </div>
        <div className="event-details-metric">
          <span>Budget</span>
          <strong>{budgetLabel}</strong>
        </div>
        <div className="event-details-metric">
          <span>Capacity</span>
          <strong>{capacityLabel}</strong>
        </div>
        <div className="event-details-metric">
          <span>Visibility</span>
          <strong>{visibilityLabel}</strong>
        </div>
      </div>

      <section className="event-details-card">
        <h3>Description</h3>
        <p>{event.description || 'No description provided.'}</p>
      </section>

      <section className="event-details-card event-details-creator">
        <div>
          <h3>Hosted by</h3>
          <p>Organizer profile</p>
        </div>
        {event.creator_id && event.creator?.username ? (
          <button
            type="button"
            className="event-details-profile-pill"
            onClick={() => onViewUserProfile(event.creator_id)}
          >
            {event.creator.username}
          </button>
        ) : (
          <span className="event-details-muted">Unknown</span>
        )}
      </section>

      <section className="event-details-card">
        <div className="event-details-section-header">
          <h3>Friends attending</h3>
          <span>{friendParticipants.length}</span>
        </div>
        <div className="event-details-people event-details-people--friends">
          {friendParticipants.length > 0 ? (
            friendParticipants.map((participant) => (
              <div key={participant.user_id} className="event-details-person event-details-person--friend">
                {participant.user?.username ? (
                  <button
                    type="button"
                    className="event-details-profile-btn"
                    onClick={() => onViewUserProfile(participant.user_id)}
                  >
                    {participant.user.username}
                  </button>
                ) : (
                  <span>{participant.user_id}</span>
                )}
              </div>
            ))
          ) : (
            <span className="event-details-muted">No friends are attending yet.</span>
          )}
        </div>
      </section>

      <section className="event-details-card">
        <div className="event-details-section-header">
          <h3>Subscribed users</h3>
          <span>{participants.length}</span>
        </div>
        <div className="event-details-people">
          {participants.length > 0 ? (
            participants.map((participant) => (
              <div key={participant.user_id} className="event-details-person">
                {participant.user?.username ? (
                  <button
                    type="button"
                    className="event-details-profile-btn"
                    onClick={() => onViewUserProfile(participant.user_id)}
                  >
                    {participant.user.username}
                  </button>
                ) : (
                  <span>{participant.user_id}</span>
                )}
              </div>
            ))
          ) : (
            <span className="event-details-muted">No subscribers yet.</span>
          )}
        </div>
      </section>

      <div className="event-details-actions">
        {isLoggedIn && !isOwn && (
          <button
            className={`event-details-action ${joined ? 'event-details-action--secondary' : ''}`}
            disabled={!joined && isFull}
            onClick={() => joined ? onLeave(event.id) : onJoin(event.id)}
          >
            {joined ? 'Leave event' : isFull ? 'Event full' : 'Join event'}
          </button>
        )}
        {!isLoggedIn && (
          <div className="event-details-hint">Log in to join this event.</div>
        )}
        {isOwn && (
          <button
            className="event-details-action event-details-action--danger"
            onClick={() => onDeleteEvent(event.id)}
          >
            Delete
          </button>
        )}
      </div>
    </div>
  )
}
