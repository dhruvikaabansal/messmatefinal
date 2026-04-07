import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import api from '../services/api';
import './Navbar.css';

const Navbar = () => {
  const location = useLocation();
  const token = localStorage.getItem('token');
  
  const isActive = (path) => location.pathname === path;

  const [groupMode, setGroupMode] = React.useState(false);
  const [profileComplete, setProfileComplete] = React.useState(false);

  React.useEffect(() => {
    const checkStatus = async () => {
      try {
        // Check profile completeness for logo logic
        const profRes = await api.get(`/user/profile?t=${new Date().getTime()}`);
        const pData = profRes.data.profile;
        if (pData && pData.age && pData.interests?.length > 0 && pData.profilePic) {
            setProfileComplete(true);
        }

        // Check group mode for navigation
        const prefRes = await api.get('/preferences');
        if (prefRes.data?.groupSize >= 3) setGroupMode(true);
        else setGroupMode(false);
      } catch (err) {}
    };
    if (token) checkStatus();
  }, [token, location.pathname]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userData');
    window.location.href = '/';
  };

  // Logo links home only when in dashboard routes OR when editing profile (mode=edit) OR if profile is already complete
  const isEditMode = new URLSearchParams(location.search).get('mode') === 'edit';
  const dashboardRoutes = ['/home', '/discover', '/matches', '/likes', '/community', '/profile/preview'];
  const logoIsClickable = dashboardRoutes.includes(location.pathname) || isEditMode || profileComplete;

  return (
    <nav className="neo-navbar">
      <div className="neo-navbar-content">
        <div className="neo-navbar-left">
           {/* Placeholder for future back button */}
        </div>
        
        {logoIsClickable ? (
          <Link to="/home" className="neo-brand">MessMate 🍽️ <span style={{ fontSize: '8px', opacity: 0.3 }}>v1.5.final_sync</span></Link>
        ) : (
          <span className="neo-brand disabled" title="Complete your profile to unlock navigation">MessMate 🍽️ <span style={{ fontSize: '8px', opacity: 0.3 }}>v1.5.final_sync</span></span>
        )}

        <div className="neo-navbar-right flex mobile-hide-flex">
          {token && (
            <>
              <Link to="/discover" className={`neo-nav-link ${isActive('/discover') ? 'active' : ''}`}>
                Discover
              </Link>
              <Link to="/community" className={`neo-nav-link ${isActive('/community') ? 'active' : ''}`}>
                 Community 👥
              </Link>
              <Link to="/likes" className={`neo-nav-link ${isActive('/likes') ? 'active' : ''}`}>
                 Likes ❤️
              </Link>
              <Link to="/matches" className={`neo-nav-link ${isActive('/matches') ? 'active' : ''}`}>
                 Matches 💬
              </Link>
              <Link to="/profile/preview" className={`neo-nav-link ${isActive('/profile/preview') ? 'active' : ''}`}>
                 My Profile 👤
              </Link>
              <button className="neo-nav-link logout-btn" onClick={handleLogout} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit', color: 'inherit' }}>
                Logout 🚪
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
