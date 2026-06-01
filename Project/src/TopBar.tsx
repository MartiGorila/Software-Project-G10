import { useState } from 'react'
import type { AuthUser } from './api'

type TopBarProps = {
    currentUser: AuthUser | null
    onOpenProfile: () => void
    onLoginClick: () => void
    onLogout: () => void
}

function getInitials(username: string): string {
    return username.slice(0, 2).toUpperCase()
}

export default function TopBar({ currentUser, onOpenProfile, onLoginClick, onLogout }: TopBarProps) {
    const [accountOpen, setAccountOpen] = useState(false)

    const handleOpenProfile = () => {
        setAccountOpen(false)
        onOpenProfile()
    }

    const handleLogout = () => {
        setAccountOpen(false)
        onLogout()
    }

    return (
        <header className="top-bar" aria-label="Application header">
            <div className="top-bar__brand">
                <span className="top-bar__mark">E</span>
                <div className="top-bar__copy">
                    <span className="top-bar__name">EventMap</span>
                    <span className="top-bar__tagline">Discover plans around you</span>
                </div>
            </div>
            <nav className="top-bar__nav" aria-label="Primary navigation">
                <a href="#explore-panel">Explore</a>
                <a href="#suggestions-panel">Suggestions</a>
                <a href="#friends-panel">Friends</a>
                {currentUser ? (
                    <div className="top-bar__account">
                        <button
                            type="button"
                            className="top-bar__avatar-btn"
                            onClick={() => setAccountOpen((open) => !open)}
                            aria-label="Open account menu"
                            aria-expanded={accountOpen}
                        >
                            {currentUser.avatar_url ? (
                                <img src={currentUser.avatar_url} alt={currentUser.username} />
                            ) : (
                                <span>{getInitials(currentUser.username)}</span>
                            )}
                        </button>
                        {accountOpen && (
                            <div className="account-popover" role="menu">
                                <div className="account-popover__identity">
                                    <div className="account-popover__avatar">
                                        {currentUser.avatar_url ? (
                                            <img src={currentUser.avatar_url} alt={currentUser.username} />
                                        ) : (
                                            <span>{getInitials(currentUser.username)}</span>
                                        )}
                                    </div>
                                    <div className="account-popover__text">
                                        <strong>{currentUser.username}</strong>
                                        {currentUser.email && <small>{currentUser.email}</small>}
                                    </div>
                                </div>
                                <button type="button" className="account-popover__button" onClick={handleOpenProfile}>
                                    View &amp; edit profile
                                </button>
                                <button
                                    type="button"
                                    className="account-popover__button account-popover__button--danger"
                                    onClick={handleLogout}
                                >
                                    Logout
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <button type="button" onClick={onLoginClick}>Login / Register</button>
                )}
            </nav>
        </header>
    )
}
