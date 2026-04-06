import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import api from './services/api';
import { AuthProvider } from './context/AuthContext';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Discover from './pages/Discover';
import Profile from './pages/Profile';
import Preferences from './pages/Preferences';
import Matches from './pages/Matches';
import LikesReceived from './pages/LikesReceived';
import Home from './pages/Home';
import Community from './pages/Community';
import Navbar from './components/Navbar';
import ProfilePreview from './pages/ProfilePreview';

// Protect routes that require authentication
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

// AuthRoute - Redirect to home if token exists BUT allow landing if no token
const AuthRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  if (token) {
    return <Navigate to="/home" replace />;
  }
  return children;
};

// Navbar Wrapper to exclude it from Landing/Auth pages
const LayoutWrapper = ({ children }) => {
  const location = useLocation();
  const token = localStorage.getItem('token');
  
  // Routes where we DON'T want the global Nav or Branding
  const publicRoutes = ['/', '/login', '/register'];
  const showNavbar = token && !publicRoutes.includes(location.pathname);

  return (
    <>
      {showNavbar && <Navbar />}
      {children}
    </>
  );
};

const DefaultRoute = () => {
    const navigate = useNavigate();
  
    useEffect(() => {
      const token = localStorage.getItem('token');
      if (!token) {
          navigate('/', { replace: true });
          return;
      }
  
      const check = async () => {
        try {
          const profRes = await api.get('/user/profile');
          const pData = profRes.data?.profile || profRes.data;
          
          if (!pData || !pData.age || !pData.gender || !pData.interests || pData.interests.length === 0) {
            navigate('/profile', { replace: true });
            return;
          }
          
          try {
            const prefRes = await api.get('/preferences');
            const prefData = prefRes.data?.preferences || prefRes.data;
            const gSize = prefData.groupSize || 2;
            if (gSize >= 3) {
                navigate('/community', { replace: true });
            } else {
                navigate('/home', { replace: true });
            }
          } catch(err) {
            navigate('/preferences', { replace: true });
          }
        } catch (err) {
          navigate('/profile', { replace: true });
        }
      };
      
      check();
    }, [navigate]);
  
    return <div className="loader-container">Entering MessMate... 🍽️</div>;
};

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));

  useEffect(() => {
    const handleStorageChange = () => {
      setToken(localStorage.getItem('token'));
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return (
    <AuthProvider>
      <Router>
        <LayoutWrapper>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<AuthRoute><Login /></AuthRoute>} />
            <Route path="/register" element={<AuthRoute><Register /></AuthRoute>} />
            
            {/* Protected Routes */}
            <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
            <Route path="/discover" element={<ProtectedRoute><Discover /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/preferences" element={<ProtectedRoute><Preferences /></ProtectedRoute>} />
            <Route path="/matches" element={<ProtectedRoute><Matches /></ProtectedRoute>} />
            <Route path="/likes" element={<ProtectedRoute><LikesReceived /></ProtectedRoute>} />
            <Route path="/community" element={<ProtectedRoute><Community /></ProtectedRoute>} />
            <Route path="/profile/preview" element={<ProtectedRoute><ProfilePreview /></ProtectedRoute>} />
            
            {/* Fallback */}
            <Route path="/start" element={<DefaultRoute />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </LayoutWrapper>
      </Router>
    </AuthProvider>
  );
}

export default App;
