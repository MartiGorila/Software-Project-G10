import { useEffect, useState } from 'react'
import { getPublicUser } from './api'
import { PublicProfile } from './types'

type PublicProfileModalProps = {
    userId: string
    onClose: () => void
}

function Avatar({ url, username, size = 72 }: { url: string | null; username: string; size?: number }) {
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

export default function PublicProfileModal({ userId, onClose }: PublicProfileModalProps) {
    const [profile, setProfile] = useState<PublicProfile | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        let cancelled = false

        const loadProfile = async () => {
            try {
                setLoading(true)
                setError('')
                const data = await getPublicUser(userId)
                if (!cancelled) {
                    setProfile(data)
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
    }, [userId])

    const memberSince = profile?.created_at
        ? new Date(profile.created_at).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
          })
        : null

    return (
        <div className="profile-backdrop" onClick={(event) => event.target === event.currentTarget && onClose()}>
            <div className="profile-modal profile-modal--public">
                <button className="profile-close" type="button" onClick={onClose} aria-label="Close profile">
                    x
                </button>

                {loading && <div className="profile-loading">Loading profile...</div>}
                {error && <div className="profile-error">{error}</div>}

                {profile && (
                    <>
                        <div className="profile-header-band" />

                        <div className="profile-avatar-row">
                            <div className="profile-avatar-wrap profile-avatar-wrap--public">
                                <Avatar url={profile.avatar_url} username={profile.username} />
                            </div>
                            <div className="profile-identity">
                                <span className="profile-username">{profile.username}</span>
                                <span className="profile-public-badge">Public profile</span>
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
