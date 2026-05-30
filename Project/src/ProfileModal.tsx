import { useEffect, useState } from 'react'
import { getCurrentUser, updateCurrentUser } from './api'
import { OwnProfile } from './types'

type ProfileModalProps = {
    onClose: () => void
    onProfileUpdated: (profile: OwnProfile) => void
}

function Avatar({ url, username, size = 88 }: { url: string | null; username: string; size?: number }) {
    const [imgError, setImgError] = useState(false)
    const initials = username.slice(0, 2).toUpperCase()

    if (url && !imgError) {
        return (
            <img
                src={url}
                alt={username}
                onError={() => setImgError(true)}
                style={{
                    width: size,
                    height: size,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    display: 'block',
                }}
            />
        )
    }

    return (
        <div className="profile-avatar-fallback" style={{ width: size, height: size, fontSize: size * 0.33 }}>
            {initials}
        </div>
    )
}

export default function ProfileModal({ onClose, onProfileUpdated }: ProfileModalProps) {
    const [profile, setProfile] = useState<OwnProfile | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [editing, setEditing] = useState(false)
    const [username, setUsername] = useState('')
    const [saving, setSaving] = useState(false)
    const [saveError, setSaveError] = useState('')

    useEffect(() => {
        let cancelled = false

        const loadProfile = async () => {
            try {
                setLoading(true)
                setError('')
                const data = await getCurrentUser()
                if (!cancelled) {
                    setProfile(data)
                    setUsername(data.username)
                }
            } catch (loadError) {
                if (!cancelled) {
                    setError(loadError instanceof Error ? loadError.message : 'Failed to load profile.')
                }
            } finally {
                if (!cancelled) {
                    setLoading(false)
                }
            }
        }

        loadProfile()

        return () => {
            cancelled = true
        }
    }, [])

    const handleSaveUsername = async () => {
        const nextUsername = username.trim()
        if (!profile || !nextUsername || nextUsername === profile.username) {
            setEditing(false)
            setUsername(profile?.username ?? '')
            return
        }

        try {
            setSaving(true)
            setSaveError('')
            const updated = await updateCurrentUser({ username: nextUsername })
            setProfile(updated)
            setUsername(updated.username)
            setEditing(false)
            onProfileUpdated(updated)
        } catch (saveErrorValue) {
            setSaveError(saveErrorValue instanceof Error ? saveErrorValue.message : 'Failed to update profile.')
        } finally {
            setSaving(false)
        }
    }

    const memberSince = profile?.created_at
        ? new Date(profile.created_at).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
          })
        : null

    return (
        <div className="profile-backdrop" onClick={(event) => event.target === event.currentTarget && onClose()}>
            <div className="profile-modal">
                <button className="profile-close" type="button" onClick={onClose} aria-label="Close profile">
                    x
                </button>

                {loading && <div className="profile-loading">Loading profile...</div>}
                {error && <div className="profile-error">{error}</div>}

                {profile && (
                    <>
                        <div className="profile-header-band" />

                        <div className="profile-avatar-row">
                            <div className="profile-avatar-wrap">
                                <Avatar url={profile.avatar_url} username={profile.username} />
                            </div>

                            <div className="profile-identity">
                                {editing ? (
                                    <div className="profile-edit-row">
                                        <input
                                            className="profile-username-input"
                                            value={username}
                                            onChange={(event) => setUsername(event.target.value)}
                                            autoFocus
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter') handleSaveUsername()
                                                if (event.key === 'Escape') {
                                                    setEditing(false)
                                                    setUsername(profile.username)
                                                    setSaveError('')
                                                }
                                            }}
                                        />
                                        <div className="profile-edit-actions">
                                            <button
                                                className="profile-save-btn"
                                                type="button"
                                                onClick={handleSaveUsername}
                                                disabled={saving}
                                            >
                                                {saving ? 'Saving...' : 'Save'}
                                            </button>
                                            <button
                                                className="profile-cancel-btn"
                                                type="button"
                                                onClick={() => {
                                                    setEditing(false)
                                                    setUsername(profile.username)
                                                    setSaveError('')
                                                }}
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                        {saveError && <div className="profile-save-error">{saveError}</div>}
                                    </div>
                                ) : (
                                    <div className="profile-username-row">
                                        <span className="profile-username">{profile.username}</span>
                                        <button
                                            className="profile-edit-icon-btn"
                                            type="button"
                                            onClick={() => setEditing(true)}
                                        >
                                            Edit
                                        </button>
                                    </div>
                                )}
                                <span className="profile-email">{profile.email}</span>
                            </div>
                        </div>

                        <div className="profile-meta-grid">
                            {memberSince && (
                                <div className="profile-meta-item">
                                    <span className="profile-meta-label">Member since</span>
                                    <span className="profile-meta-value">{memberSince}</span>
                                </div>
                            )}
                            <div className="profile-meta-item">
                                <span className="profile-meta-label">User ID</span>
                                <span className="profile-meta-value profile-meta-id">{profile.id.slice(0, 8)}...</span>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
