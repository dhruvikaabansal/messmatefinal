import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import './BottomNav.css';

const BottomNav = () => {
    const location = useLocation();
    
    // Hide BottomNav on auth pages
    const hideOn = ['/login', '/register', '/'];
    if (hideOn.includes(location.pathname)) return null;

    return (
        <nav className="bottom-nav">
            <NavLink to="/discover" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <span className="nav-icon">🎴</span>
                <span className="nav-label">Discover</span>
            </NavLink>
            <NavLink to="/community" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <span className="nav-icon">👥</span>
                <span className="nav-label">Group</span>
            </NavLink>
            <NavLink to="/likes" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <span className="nav-icon">💖</span>
                <span className="nav-label">Likes</span>
            </NavLink>
            <NavLink to="/matches" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <span className="nav-icon">💬</span>
                <span className="nav-label">Matches</span>
            </NavLink>
            <NavLink to="/home" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <span className="nav-icon">👤</span>
                <span className="nav-label">Me</span>
            </NavLink>

            {/* 🛡️ DEPLOYMENT HEARTBEAT: Verifies sync */}
            <span style={{ position: 'absolute', bottom: '2px', right: '5px', fontSize: '8px', opacity: 0.2, pointerEvents: 'none', color: '#000' }}>
                v1.2.sync
            </span>
        </nav>
    );
};

export default BottomNav;
