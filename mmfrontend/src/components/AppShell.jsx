import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useSession } from '../store/SessionContext';

const TABS = [
  { to: '/discover', icon: '🍽️', label: 'Discover' },
  { to: '/likes', icon: '💛', label: 'Likes' },
  { to: '/inbox', icon: '💬', label: 'Inbox', badge: true },
  { to: '/me', icon: '👤', label: 'Me' },
];

const HIDE_CHROME = ['/', '/login', '/register', '/onboarding'];

const AppShell = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthed, unread } = useSession();

  const bare = HIDE_CHROME.includes(location.pathname) || !isAuthed;
  // A chat thread is a focused screen — the tab bar would fight the composer.
  const inThread = /^\/inbox\/(match|community)\//.test(location.pathname);

  if (bare) return <div className="app-shell">{children}</div>;

  return (
    <div className="app-shell">
      {!inThread && (
        <header className="topbar">
          <button
            className="brand"
            onClick={() => navigate('/discover')}
            style={{ background: 'none', border: 0, cursor: 'pointer', padding: 0 }}
          >
            MessMate <span aria-hidden>🍽️</span>
          </button>
        </header>
      )}

      {children}

      {!inThread && (
        <nav className="tabbar" aria-label="Main">
          {TABS.map((t) => (
            <NavLink key={t.to} to={t.to} className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}>
              <span className="tab-icon" aria-hidden>{t.icon}</span>
              <span>{t.label}</span>
              {t.badge && unread > 0 && (
                <span className="tab-badge">{unread > 9 ? '9+' : unread}</span>
              )}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
};

export default AppShell;
