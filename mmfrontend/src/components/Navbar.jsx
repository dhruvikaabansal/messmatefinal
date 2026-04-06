import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Navbar.css';

const Navbar = () => {
  const location = useLocation();
  const token = localStorage.getItem('token');
  
  const isActive = (path) => location.pathname === path;

  const [groupMode, setGroupMode] = React.useState(false);

  React.useEffect(() => {
    const checkPref = async () => {
      try {
        const res = await api.get('/preferences');
        if (res.data?.groupSize >= 3) setGroupMode(true);
        else setGroupMode(false);
      } catch (err) {}
    };
    if (token) checkPref();
  }, [token, location.pathname]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userData');
    window.location.href = '/';
  };

  // Logo links home only when in dashboard routes OR when editing profile (mode=edit)
  const isEditMode = new URLSearchParams(location.search).get('mode') === 'edit';
  const dashboardRoutes = ['/home', '/discover', '/matches', '/likes', '/community', '/profile/preview'];
  const logoIsClickable = dashboardRoutes.includes(location.pathname) || isEditMode;

  return (
    <nav className="neo-navbar">
      <div className="neo-navbar-content">
        <div className="neo-navbar-left">
           {/* Placeholder for future back button */}
        </div>
        
        {logoIsClickable ? (
          <Link to="/home" className="neo-brand">MessMate 🍽️</Link>
        ) : (
          <span className="neo-brand disabled" title="Complete your profile to unlock navigation">MessMate 🍽️</span>
        )}

        <div className="neo-navbar-right flex">
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
